"use client";

import { Copy, File, RefreshCw, Upload, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { formatBytes, prepareUpload, uploadImageFile } from "@/cms/editor/upload-helper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { parseSeoulDateTimeInput } from "@/libs/contents/published-at";
import { cn } from "@/utils/cn";
import { cmsFetch, errorText } from "../admin-api";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { AdminShell } from "../shared/admin-shell";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { DateRangePicker } from "../shared/date-range-picker";

interface MediaItem {
	id: string;
	status: "ready" | "deleting" | "pending" | "failed";
	filename: string;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
	publicUrl: string | null;
	original: { mimeType: string | null; byteSize: number | null; width: number | null; height: number | null } | null;
	defaultAlt: string;
	defaultCaption: string;
	createdAt: string;
	referencesCount: number;
	references: { entryId: string; title: string | null; collection: string; state: "working" | "published" }[];
}

const PAGE_SIZE = 30;
const TYPE_OPTIONS = [
	{ value: "all", label: "모든 형식" },
	{ value: "image/jpeg", label: "JPEG" },
	{ value: "image/png", label: "PNG" },
	{ value: "image/webp", label: "WebP" },
	{ value: "image/gif", label: "GIF" },
	{ value: "image/avif", label: "AVIF" },
];

const USED_OPTIONS = [
	{ value: "all", label: "사용 여부 전체" },
	{ value: "used", label: "사용 중" },
	{ value: "unused", label: "미사용" },
];

/** 미디어 라이브러리(§7.3). 썸네일 목록, 파일명 검색, 형식·업로드일·사용 여부 필터, 최신 업로드순. */
export function MediaLibrary() {
	const altId = useId();
	const captionId = useId();
	const [items, setItems] = useState<MediaItem[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [used, setUsed] = useState<"all" | "used" | "unused">("all");
	const [mimeType, setMimeType] = useState("all");
	const [uploadedFrom, setUploadedFrom] = useState("");
	const [uploadedTo, setUploadedTo] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [optimize, setOptimize] = useState(false);
	const [upload, setUpload] = useState<{ current: number; total: number; percent: number } | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const [draft, setDraft] = useState({ alt: "", caption: "" });
	const fileInputRef = useRef<HTMLInputElement>(null);
	const selected = items.find((item) => item.id === selectedId) ?? null;

	const fetchMedia = useCallback(async () => {
		setIsLoading(true);
		try {
			const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), used });
			if (search.trim()) query.set("search", search.trim());
			if (mimeType !== "all") query.set("mimeType", mimeType);
			const from = uploadedFrom && parseSeoulDateTimeInput(`${uploadedFrom}T00:00`);
			const to = uploadedTo && parseSeoulDateTimeInput(`${uploadedTo}T23:59`);
			if (from) query.set("uploadedFrom", from);
			if (to) query.set("uploadedTo", new Date(Date.parse(to) + 59_999).toISOString());
			const data = await cmsFetch<{ items: MediaItem[]; total: number }>(`/api/cms/v1/media?${query.toString()}`);
			setItems(data.items);
			setTotal(data.total);
		} catch (error) {
			toast.error(errorText(error, "미디어를 불러오지 못했습니다."));
		} finally {
			setIsLoading(false);
		}
	}, [page, used, search, mimeType, uploadedFrom, uploadedTo]);

	useEffect(() => {
		const timer = setTimeout(() => void fetchMedia(), 200);
		return () => clearTimeout(timer);
	}, [fetchMedia]);

	// 선택이 바뀔 때만 편집 초안을 채운다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by selected id
	useEffect(() => {
		if (selected) setDraft({ alt: selected.defaultAlt, caption: selected.defaultCaption });
	}, [selected?.id]);

	const handleFiles = async (files: FileList | null) => {
		if (!files?.length) return;
		const list = Array.from(files);
		try {
			for (const [index, file] of list.entries()) {
				setUpload({ current: index + 1, total: list.length, percent: 0 });
				const prepared = await prepareUpload(file, { optimize });
				await uploadImageFile(prepared, (percent) => setUpload({ current: index + 1, total: list.length, percent }));
			}
			toast.success(`${list.length}개 파일을 올렸습니다.`);
			setPage(1);
			await fetchMedia();
		} catch (error) {
			// 실패한 업로드는 사용 가능 상태가 되지 않는다. 같은 파일로 다시 시도할 수 있다(§7.2).
			toast.error(`업로드 실패: ${errorText(error, "오류가 발생했습니다.")} 다시 시도할 수 있습니다.`);
		} finally {
			setUpload(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const deleteMedia = async (media: MediaItem) => {
		try {
			await cmsFetch(`/api/cms/v1/media/${media.id}`, { method: "DELETE", fallback: "삭제하지 못했습니다." });
			setSelectedId(null);
			toast.success(`'${media.filename}'을(를) 삭제했습니다.`);
		} catch (error) {
			toast.error(errorText(error, "삭제하지 못했습니다."));
		}
		await fetchMedia();
	};

	const saveDefaults = async () => {
		if (!selected) return;
		try {
			await cmsFetch(`/api/cms/v1/media/${selected.id}`, {
				method: "PATCH",
				json: { defaultAlt: draft.alt, defaultCaption: draft.caption },
			});
			toast.success("기본 설명을 저장했습니다. 이미 작성한 본문은 바뀌지 않습니다.");
			await fetchMedia();
		} catch (error) {
			toast.error(errorText(error, "저장하지 못했습니다."));
		}
	};

	const cleanup = async () => {
		try {
			const result = await cmsFetch<{ removed: number; failed: string[] }>("/api/cms/v1/media/cleanup", {
				method: "POST",
				json: {},
			});
			const text = `24시간 지난 미완료 업로드 ${result.removed}개를 정리했습니다.${result.failed.length ? ` ${result.failed.length}개는 다음에 다시 시도합니다.` : ""}`;
			if (result.failed.length) toast.error(text);
			else toast.success(text);
		} catch (error) {
			toast.error(errorText(error, "정리하지 못했습니다."));
		}
	};

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const requestDelete = (media: MediaItem) =>
		setConfirm({
			title: media.status === "deleting" ? "삭제 다시 시도" : "미디어 삭제",
			description: `'${media.filename}' 파일을 삭제합니다. 템플릿이나 해석하지 못한 초안에서 쓰이면 삭제가 보류됩니다.`,
			confirmLabel: "삭제",
			destructive: true,
			onConfirm: () => deleteMedia(media),
		});

	/** 미디어 타일의 오른쪽 클릭·`⋯` 메뉴(v2 A2). */
	const mediaMenu = (media: MediaItem): MenuAction[] => [
		{ kind: "item", label: "상세 보기", onSelect: () => setSelectedId(media.id) },
		{
			kind: "sub",
			label: "사용처",
			emptyLabel: "초안·공개본에서 쓰이지 않습니다",
			items: media.references.map((reference) => ({
				kind: "item" as const,
				label: `${reference.title || "(제목 없음)"} · ${reference.state === "published" ? "공개본" : "초안"}`,
				onSelect: () => window.location.assign(`/admin/entries/${reference.entryId}/edit`),
			})),
		},
		{ kind: "separator" },
		{
			kind: "item",
			label: media.referencesCount > 0 ? "사용 중이라 삭제할 수 없음" : "삭제",
			destructive: true,
			disabled: media.referencesCount > 0,
			onSelect: () => requestDelete(media),
		},
	];

	const setFilter = (apply: () => void) => {
		apply();
		setPage(1);
	};

	return (
		<AdminShell
			title={
				<span>
					미디어 <span className="font-normal text-muted-foreground text-xs">총 {total}개</span>
				</span>
			}
			sidebar={{ activeNav: "media" }}
			headerActions={
				<div className="flex flex-wrap items-center gap-2">
					<Label className="font-normal text-muted-foreground text-xs">
						<Checkbox checked={optimize} onCheckedChange={(checked) => setOptimize(checked === true)} />
						웹용 최적화 (원본도 보관)
					</Label>
					<input
						ref={fileInputRef}
						type="file"
						multiple
						hidden
						accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
						onChange={(event) => void handleFiles(event.target.files)}
					/>
					<Button type="button" size="sm" disabled={upload !== null} onClick={() => fileInputRef.current?.click()}>
						<Upload aria-hidden />
						{upload ? `업로드 중 ${upload.current}/${upload.total} (${upload.percent}%)` : "파일 업로드"}
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={() => void cleanup()}>
						미완료 업로드 정리
					</Button>
					<Button
						type="button"
						size="icon-sm"
						variant="outline"
						aria-label="새로고침"
						onClick={() => void fetchMedia()}
					>
						<RefreshCw className={cn(isLoading && "animate-spin")} aria-hidden />
					</Button>
				</div>
			}
		>
			<div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 lg:px-6">
				<Input
					type="search"
					aria-label="파일명 검색"
					value={search}
					placeholder="파일명 검색"
					onChange={(event) => setFilter(() => setSearch(event.target.value))}
					className="h-8 w-56"
				/>
				<Select
					value={mimeType}
					items={TYPE_OPTIONS}
					onValueChange={(value) => value && setFilter(() => setMimeType(value))}
				>
					<SelectTrigger size="sm" aria-label="형식">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{TYPE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={used}
					items={USED_OPTIONS}
					onValueChange={(value) => value && setFilter(() => setUsed(value as typeof used))}
				>
					<SelectTrigger size="sm" aria-label="사용 여부">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{USED_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<DateRangePicker
					label="업로드일"
					from={uploadedFrom}
					to={uploadedTo}
					onChange={(from, to) =>
						setFilter(() => {
							setUploadedFrom(from);
							setUploadedTo(to);
						})
					}
				/>
			</div>

			<div className="flex min-h-0 flex-1 overflow-hidden">
				<div className="flex-1 overflow-y-auto p-4 lg:p-6">
					{items.length === 0 ? (
						isLoading ? (
							<ul aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
								{Array.from({ length: 6 }, (_, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: 자리표시
									<li key={index}>
										<Skeleton className="aspect-square w-full rounded-lg" />
									</li>
								))}
							</ul>
						) : (
							<Empty className="py-16">
								<EmptyHeader>
									<EmptyTitle>조건에 맞는 미디어가 없습니다.</EmptyTitle>
								</EmptyHeader>
							</Empty>
						)
					) : (
						<ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
							{items.map((media) => (
								<ActionContextMenu key={media.id} actions={mediaMenu(media)} trigger={<li className="relative" />}>
									<Button
										variant="outline"
										type="button"
										aria-pressed={selectedId === media.id}
										onClick={() => setSelectedId(media.id)}
										onKeyDown={(event) => {
											if (event.key === "Delete" && media.referencesCount === 0) {
												event.preventDefault();
												requestDelete(media);
											}
										}}
										className={cn(
											"h-auto w-full flex-col items-stretch gap-0 overflow-hidden rounded-lg bg-card p-0 text-left font-normal",
											selectedId === media.id ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/30",
										)}
									>
										<span className="relative flex aspect-square items-center justify-center bg-muted">
											{media.publicUrl ? (
												// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
												<img src={media.publicUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
											) : (
												<File className="size-10 text-muted-foreground" aria-hidden />
											)}
											<Badge variant="secondary" className="absolute top-1.5 left-1.5 text-[10px]">
												{media.status === "deleting"
													? "삭제 중"
													: media.referencesCount > 0
														? `사용 ${media.referencesCount}`
														: "미사용"}
											</Badge>
										</span>
										<span className="truncate p-2 text-xs">{media.filename}</span>
									</Button>
									<MoreActionsButton
										actions={mediaMenu(media)}
										label={`'${media.filename}' 작업`}
										className="absolute top-1 right-1 size-7 bg-background/80"
									/>
								</ActionContextMenu>
							))}
						</ul>
					)}
					<nav aria-label="페이지 이동" className="mt-4 flex items-center justify-end gap-2 text-xs">
						<Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
							이전
						</Button>
						<span className="tabular-nums">
							{page} / {totalPages}
						</span>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={page >= totalPages}
							onClick={() => setPage(page + 1)}
						>
							다음
						</Button>
					</nav>
				</div>

				{selected && (
					<aside
						aria-label="미디어 상세"
						className="flex w-80 flex-col gap-4 overflow-y-auto border-l bg-card p-4 text-xs"
					>
						<div className="flex items-center justify-between">
							<h2 className="font-semibold text-sm">미디어 상세</h2>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label="상세 닫기"
								onClick={() => setSelectedId(null)}
							>
								<X aria-hidden />
							</Button>
						</div>
						{selected.publicUrl && (
							// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
							<img src={selected.publicUrl} alt="" className="max-h-48 rounded border object-contain" />
						)}
						<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
							<dt className="text-muted-foreground">파일명</dt>
							<dd className="truncate" title={selected.filename}>
								{selected.filename}
							</dd>
							<dt className="text-muted-foreground">형식</dt>
							<dd>{selected.mimeType ?? "—"}</dd>
							<dt className="text-muted-foreground">공개용</dt>
							<dd>
								{selected.width}×{selected.height} · {formatBytes(selected.byteSize ?? 0)}
							</dd>
							{selected.original && (
								<>
									<dt className="text-muted-foreground">원본</dt>
									<dd>
										{selected.original.width}×{selected.original.height} ·{" "}
										{formatBytes(selected.original.byteSize ?? 0)} · {selected.original.mimeType}
									</dd>
								</>
							)}
							<dt className="text-muted-foreground">업로드</dt>
							<dd>{new Date(selected.createdAt).toLocaleString("ko-KR")}</dd>
							<dt className="text-muted-foreground">미디어 ID</dt>
							<dd className="flex items-center gap-1">
								<code className="truncate">{selected.id}</code>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									aria-label="미디어 ID 복사"
									onClick={() => void navigator.clipboard.writeText(selected.id)}
								>
									<Copy aria-hidden />
								</Button>
							</dd>
						</dl>

						<Separator />
						<form
							className="space-y-3"
							onSubmit={(event) => {
								event.preventDefault();
								void saveDefaults();
							}}
						>
							<FieldDescription>본문에 삽입할 때 복사되는 기본값입니다.</FieldDescription>
							<Field>
								<FieldLabel htmlFor={altId}>기본 대체 텍스트</FieldLabel>
								<Input
									id={altId}
									value={draft.alt}
									onChange={(event) => setDraft({ ...draft, alt: event.target.value })}
									className="h-8"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={captionId}>기본 캡션</FieldLabel>
								<Input
									id={captionId}
									value={draft.caption}
									onChange={(event) => setDraft({ ...draft, caption: event.target.value })}
									className="h-8"
								/>
							</Field>
							<Button type="submit" size="sm" variant="outline" disabled={selected.status !== "ready"}>
								기본값 저장
							</Button>
						</form>

						<Separator />
						<section className="space-y-1.5">
							<h3 className="font-semibold text-muted-foreground">사용처 ({selected.referencesCount})</h3>
							{selected.references.map((reference) => (
								<a
									key={`${reference.entryId}-${reference.state}`}
									href={`/admin/entries/${reference.entryId}/edit`}
									className="block rounded border p-2 hover:bg-accent"
								>
									{reference.title || "(제목 없음)"} · {reference.state === "published" ? "공개본" : "초안"}
								</a>
							))}
							{selected.referencesCount === 0 && (
								<p className="text-muted-foreground">초안·공개본에서 쓰이지 않습니다.</p>
							)}
						</section>

						<Button
							type="button"
							variant="destructive"
							size="sm"
							disabled={selected.referencesCount > 0}
							onClick={() => requestDelete(selected)}
						>
							{selected.referencesCount > 0
								? "사용 중이라 삭제할 수 없음"
								: selected.status === "deleting"
									? "삭제 다시 시도"
									: "삭제"}
						</Button>
					</aside>
				)}
			</div>
			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
		</AdminShell>
	);
}
