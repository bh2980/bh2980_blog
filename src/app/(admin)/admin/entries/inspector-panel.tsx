"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useId, useState } from "react";
import type { IncomingReferenceItem } from "@/cms/adapters/postgres/content-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatSeoulDateTimeInput } from "@/libs/contents/published-at";
import { cmsFetch, errorText } from "../admin-api";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { describeEntryStatus } from "../shared/entry-status";
import { useTaxonomy } from "../shared/use-taxonomy";
import type { EntryData, EntryForm } from "./entry-form";

const COLLECTION_LABELS: Record<string, string> = {
	post: "게시글",
	memo: "메모",
	category: "카테고리",
	tag: "태그",
	collection: "모음집",
};
const REFERENCE_KIND_LABELS = { entry: "글", media: "미디어", category: "카테고리", tag: "태그" };
const POLICY_OPTIONS = [
	{ value: "normal", label: "일반" },
	{ value: "evergreen", label: "항상 최신 글" },
	{ value: "deprecated", label: "지원 중단" },
];

const fieldClass =
	"h-auto w-full rounded-md border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-xs shadow-none md:text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white";

export type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";

interface InspectorPanelProps {
	collection: string;
	form: EntryForm;
	disabled: boolean;
	publishIssues?: CmsIssue[];
	/** 요약이 비었을 때 발행하면 쓸 자동 요약(§5.6). */
	autoSummaryPreview: string;
	entry: EntryData | null;
	previewHref: string | null;
	incomingReferences: IncomingReferenceItem[];
	isLoadingIncomingReferences: boolean;
	incomingReferencesError: string | null;
	onRefreshIncomingReferences: () => void;
	onTitleChange: (title: string) => void;
	onSlugChange: (slug: string) => void;
	onRegenerateSlug: () => void;
	onChange: (patch: Partial<EntryForm>) => void;
	onDuplicate: () => void;
	onLifecycle: (action: LifecycleAction) => void;
	onPermanentDelete: () => void;
	onClose?: () => void;
}

function Field({
	id,
	label,
	required,
	issue,
	help,
	children,
}: {
	id: string;
	label: string;
	required?: boolean;
	issue?: CmsIssue;
	help?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="space-y-1.5">
			<label htmlFor={id} className="block font-semibold text-neutral-600 text-xs dark:text-neutral-400">
				{label} {required && <span className="text-red-500">*</span>}
			</label>
			{children}
			{issue && (
				<p id={`${id}-error`} className="text-red-500 text-xs">
					{cmsIssueMessage(issue)}
				</p>
			)}
			{help && <div className="text-[11px] text-neutral-500 leading-tight dark:text-neutral-400">{help}</div>}
		</div>
	);
}

