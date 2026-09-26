"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useId, useState } from "react";
import type { IncomingReferenceItem } from "@/cms/adapters/postgres/content-store";
import { MultiCombobox } from "@/components/multi-combobox";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
	Field as UiField,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatSeoulDateTimeInput } from "@/libs/contents/published-at";
import { cn } from "@/utils/cn";
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

const fieldClass = "h-8 text-xs md:text-xs";

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
		<UiField data-invalid={Boolean(issue) || undefined} className="gap-1.5">
			<FieldLabel htmlFor={id} className="font-semibold text-muted-foreground text-xs">
				{label} {required && <span className="text-destructive">*</span>}
			</FieldLabel>
			{children}
			{issue && <FieldError id={`${id}-error`}>{cmsIssueMessage(issue)}</FieldError>}
			{help && <FieldDescription className="text-[11px] leading-tight">{help}</FieldDescription>}
		</UiField>
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
					<Button type="button" variant="link" size="xs" className="ml-1" onClick={() => onChange(null)}>
						해제
					</Button>
				)}
			</p>
			<FieldLabel htmlFor={searchId} className="sr-only">
				대체 글 검색
			</FieldLabel>
			<Input
				id={searchId}
				value={search}
				disabled={disabled}
				placeholder="공개된 글 제목 검색"
				onChange={(event) => setSearch(event.target.value)}
				className={fieldClass}
			/>
			{results.length > 0 && (
				<ul className="max-h-32 overflow-y-auto rounded-md border text-xs">
					{results.map((result) => (
						<li key={result.id}>
							<Button
								type="button"
								variant="ghost"
								size="xs"
								className="w-full justify-start"
								onClick={() => {
									onChange(result.id);
									setSearch("");
								}}
							>
								{result.title}
							</Button>
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

	const actionButton = "h-7 px-2 text-xs";
	const categoryItems = [
		{ value: "", label: "카테고리 선택..." },
		...categories.options.map((option) => ({ value: option.id, label: option.title })),
	];

	return (
		<div className="h-full w-full space-y-5 overflow-y-auto border-l bg-background px-5 py-4 text-sm lg:w-80">
			<div className="flex h-7 items-center justify-between">
				<h2 className="font-medium text-muted-foreground text-xs">속성</h2>
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
						<p className="break-all text-muted-foreground">
							공개 주소: /{collection === "memo" ? "memos" : "posts"}/{entry.publishedSlug}
						</p>
					)}
					<div className="flex flex-wrap gap-1.5">
						{previewHref && (
							<a
								href={previewHref}
								target="_blank"
								rel="noreferrer"
								className={cn(buttonVariants({ variant: "outline", size: "sm" }), actionButton)}
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
								className={`${actionButton} text-destructive`}
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
						className="h-9 text-sm"
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
						<Select
							value={form.categoryId ?? ""}
							items={categoryItems}
							onValueChange={(value) => onChange({ categoryId: typeof value === "string" && value ? value : null })}
						>
							<SelectTrigger
								id="cms-categoryId"
								size="sm"
								className="w-full"
								aria-invalid={Boolean(issueFor("categoryId")) || undefined}
								aria-describedby={describedBy("categoryId")}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{categoryItems.map((option) => (
									<SelectItem key={option.value || "none"} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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
						<Select
							value={form.policy}
							items={POLICY_OPTIONS}
							onValueChange={(value) => value && onChange({ policy: value as EntryForm["policy"] })}
						>
							<SelectTrigger id="cms-policy" size="sm" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{POLICY_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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
						<Input
							id="cms-publishedAt"
							type="datetime-local"
							aria-describedby={describedBy("publishedAt")}
							value={form.publishDate}
							max={formatSeoulDateTimeInput(new Date())}
							onChange={(event) => onChange({ publishDate: event.target.value })}
							className={fieldClass}
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
						<Textarea
							id="cms-summary"
							rows={3}
							value={form.summary}
							onChange={(event) => onChange({ summary: event.target.value })}
							placeholder="목록과 검색 결과에 보일 소개글"
							className="min-h-16 resize-none text-xs md:text-xs"
						/>
					</Field>
				)}

				{isContent && (
					<FieldSet className="gap-3 rounded-md border p-2.5">
						<FieldLegend variant="label" className="px-1 font-semibold text-muted-foreground text-xs">
							SEO
						</FieldLegend>
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
							<Textarea
								id="cms-seoDescription"
								rows={2}
								value={form.seoDescription}
								onChange={(event) => onChange({ seoDescription: event.target.value })}
								className="min-h-12 resize-none text-xs md:text-xs"
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
					</FieldSet>
				)}

				{isContent && (
					<fieldset
						id="cms-tagIds"
						tabIndex={-1}
						aria-invalid={Boolean(issueFor("tagIds")) || undefined}
						aria-describedby={describedBy("tagIds")}
						className="space-y-2"
					>
						<legend className="font-semibold text-muted-foreground text-xs">태그 (고른 순서 보존)</legend>
						{issueFor("tagIds") && (
							<FieldError id="cms-tagIds-error">{cmsIssueMessage(issueFor("tagIds") as CmsIssue)}</FieldError>
						)}
						<MultiCombobox
							aria-label="태그"
							placeholder="태그 검색·선택"
							emptyText="일치하는 태그가 없습니다. 아래에서 새로 만드세요."
							options={[
								...tags.options.map((tag) => ({ value: tag.id, label: tag.title })),
								// 목록에 아직 없는 선택값(방금 만든 태그 등)도 칩으로 보이게 한다.
								...form.tagIds
									.filter((id) => !tags.options.some((tag) => tag.id === id))
									.map((id) => ({ value: id, label: id.slice(0, 8) })),
							]}
							value={form.tagIds}
							onValueChange={(tagIds) => onChange({ tagIds })}
						/>
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
					<p role="alert" className="text-destructive text-xs">
						{createError ?? categories.error ?? tags.error}
					</p>
				)}
			</fieldset>

			<Separator />
			<section aria-labelledby="cms-incoming-references-heading" className="space-y-3">
				<div className="flex items-center justify-between gap-2">
					<h3 id="cms-incoming-references-heading" className="font-semibold text-xs">
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
					<p className="text-muted-foreground text-xs">초안을 저장하면 사용처가 표시됩니다.</p>
				) : incomingReferencesError ? (
					<p role="alert" className="text-destructive text-xs">
						{incomingReferencesError}
					</p>
				) : incomingReferences.length === 0 ? (
					<p className="text-muted-foreground text-xs">사용 중인 관계가 없습니다.</p>
				) : (
					[
						{ title: "초안에서 사용", references: workingReferences },
						{ title: "현재 공개본에서 사용", references: publishedReferences },
					].map(({ title, references }) =>
						references.length > 0 ? (
							<div key={title} className="space-y-1.5">
								<h4 className="font-medium text-[11px] text-muted-foreground">{title}</h4>
								<ul className="space-y-2">
									{references.map((reference) => (
										<li
											key={`${reference.state}:${reference.sourceId}:${reference.kind}`}
											className="rounded-md border bg-background p-2 text-xs"
										>
											<Link
												href={`/admin/entries/${reference.sourceId}/edit`}
												className="font-medium text-primary hover:underline"
											>
												{reference.sourceTitle || reference.sourceSlug || reference.sourceId}
											</Link>{" "}
											<span className="text-muted-foreground">
												{COLLECTION_LABELS[reference.sourceCollection] ?? reference.sourceCollection} ·{" "}
												{REFERENCE_KIND_LABELS[reference.kind]}
											</span>
											{reference.isStale && (
												<span className="ml-1 text-amber-700 dark:text-amber-400">대상 변경 확인 필요</span>
											)}
											{reference.occurrences.length > 0 && (
												<ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
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
