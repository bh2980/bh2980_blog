"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { IncomingReferenceItem } from "@/cms/adapters/postgres/content-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { slugify } from "./slugify";

export interface CategoryOption {
	id: string;
	title: string;
}

export interface TagOption {
	id: string;
	title: string;
}

interface InspectorPanelProps {
	publishIssues?: CmsIssue[];
	targetEntryId: string | null;
	incomingReferences: IncomingReferenceItem[];
	isLoadingIncomingReferences: boolean;
	incomingReferencesError: string | null;
	onRefreshIncomingReferences: () => void;
	collection: string;
	title: string;
	slug: string;
	isSlugTouched: boolean;
	publishDate: string;
	description: string;
	seoTitle: string;
	seoDescription: string;
	canonicalUrl: string;
	categoryId: string | null;
	tagIds: string[];
	onTitleChange: (title: string) => void;
	onSlugChange: (slug: string) => void;
	onRegenerateSlug: () => void;
	onPublishDateChange: (date: string) => void;
	onDescriptionChange: (desc: string) => void;
	onSeoTitleChange: (value: string) => void;
	onSeoDescriptionChange: (value: string) => void;
	onCanonicalUrlChange: (value: string) => void;
	onCategoryIdChange: (id: string | null) => void;
	onTagIdsChange: (ids: string[]) => void;
}