/** 대체 글 선택(§6.4). 공개된 게시글 중에서 제목으로 찾는다. */
function ReplacementPicker({
	value,
	disabled,
	excludeId,
	onChange,
}: {
	value: string | null;
	disabled: boolean;
	excludeId?: string;
	onChange: (id: string | null) => void;
}) {
	const searchId = useId();
	const [search, setSearch] = useState("");
	const [results, setResults] = useState<{ id: string; title: string }[]>([]);
	const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

	useEffect(() => {
		if (!value) {
			setSelectedTitle(null);
			return;
		}
		cmsFetch<{ working: { metadata: { title?: string } } }>(`/api/cms/v1/entries/${value}`)
			.then((entry) => setSelectedTitle(entry.working.metadata.title || "제목 없음"))
			.catch(() => setSelectedTitle("(찾을 수 없음)"));
	}, [value]);

	useEffect(() => {
		if (!search.trim()) {
			setResults([]);
			return;
		}
		const timer = setTimeout(() => {
			const params = new URLSearchParams({
				collection: "post",
				search: search.trim(),
				pageSize: "25",
				status: "published",
			});
			cmsFetch<{ items: { id: string; title: string | null }[] }>(`/api/cms/v1/entries?${params.toString()}`)
				.then((data) =>
					setResults(
						data.items
							.filter((item) => item.id !== excludeId)
							.map((item) => ({ id: item.id, title: item.title || "제목 없음" })),
					),
				)
				.catch(() => setResults([]));
		}, 250);
		return () => clearTimeout(timer);
	}, [search, excludeId]);

	return (
		<div className="space-y-1.5">
			<p className="text-xs">
				현재: {selectedTitle ?? "지정 안 함"}
				{value && !disabled && (
					<button type="button" className="ml-2 underline" onClick={() => onChange(null)}>
						해제
					</button>
				)}
			</p>
			<label htmlFor={searchId} className="sr-only">
				대체 글 검색
			</label>
			<Input
				id={searchId}
				value={search}
				disabled={disabled}
				placeholder="공개된 글 제목 검색"
				onChange={(event) => setSearch(event.target.value)}
				className={fieldClass}
			/>
			{results.length > 0 && (
				<ul className="max-h-32 overflow-y-auto rounded border text-xs">
					{results.map((result) => (
						<li key={result.id}>
							<button
								type="button"
								className="w-full px-2 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
								onClick={() => {
									onChange(result.id);
									setSearch("");
								}}
							>
								{result.title}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export function InspectorPanel({
	collection,
	form,
	disabled,
	publishIssues = [],
	autoSummaryPreview,
	entry,
	previewHref,
	incomingReferences,
	isLoadingIncomingReferences,
	incomingReferencesError,
	onRefreshIncomingReferences,
	onTitleChange,
	onSlugChange,
	onRegenerateSlug,
	onChange,
	onDuplicate,
	onLifecycle,
	onPermanentDelete,
	onClose,
}: InspectorPanelProps) {
	const isPost = collection === "post";
	const isContent = isPost || collection === "memo";
	const categories = useTaxonomy("category", isPost);
	const tags = useTaxonomy("tag", isContent);
	const [newCategory, setNewCategory] = useState("");
	const [newTag, setNewTag] = useState("");
	const [createError, setCreateError] = useState<string | null>(null);

	const issueFor = (path: string) => publishIssues.find((issue) => issue.path === path);
	const describedBy = (path: string) => (issueFor(path) ? `cms-${path}-error` : undefined);
	const workingReferences = incomingReferences.filter((reference) => reference.state === "working");
	const publishedReferences = incomingReferences.filter((reference) => reference.state === "published");

	const createRecord = async (kind: "tag" | "category") => {
		const name = (kind === "tag" ? newTag : newCategory).trim();
		if (!name) return;
		setCreateError(null);
		try {
			const created = await (kind === "tag" ? tags : categories).create(name);
			if (kind === "tag") {
				onChange({ tagIds: [...form.tagIds, created.id] });
				setNewTag("");
			} else {
				onChange({ categoryId: created.id });
				setNewCategory("");
			}
		} catch (error) {
			setCreateError(errorText(error, `${kind === "tag" ? "태그" : "카테고리"}를 만들지 못했습니다.`));
		}
	};

	const toggleTag = (tagId: string) =>
		onChange({
			tagIds: form.tagIds.includes(tagId) ? form.tagIds.filter((id) => id !== tagId) : [...form.tagIds, tagId],
		});

	const actionButton = "h-7 px-2 text-xs";

	return (
		<div className="h-full w-full space-y-6 overflow-y-auto border-neutral-200 border-l bg-neutral-50 p-5 text-sm lg:w-80 dark:border-neutral-800 dark:bg-neutral-900">
			<div className="flex items-center justify-between border-neutral-200 border-b pb-3 dark:border-neutral-800">
				<h2 className="font-bold text-neutral-500 text-xs uppercase tracking-wider">속성</h2>
				{onClose && (
					<Button type="button" size="sm" variant="ghost" className={actionButton} onClick={onClose}>
						닫기
					</Button>
				)}
			</div>

			{entry && (
				<section aria-label="상태와 작업" className="space-y-2 text-xs">
					<p>
						<span className="font-semibold">상태</span>{" "}
						{describeEntryStatus({ ...entry, scheduledAt: entry.schedule?.pending?.scheduledAt })}
					</p>
					{entry.publishedSlug && entry.status === "published" && (
						<p className="break-all text-neutral-500">
							공개 주소: /{collection === "memo" ? "memos" : "posts"}/{entry.publishedSlug}
						</p>
					)}
					<div className="flex flex-wrap gap-1.5">
						{previewHref && (
							<a
								href={previewHref}
								target="_blank"
								rel="noreferrer"
								className="rounded border px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
							>
								미리보기
							</a>
						)}
						{entry.status !== "trashed" && (
							<Button type="button" size="sm" variant="outline" className={actionButton} onClick={onDuplicate}>
								복제
							</Button>
						)}
						{(entry.status === "draft" || entry.status === "published") && (
							<Button
								type="button"
								size="sm"
								variant="outline"
								className={actionButton}
								onClick={() => onLifecycle("archive")}
							>
								보관
							</Button>
						)}
						{entry.status === "archived" && (
							<Button
								type="button"
								size="sm"
								variant="outline"
								className={actionButton}
								onClick={() => onLifecycle("unarchive")}
							>
								보관 해제
							</Button>
						)}
						{entry.status === "trashed" ? (
							<>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className={actionButton}
									onClick={() => onLifecycle("restore")}
								>
									복원
								</Button>
								<Button
									type="button"
									size="sm"
									variant="destructive"
									className={actionButton}
									onClick={onPermanentDelete}
								>
									영구 삭제
								</Button>
							</>
						) : (
							<Button
								type="button"
								size="sm"
								variant="outline"
								className={`${actionButton} text-red-600`}
								onClick={() => onLifecycle("trash")}
							>
								휴지통
							</Button>
						)}
					</div>
				</section>
			)}

			<fieldset disabled={disabled} className="space-y-6 disabled:opacity-70">
				<Field id="cms-title" label="제목" required issue={issueFor("title")}>
					<Input
						id="cms-title"
						aria-invalid={Boolean(issueFor("title")) || undefined}
						aria-describedby={describedBy("title")}
						value={form.title}
						onChange={(event) => onTitleChange(event.target.value)}
						placeholder="제목 없는 글"
						className={`${fieldClass} text-sm md:text-sm`}
					/>
				</Field>

				<Field
					id="cms-slug"
					label="주소 (slug)"
					required
					issue={issueFor("slug")}
					help="발행된 글의 주소를 바꾸면 이전 주소는 308 리다이렉트로 새 주소를 안내합니다."
				>
					<div className="flex gap-1.5">
						<Input
							id="cms-slug"
							aria-invalid={Boolean(issueFor("slug")) || undefined}
							aria-describedby={describedBy("slug")}
							value={form.slug}
							onChange={(event) => onSlugChange(event.target.value)}
							placeholder="url-friendly-slug"
							className={`${fieldClass} font-mono`}
						/>
						<Button type="button" size="sm" variant="outline" className={actionButton} onClick={onRegenerateSlug}>
							제목에서
						</Button>
					</div>
				</Field>

				{isPost && (
					<Field id="cms-categoryId" label="카테고리" required issue={issueFor("categoryId")}>
						<NativeSelect
							id="cms-categoryId"
							wrapperClassName="w-full"
							aria-invalid={Boolean(issueFor("categoryId")) || undefined}
							aria-describedby={describedBy("categoryId")}
							value={form.categoryId ?? ""}
							onChange={(event) => onChange({ categoryId: event.target.value || null })}
							className={`${fieldClass} pr-9`}
						>
							<option value="">카테고리 선택...</option>
							{categories.options.map((option) => (
								<option key={option.id} value={option.id}>
									{option.title}
								</option>
							))}
						</NativeSelect>
						<div className="flex items-center gap-1.5 pt-1">
							<Input
								aria-label="새 카테고리 이름"
								value={newCategory}
								onChange={(event) => setNewCategory(event.target.value)}
								placeholder="새 카테고리 추가"
								className={fieldClass}
							/>
							<Button
								type="button"
								size="sm"
								variant="secondary"
								className={actionButton}
								disabled={!newCategory.trim()}
								onClick={() => void createRecord("category")}
							>
								추가
							</Button>
						</div>
					</Field>
				)}

				{isPost && (
					<Field id="cms-policy" label="정책" help="지원 중단 글은 공개 화면에서 대체 글을 안내합니다.">
						<NativeSelect
							id="cms-policy"
							wrapperClassName="w-full"
							value={form.policy}
							onChange={(event) => onChange({ policy: event.target.value as EntryForm["policy"] })}
							className={`${fieldClass} pr-9`}
						>
							{POLICY_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</NativeSelect>
						{form.policy === "deprecated" && (
							<ReplacementPicker
								value={form.replacementPostId}
								disabled={disabled}
								excludeId={entry?.id}
								onChange={(id) => onChange({ replacementPostId: id })}
							/>
						)}
					</Field>
				)}

				{isContent && (
					<Field
						id="cms-publishedAt"
						label="표시 발행일 (서울 시간)"
						issue={issueFor("publishedAt")}
						help="비워 두면 처음 발행한 시각을 씁니다. 미래 발행은 예약 기능을 쓰세요."
					>
						<input
							id="cms-publishedAt"
							type="datetime-local"
							aria-describedby={describedBy("publishedAt")}
							value={form.publishDate}
							max={formatSeoulDateTimeInput(new Date())}
							onChange={(event) => onChange({ publishDate: event.target.value })}
							className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
						/>
					</Field>
				)}

				{isPost && (
					<Field
						id="cms-summary"
						label="요약"
						issue={issueFor("summary")}
						help={
							!form.summary.trim() &&
							(autoSummaryPreview ? (
								<>
									<span className="font-medium">비워 두면 발행할 때 본문에서 만듭니다:</span> {autoSummaryPreview}
								</>
							) : (
								"요약을 만들 본문이 없습니다. 발행하려면 직접 입력하세요."
							))
						}
					>
						<textarea
							id="cms-summary"
							rows={3}
							value={form.summary}
							onChange={(event) => onChange({ summary: event.target.value })}
							placeholder="목록과 검색 결과에 보일 소개글"
							className="w-full resize-none rounded-md border border-neutral-300 bg-white p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
						/>
					</Field>
				)}

				{isContent && (
					<fieldset className="space-y-2 rounded-md border border-neutral-200 p-2.5 dark:border-neutral-800">
						<legend className="px-1 font-semibold text-neutral-600 text-xs dark:text-neutral-400">SEO</legend>
						<Field id="cms-seoTitle" label="검색 제목 (비우면 글 제목)">
							<Input
								id="cms-seoTitle"
								value={form.seoTitle}
								onChange={(event) => onChange({ seoTitle: event.target.value })}
								placeholder={form.title || "글 제목"}
								className={fieldClass}
							/>
						</Field>
						<Field id="cms-seoDescription" label="검색 설명 (비우면 요약)">
							<textarea
								id="cms-seoDescription"
								rows={2}
								value={form.seoDescription}
								onChange={(event) => onChange({ seoDescription: event.target.value })}
								className="w-full resize-none rounded border border-neutral-300 bg-white p-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
							/>
						</Field>
						<Field
							id="cms-canonicalUrl"
							label="canonical URL"
							help="값을 넣으면 canonical이 이 주소가 되고 sitemap에서 빠집니다. 사이트 경로(/...)와 http(s) 주소만 반영됩니다."
						>
							<Input
								id="cms-canonicalUrl"
								value={form.canonicalUrl}
								onChange={(event) => onChange({ canonicalUrl: event.target.value })}
								placeholder="/posts/slug 또는 https://..."
								className={fieldClass}
							/>
						</Field>
					</fieldset>
				)}

				{isContent && (
					<fieldset
						id="cms-tagIds"
						tabIndex={-1}
						aria-invalid={Boolean(issueFor("tagIds")) || undefined}
						aria-describedby={describedBy("tagIds")}
						className="space-y-2"
					>
						<legend className="font-semibold text-neutral-600 text-xs dark:text-neutral-400">태그 (순서 보존)</legend>
						{issueFor("tagIds") && (
							<p id="cms-tagIds-error" className="text-red-500 text-xs">
								{cmsIssueMessage(issueFor("tagIds") as CmsIssue)}
							</p>
						)}
						<div className="flex min-h-6 flex-wrap gap-1.5">
							{form.tagIds.length === 0 && <span className="text-neutral-400 text-xs italic">선택된 태그 없음</span>}
							{form.tagIds.map((id, index) => {
								const name = tags.options.find((tag) => tag.id === id)?.title ?? id.slice(0, 8);
								return (
									<span
										key={id}
										className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700 text-xs dark:border-blue-800/60 dark:bg-blue-950/60 dark:text-blue-300"
									>
										<span className="text-[10px] text-blue-400">{index + 1}.</span>
										{name}
										<button type="button" aria-label={`${name} 태그 제거`} onClick={() => toggleTag(id)}>
											×
										</button>
									</span>
								);
							})}
						</div>
						{tags.options.length > 0 && (
							<div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded border border-neutral-200 bg-white p-1.5 dark:border-neutral-800 dark:bg-neutral-900/50">
								{tags.options.map((tag) => {
									const selected = form.tagIds.includes(tag.id);
									return (
										<button
											key={tag.id}
											type="button"
											aria-pressed={selected}
											onClick={() => toggleTag(tag.id)}
											className={`rounded px-2 py-0.5 text-xs ${
												selected
													? "bg-blue-600 font-medium text-white"
													: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
											}`}
										>
											{tag.title}
										</button>
									);
								})}
							</div>
						)}
						<div className="flex items-center gap-1.5 pt-1">
							<Input
								aria-label="새 태그 이름"
								value={newTag}
								onChange={(event) => setNewTag(event.target.value)}
								placeholder="새 태그를 만들고 바로 추가"
								className={fieldClass}
							/>
							<Button
								type="button"
								size="sm"
								variant="secondary"
								className={actionButton}
								disabled={!newTag.trim()}
								onClick={() => void createRecord("tag")}
							>
								생성
							</Button>
						</div>
					</fieldset>
				)}
				{(createError || categories.error || tags.error) && (
					<p role="alert" className="text-red-500 text-xs">
						{createError ?? categories.error ?? tags.error}
					</p>
				)}
			</fieldset>

			<section
				aria-labelledby="cms-incoming-references-heading"
				className="space-y-3 border-neutral-200 border-t pt-4 dark:border-neutral-800"
			>
				<div className="flex items-center justify-between gap-2">
					<h3
						id="cms-incoming-references-heading"
						className="font-semibold text-neutral-700 text-xs dark:text-neutral-300"
					>
						사용처
					</h3>
					<Button
						type="button"
						variant="outline"
						size="sm"
						aria-label="사용처 새로고침"
						disabled={!entry || isLoadingIncomingReferences}
						onClick={onRefreshIncomingReferences}
						className={actionButton}
					>
						{isLoadingIncomingReferences ? "불러오는 중" : "새로고침"}
					</Button>
				</div>
				{!entry ? (
					<p className="text-neutral-500 text-xs">초안을 저장하면 사용처가 표시됩니다.</p>
				) : incomingReferencesError ? (
					<p role="alert" className="text-red-500 text-xs">
						{incomingReferencesError}
					</p>
				) : incomingReferences.length === 0 ? (
					<p className="text-neutral-500 text-xs">사용 중인 관계가 없습니다.</p>
				) : (
					[
						{ title: "초안에서 사용", references: workingReferences },
						{ title: "현재 공개본에서 사용", references: publishedReferences },
					].map(({ title, references }) =>
						references.length > 0 ? (
							<div key={title} className="space-y-1.5">
								<h4 className="font-medium text-[11px] text-neutral-600 dark:text-neutral-400">{title}</h4>
								<ul className="space-y-2">
									{references.map((reference) => (
										<li
											key={`${reference.state}:${reference.sourceId}:${reference.kind}`}
											className="rounded-md border border-neutral-200 bg-white p-2 text-xs dark:border-neutral-800 dark:bg-neutral-950/50"
										>
											<Link
												href={`/admin/entries/${reference.sourceId}/edit`}
												className="font-medium text-blue-700 hover:underline dark:text-blue-300"
											>
												{reference.sourceTitle || reference.sourceSlug || reference.sourceId}
											</Link>{" "}
											<span className="text-neutral-500">
												{COLLECTION_LABELS[reference.sourceCollection] ?? reference.sourceCollection} ·{" "}
												{REFERENCE_KIND_LABELS[reference.kind]}
											</span>
											{reference.isStale && <span className="ml-1 text-amber-600">대상 변경 확인 필요</span>}
											{reference.occurrences.length > 0 && (
												<ul className="mt-1 space-y-0.5 text-[10px] text-neutral-500">
													{reference.occurrences.map((occurrence) => (
														<li
															key={
																occurrence.type === "mdx"
																	? `mdx:${occurrence.line}:${occurrence.column}`
																	: `metadata:${occurrence.path}:${occurrence.ordinal ?? ""}`
															}
														>
															{occurrence.type === "mdx"
																? `본문 ${occurrence.line}:${occurrence.column}`
																: `${occurrence.path}${occurrence.ordinal === undefined ? "" : ` · ${occurrence.ordinal + 1}번째`}`}
														</li>
													))}
												</ul>
											)}
										</li>
									))}
								</ul>
							</div>
						) : null,
					)
				)}
			</section>
		</div>
	);
}
