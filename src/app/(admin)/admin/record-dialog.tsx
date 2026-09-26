"use client";

import { useEffect, useId, useState } from "react";
import { COLLECTION_DEFINITIONS, type Collection } from "@/cms/core/collections";
import { slugify } from "@/cms/core/slug";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CmsApiError, cmsFetch, errorText } from "./admin-api";
import { cmsIssueMessage } from "./api-error-message";

export type RecordTarget = { collection: Collection; id: string | null };

interface RecordEntry {
	id: string;
	version: number;
	workingSlug: string | null;
	working: { metadata: { title?: string; summary?: string; itemIds?: string[] } };
}

type PostOption = { id: string; title: string; status: string };

/**
 * record 컬렉션 폼(§5.2). `저장`이 검증 후 곧바로 공개 값에 반영된다. 자동 저장은 하지 않는다.
 * 모음집은 설명과 게시글 순서를 편집한다. 아직 공개되지 않은 글도 담을 수 있고 공개 목록에서만 빠진다(§6.4).
 */
export function RecordDialog({
	target,
	onClose,
	onSaved,
}: {
	target: RecordTarget | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const titleId = useId();
	const slugId = useId();
	const summaryId = useId();
	const searchId = useId();
	const [loaded, setLoaded] = useState<RecordEntry | null>(null);
	const [title, setTitle] = useState("");
	const [slug, setSlug] = useState("");
	const [summary, setSummary] = useState("");
	const [items, setItems] = useState<PostOption[]>([]);
	const [search, setSearch] = useState("");
	const [results, setResults] = useState<PostOption[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isDirty, setIsDirty] = useState(false);
	const [confirmDiscard, setConfirmDiscard] = useState(false);

	const collection = target?.collection ?? "tag";
	const isSeries = collection === "collection";
	const label = COLLECTION_DEFINITIONS[collection].label;

	useEffect(() => {
		setLoaded(null);
		setTitle("");
		setSlug("");
		setSummary("");
		setItems([]);
		setSearch("");
		setError(null);
		setIsDirty(false);
		setConfirmDiscard(false);
		if (!target?.id) return;
		let cancelled = false;
		(async () => {
			try {
				const entry = await cmsFetch<RecordEntry>(`/api/cms/v1/entries/${target.id}`);
				if (cancelled) return;
				setLoaded(entry);
				setTitle(entry.working.metadata.title ?? "");
				setSlug(entry.workingSlug ?? "");
				setSummary(entry.working.metadata.summary ?? "");
				const ids = entry.working.metadata.itemIds ?? [];
				const resolved = await Promise.all(
					ids.map((id) =>
						cmsFetch<{ status: string; working: { metadata: { title?: string } } }>(`/api/cms/v1/entries/${id}`)
							.then((post) => ({ id, title: post.working.metadata.title || "제목 없음", status: post.status }))
							.catch(() => ({ id, title: "(찾을 수 없음)", status: "missing" })),
					),
				);
				if (!cancelled) setItems(resolved);
			} catch (err) {
				if (!cancelled) setError(errorText(err, `${label}을(를) 불러오지 못했습니다.`));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [target, label]);

	useEffect(() => {
		if (!isSeries || !search.trim()) {
			setResults([]);
			return;
		}
		const timer = setTimeout(() => {
			const params = new URLSearchParams({ collection: "post", search: search.trim(), pageSize: "25" });
			cmsFetch<{ items: { id: string; title: string | null; status: string }[] }>(`/api/cms/v1/entries?${params}`)
				.then((data) =>
					setResults(
						data.items.map((item) => ({ id: item.id, title: item.title || "제목 없음", status: item.status })),
					),
				)
				.catch(() => setResults([]));
		}, 250);
		return () => clearTimeout(timer);
	}, [isSeries, search]);

	const touch = () => setIsDirty(true);
	const move = (index: number, direction: -1 | 1) => {
		const next = [...items];
		const target = index + direction;
		if (target < 0 || target >= next.length) return;
		[next[index], next[target]] = [next[target] as PostOption, next[index] as PostOption];
		setItems(next);
		touch();
	};

	const close = () => {
		// 명시적 저장 폼은 변경 중 닫을 때 안내한다(§5.2).
		if (isDirty && !confirmDiscard) {
			setConfirmDiscard(true);
			return;
		}
		onClose();
	};

	const save = async () => {
		if (!target || !title.trim()) return;
		setIsSaving(true);
		setError(null);
		const metadata: Record<string, unknown> = { title: title.trim() };
		if (isSeries) {
			if (summary.trim()) metadata.summary = summary.trim();
			if (items.length > 0) metadata.itemIds = items.map((item) => item.id);
		}
		try {
			if (target.id && loaded) {
				await cmsFetch(`/api/cms/v1/entries/${target.id}`, {
					method: "PATCH",
					json: { expectedVersion: loaded.version, slug: slug.trim() || slugify(title), metadata },
					fallback: "저장하지 못했습니다.",
				});
			} else {
				await cmsFetch("/api/cms/v1/entries", {
					method: "POST",
					json: { collection, slug: slug.trim() || null, metadata, mdx: "" },
					fallback: "만들지 못했습니다.",
				});
			}
			setIsDirty(false);
			onSaved();
		} catch (err) {
			setError(
				err instanceof CmsApiError && err.issues.length > 0
					? err.issues.map(cmsIssueMessage).join("\n")
					: errorText(err, "저장하지 못했습니다."),
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
			<DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{target?.id ? `${label} 편집` : `새 ${label}`}</DialogTitle>
					<DialogDescription>저장하면 검증 후 공개 분류 정보에 바로 반영됩니다.</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-3 text-sm"
					onSubmit={(event) => {
						event.preventDefault();
						void save();
					}}
				>
					<div className="space-y-1">
						<label htmlFor={titleId} className="font-medium">
							이름
						</label>
						<Input
							id={titleId}
							autoFocus
							value={title}
							onChange={(event) => {
								setTitle(event.target.value);
								touch();
							}}
						/>
					</div>
					<div className="space-y-1">
						<label htmlFor={slugId} className="font-medium">
							주소 (slug)
						</label>
						<Input
							id={slugId}
							value={slug}
							placeholder={slugify(title) || "비우면 이름에서 만듭니다"}
							onChange={(event) => {
								setSlug(event.target.value);
								touch();
							}}
							className="font-mono"
						/>
						{target?.id && (
							<p className="text-muted-foreground text-xs">주소를 바꾸면 이전 주소는 새 주소로 연결됩니다.</p>
						)}
					</div>
					{isSeries && (
						<>
							<div className="space-y-1">
								<label htmlFor={summaryId} className="font-medium">
									설명
								</label>
								<textarea
									id={summaryId}
									rows={2}
									value={summary}
									onChange={(event) => {
										setSummary(event.target.value);
										touch();
									}}
									className="w-full rounded-md border bg-background p-2"
								/>
							</div>
							<fieldset className="space-y-2">
								<legend className="font-medium">게시글 (순서대로)</legend>
								{items.length === 0 && <p className="text-muted-foreground text-xs">담긴 글이 없습니다.</p>}
								<ol className="space-y-1">
									{items.map((item, index) => (
										<li key={`${item.id}-${index}`} className="flex items-center gap-1 rounded border px-2 py-1">
											<span className="min-w-0 flex-1 truncate">
												{index + 1}. {item.title}
												{item.status !== "published" && (
													<span className="ml-1 text-amber-600 text-xs">
														({item.status === "missing" ? "없음" : "비공개 — 공개 목록에서 빠짐"})
													</span>
												)}
											</span>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												aria-label={`${item.title} 위로`}
												disabled={index === 0}
												onClick={() => move(index, -1)}
											>
												↑
											</Button>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												aria-label={`${item.title} 아래로`}
												disabled={index === items.length - 1}
												onClick={() => move(index, 1)}
											>
												↓
											</Button>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												aria-label={`${item.title} 빼기`}
												onClick={() => {
													setItems(items.filter((_, i) => i !== index));
													touch();
												}}
											>
												×
											</Button>
										</li>
									))}
								</ol>
								<label htmlFor={searchId} className="sr-only">
									추가할 글 검색
								</label>
								<Input
									id={searchId}
									value={search}
									placeholder="추가할 게시글 검색"
									onChange={(event) => setSearch(event.target.value)}
								/>
								{results.length > 0 && (
									<ul className="max-h-32 overflow-y-auto rounded border text-xs">
										{results.map((result) => (
											<li key={result.id}>
												<Button
													type="button"
													variant="ghost"
													size="xs"
													className="w-full justify-start"
													onClick={() => {
														setItems([...items, result]);
														setSearch("");
														touch();
													}}
												>
													{result.title}
													{result.status !== "published" && ` (${result.status})`}
												</Button>
											</li>
										))}
									</ul>
								)}
							</fieldset>
						</>
					)}
					{confirmDiscard && (
						<p role="alert" className="text-amber-700 dark:text-amber-400">
							저장하지 않은 변경이 있습니다. 한 번 더 닫으면 변경을 버립니다.
						</p>
					)}
					{error && (
						<p role="alert" className="whitespace-pre-wrap text-destructive">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={close}>
							{confirmDiscard ? "변경 버리고 닫기" : "취소"}
						</Button>
						<Button type="submit" disabled={!title.trim() || isSaving || Boolean(target?.id && !loaded)}>
							{target?.id ? "저장" : "만들기"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