export function InspectorPanel({
	publishIssues = [],
	targetEntryId,
	incomingReferences,
	isLoadingIncomingReferences,
	incomingReferencesError,
	onRefreshIncomingReferences,
	collection,
	title,
	slug,
	publishDate,
	description,
	seoTitle,
	seoDescription,
	canonicalUrl,
	categoryId,
	tagIds,
	onTitleChange,
	onSlugChange,
	onRegenerateSlug,
	onPublishDateChange,
	onDescriptionChange,
	onSeoTitleChange,
	onSeoDescriptionChange,
	onCanonicalUrlChange,
	onCategoryIdChange,
	onTagIdsChange,
}: InspectorPanelProps) {
	const fieldIssue = (path: string) => publishIssues.find((issue) => issue.path === path);
	const workingReferences = incomingReferences.filter((reference) => reference.state === "working");
	const publishedReferences = incomingReferences.filter((reference) => reference.state === "published");
	const collectionLabels: Record<string, string> = {
		post: "게시글",
		memo: "메모",
		category: "카테고리",
		tag: "태그",
		collection: "모음집",
	};
	const referenceKindLabels = { entry: "글", media: "미디어", category: "카테고리", tag: "태그" };
	const [categories, setCategories] = useState<CategoryOption[]>([]);
	const [allTags, setAllTags] = useState<TagOption[]>([]);
	const [newTagName, setNewTagName] = useState("");
	const [isCreatingTag, setIsCreatingTag] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [isCreatingCategory, setIsCreatingCategory] = useState(false);

	useEffect(() => {
		if (collection === "post") {
			fetch("/api/cms/v1/entries?collection=category&pageSize=100")
				.then((res) => (res.ok ? res.json() : { items: [] }))
				.then((data) => {
					setCategories(
						(data.items || []).map((i: any) => ({
							id: i.id,
							title: i.title || "이름 없음",
						})),
					);
				})
				.catch(() => {});
		}

		if (collection === "post" || collection === "memo") {
			fetch("/api/cms/v1/entries?collection=tag&pageSize=100")
				.then((res) => (res.ok ? res.json() : { items: [] }))
				.then((data) => {
					setAllTags(
						(data.items || []).map((i: any) => ({
							id: i.id,
							title: i.title || "이름 없음",
						})),
					);
				})
				.catch(() => {});
		}
	}, [collection]);

	const handleCreateNewTag = async () => {
		const name = newTagName.trim();
		if (!name) return;
		setIsCreatingTag(true);
		try {
			const res = await fetch("/api/cms/v1/entries", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					collection: "tag",
					slug: slugify(name),
					metadata: { title: name },
					mdx: "",
				}),
			});
			if (res.ok) {
				const created = await res.json();
				const newTag: TagOption = { id: created.id, title: name };
				setAllTags((prev) => [...prev, newTag]);
				onTagIdsChange([...tagIds, created.id]);
				setNewTagName("");
			}
		} finally {
			setIsCreatingTag(false);
		}
	};

	const handleCreateNewCategory = async () => {
		const name = newCategoryName.trim();
		if (!name) return;
		setIsCreatingCategory(true);
		try {
			const res = await fetch("/api/cms/v1/entries", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					collection: "category",
					slug: slugify(name),
					metadata: { title: name },
					mdx: "",
				}),
			});
			if (res.ok) {
				const created = await res.json();
				const newCat: CategoryOption = { id: created.id, title: name };
				setCategories((prev) => [...prev, newCat]);
				onCategoryIdChange(created.id);
				setNewCategoryName("");
			}
		} finally {
			setIsCreatingCategory(false);
		}
	};

	const handleToggleTag = (tagId: string) => {
		if (tagIds.includes(tagId)) {
			onTagIdsChange(tagIds.filter((id) => id !== tagId));
		} else {
			onTagIdsChange([...tagIds, tagId]);
		}
	};

	return (
		<div className="h-full w-full space-y-6 overflow-y-auto border-neutral-200 border-l bg-neutral-50 p-5 text-sm sm:w-80 sm:bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900 sm:dark:bg-neutral-900/30">
			<div className="border-neutral-200 border-b pb-3 dark:border-neutral-800">
				<h3 className="font-bold text-neutral-400 text-xs uppercase tracking-wider">속성 설정</h3>
			</div>

			{/* Title */}
			<div className="space-y-1.5">
				<label htmlFor="cms-title" className="block font-semibold text-neutral-600 text-xs dark:text-neutral-400">
					제목 (Title) <span className="text-red-500">*</span>
				</label>
				<Input
					id="cms-title"
					aria-invalid={Boolean(fieldIssue("title")) || undefined}
					aria-describedby={fieldIssue("title") ? "cms-title-error" : undefined}
					type="text"
					value={title}
					onChange={(e) => onTitleChange(e.target.value)}
					placeholder="글 제목을 입력하세요"
					className="h-auto w-full rounded-md border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm shadow-none outline-none focus:ring-1 focus:ring-blue-500 focus-visible:border-neutral-300 focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus-visible:border-neutral-700"
				/>
				{fieldIssue("title") && (
					<p id="cms-title-error" className="text-red-500 text-xs">
						{cmsIssueMessage(fieldIssue("title")!)}
					</p>
				)}
			</div>

			{/* Slug */}
			<div className="space-y-1.5">
				<div className="flex items-center justify-between">
					<label htmlFor="cms-slug" className="block font-semibold text-neutral-600 text-xs dark:text-neutral-400">
						슬러그 (Slug) <span className="text-red-500">*</span>
					</label>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onRegenerateSlug}
						className="h-auto rounded-none bg-transparent px-0 py-0 text-blue-600 text-xs shadow-none hover:bg-transparent hover:underline focus-visible:ring-blue-500/50 dark:text-blue-400"
					>
						새로고침
					</Button>
				</div>
				<Input
					id="cms-slug"
					aria-invalid={Boolean(fieldIssue("slug")) || undefined}
					aria-describedby={fieldIssue("slug") ? "cms-slug-error" : undefined}
					type="text"
					value={slug}
					onChange={(e) => onSlugChange(e.target.value)}
					placeholder="url-friendly-slug"
					className="h-auto w-full rounded-md border-neutral-300 bg-white px-3 py-2 font-mono text-neutral-900 text-xs shadow-none outline-none focus:ring-1 focus:ring-blue-500 focus-visible:border-neutral-300 focus-visible:ring-1 focus-visible:ring-blue-500 md:text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus-visible:border-neutral-700"
				/>
				{fieldIssue("slug") && (
					<p id="cms-slug-error" className="text-red-500 text-xs">
						{cmsIssueMessage(fieldIssue("slug")!)}
					</p>
				)}
				<p className="text-[11px] text-neutral-500 leading-tight">
					※ 기존 슬러그를 변경해도 이전 주소는 308 영구 리다이렉트로 자동 보존됩니다.
				</p>
			</div>

			{/* Category (Post only) */}
			{collection === "post" && (
				<div className="space-y-1.5">
					<label
						htmlFor="cms-categoryId"
						className="block font-semibold text-neutral-600 text-xs dark:text-neutral-400"
					>
						카테고리 <span className="text-red-500">*</span>
					</label>
					<NativeSelect
						id="cms-categoryId"
						wrapperClassName="w-full"
						aria-invalid={Boolean(fieldIssue("categoryId")) || undefined}
						aria-describedby={fieldIssue("categoryId") ? "cms-categoryId-error" : undefined}
						value={categoryId || ""}
						onChange={(e) => onCategoryIdChange(e.target.value ? e.target.value : null)}
						className="h-auto w-full rounded-md border border-neutral-300 bg-white px-3 py-2 pr-9 text-neutral-900 text-xs shadow-none outline-none focus:ring-1 focus:ring-blue-500 focus-visible:border-neutral-300 focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus-visible:border-neutral-700 dark:hover:bg-neutral-900"
					>
						<option value="">카테고리 선택...</option>
						{categories.map((cat) => (
							<option key={cat.id} value={cat.id}>
								{cat.title}
							</option>
						))}
					</NativeSelect>
					{fieldIssue("categoryId") && (
						<p id="cms-categoryId-error" className="text-red-500 text-xs">
							{cmsIssueMessage(fieldIssue("categoryId")!)}
						</p>
					)}
					{/* Inline Category Creator */}
					<div className="flex items-center gap-1.5 pt-1">
						<Input
							type="text"
							aria-label="새 카테고리 이름"
							value={newCategoryName}
							onChange={(e) => setNewCategoryName(e.target.value)}
							placeholder="새 카테고리 추가"
							className="h-auto min-w-0 flex-1 rounded border-neutral-300 bg-white px-2 py-1 text-neutral-900 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-blue-500 md:text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
						/>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							disabled={isCreatingCategory || !newCategoryName.trim()}
							onClick={handleCreateNewCategory}
							className="h-auto rounded bg-neutral-200 px-2.5 py-1 text-neutral-800 text-xs shadow-none hover:bg-neutral-300 focus-visible:ring-neutral-500/50 disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
						>
							추가
						</Button>
					</div>
				</div>
			)}

			{/* Publish Date */}
			{(collection === "post" || collection === "memo") && (
				<div className="space-y-1.5">
					<label
						htmlFor="cms-publish-date"
						className="block font-semibold text-neutral-600 text-xs dark:text-neutral-400"
					>
						발행 일시 (서울 시간)
					</label>
					<input
						id="cms-publish-date"
						type="datetime-local"
						aria-describedby="cms-publish-date-help"
						value={publishDate}
						onChange={(e) => onPublishDateChange(e.target.value)}
						className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-xs outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
					/>
					<p id="cms-publish-date-help" className="text-[11px] text-neutral-500 dark:text-neutral-400">
						블로그 표시용 날짜입니다. 미래 발행은 위의 예약 기능을 사용하세요.
					</p>
				</div>
			)}

			{/* Description / Summary */}
			<div className="space-y-1.5">
				<label htmlFor="cms-description" className="block font-semibold text-neutral-600 text-xs dark:text-neutral-400">
					요약 (Description)
				</label>
				<textarea
					id="cms-description"
					rows={3}
					value={description}
					onChange={(e) => onDescriptionChange(e.target.value)}
					placeholder="글 목록 및 SEO에 노출될 간단한 소개글"
					className="w-full resize-none rounded-md border border-neutral-300 bg-white p-2.5 text-neutral-900 text-xs outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
				/>
			</div>

			{/* SEO 메타 (M7-FE-2): 비워두면 head가 글 제목·요약으로 폴백한다 */}
			{(collection === "post" || collection === "memo") && (
				<div className="space-y-2 rounded-md border border-neutral-200 p-2.5 dark:border-neutral-800">
					<div className="font-semibold text-neutral-600 text-xs dark:text-neutral-400">SEO</div>

					<div className="space-y-1">
						<label htmlFor="cms-seo-title" className="block text-[11px] text-neutral-500 dark:text-neutral-400">
							검색 제목 <span className="text-neutral-400">(미입력 시 글 제목)</span>
						</label>
						<Input
							id="cms-seo-title"
							type="text"
							value={seoTitle}
							onChange={(e) => onSeoTitleChange(e.target.value)}
							placeholder={title || "글 제목"}
							className="h-auto w-full rounded border-neutral-300 bg-white px-2 py-1.5 text-neutral-900 text-xs shadow-none outline-none focus:ring-1 focus:ring-blue-500 focus-visible:border-neutral-300 focus-visible:ring-1 focus-visible:ring-blue-500 md:text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus-visible:border-neutral-700"
						/>
					</div>

					<div className="space-y-1">
						<label htmlFor="cms-seo-description" className="block text-[11px] text-neutral-500 dark:text-neutral-400">
							검색 설명 <span className="text-neutral-400">(미입력 시 요약)</span>
						</label>
						<textarea
							id="cms-seo-description"
							rows={2}
							value={seoDescription}
							onChange={(e) => onSeoDescriptionChange(e.target.value)}
							placeholder={description || "요약"}
							className="w-full resize-none rounded border border-neutral-300 bg-white p-2 text-neutral-900 text-xs outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
						/>
					</div>

					<div className="space-y-1">
						<label htmlFor="cms-canonical-url" className="block text-[11px] text-neutral-500 dark:text-neutral-400">
							canonical URL
						</label>
						<Input
							id="cms-canonical-url"
							type="text"
							value={canonicalUrl}
							onChange={(e) => onCanonicalUrlChange(e.target.value)}
							placeholder="/posts/slug 또는 https://..."
							className="h-auto w-full rounded border-neutral-300 bg-white px-2 py-1.5 text-neutral-900 text-xs shadow-none outline-none focus:ring-1 focus:ring-blue-500 focus-visible:border-neutral-300 focus-visible:ring-1 focus-visible:ring-blue-500 md:text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus-visible:border-neutral-700"
						/>
						<p className="text-[10px] text-neutral-400">
							값을 넣으면 canonical이 이 주소가 되고 sitemap에서 빠집니다. 사이트 내 경로(/...)와 http(s) 주소만
							반영됩니다.
						</p>
					</div>
				</div>
			)}

			{/* Tag Picker (Post & Memo) */}
			{(collection === "post" || collection === "memo") && (
				<fieldset
					id="cms-tagIds"
					tabIndex={-1}
					aria-invalid={Boolean(fieldIssue("tagIds")) || undefined}
					aria-describedby={fieldIssue("tagIds") ? "cms-tagIds-error" : undefined}
					className="space-y-2"
				>
					<legend className="block font-semibold text-neutral-600 text-xs dark:text-neutral-400">
						태그 선택 (순서 보존)
					</legend>
					{fieldIssue("tagIds") && (
						<p id="cms-tagIds-error" className="text-red-500 text-xs">
							{cmsIssueMessage(fieldIssue("tagIds")!)}
						</p>
					)}

					{/* Selected Tags Chips */}
					<div className="flex min-h-6 flex-wrap gap-1.5">
						{tagIds.length === 0 && <span className="text-neutral-400 text-xs italic">선택된 태그 없음</span>}
						{tagIds.map((id, index) => {
							const matched = allTags.find((t) => t.id === id);
							const name = matched ? matched.title : id.slice(0, 8);
							return (
								<span
									key={id}
									className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700 text-xs dark:border-blue-800/60 dark:bg-blue-950/60 dark:text-blue-300"
								>
									<span className="text-[10px] text-blue-400">{index + 1}.</span>
									<span>{name}</span>
									<button
										type="button"
										onClick={() => handleToggleTag(id)}
										className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
									>
										×
									</button>
								</span>
							);
						})}
					</div>

					{/* All Tags Picker Checklist */}
					{allTags.length > 0 && (
						<div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded border border-neutral-200 bg-white p-1.5 dark:border-neutral-800 dark:bg-neutral-900/50">
							{allTags.map((tag) => {
								const isSelected = tagIds.includes(tag.id);
								return (
									<button
										key={tag.id}
										type="button"
										onClick={() => handleToggleTag(tag.id)}
										className={`rounded px-2 py-0.5 text-xs transition ${
											isSelected
												? "bg-blue-600 font-medium text-white"
												: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
										}`}
									>
										{tag.title}
									</button>
								);
							})}
						</div>
					)}

					{/* Inline Tag Creator */}
					<div className="flex items-center gap-1.5 pt-1">
						<Input
							type="text"
							aria-label="새 태그 이름"
							value={newTagName}
							onChange={(e) => setNewTagName(e.target.value)}
							placeholder="새 태그 생성 후 즉시 추가"
							className="h-auto min-w-0 flex-1 rounded border-neutral-300 bg-white px-2 py-1 text-neutral-900 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-blue-500 md:text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
						/>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							disabled={isCreatingTag || !newTagName.trim()}
							onClick={handleCreateNewTag}
							className="h-auto rounded bg-neutral-200 px-2.5 py-1 text-neutral-800 text-xs shadow-none hover:bg-neutral-300 focus-visible:ring-neutral-500/50 disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
						>
							생성
						</Button>
					</div>
				</fieldset>
			)}

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
						disabled={!targetEntryId || isLoadingIncomingReferences}
						onClick={onRefreshIncomingReferences}
						className="h-auto px-2 py-1 text-xs"
					>
						{isLoadingIncomingReferences ? "불러오는 중" : "새로고침"}
					</Button>
				</div>
				{!targetEntryId ? (
					<p className="text-neutral-500 text-xs">초안을 저장하면 사용처가 표시됩니다.</p>
				) : incomingReferencesError ? (
					<p role="alert" className="text-red-500 text-xs">
						{incomingReferencesError}
					</p>
				) : isLoadingIncomingReferences ? (
					<p aria-live="polite" className="text-neutral-500 text-xs">
						관계 정보를 불러오는 중...
					</p>
				) : incomingReferences.length === 0 ? (
					<p className="text-neutral-500 text-xs">사용 중인 관계가 없습니다.</p>
				) : (
					<div className="space-y-3">
						{[
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
												className="rounded-md border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950/50"
											>
												<div className="flex flex-wrap items-center gap-x-1.5 text-xs">
													<Link
														href={`/admin/entries/${reference.sourceId}/edit` as any}
														className="font-medium text-blue-700 hover:underline dark:text-blue-300"
													>
														{reference.sourceTitle || reference.sourceSlug || reference.sourceId}
													</Link>
													<span className="text-neutral-500">
														{collectionLabels[reference.sourceCollection] || reference.sourceCollection} ·{" "}
														{referenceKindLabels[reference.kind]}
													</span>
													{reference.isStale && (
														<span className="text-amber-600 dark:text-amber-400">대상 변경 확인 필요</span>
													)}
												</div>
												{reference.sourceSlug && (
													<p className="mt-0.5 break-all font-mono text-[10px] text-neutral-500">
														/{reference.sourceSlug}
													</p>
												)}
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
						)}
					</div>
				)}
			</section>
		</div>
	);
}
