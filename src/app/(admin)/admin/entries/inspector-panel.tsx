"use client";

import { useEffect, useState } from "react";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";

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
				<input
					id="cms-title"
					aria-invalid={Boolean(fieldIssue("title")) || undefined}
					aria-describedby={fieldIssue("title") ? "cms-title-error" : undefined}
					type="text"
					value={title}
					onChange={(e) => onTitleChange(e.target.value)}
					placeholder="글 제목을 입력하세요"
					className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
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
					<button
						type="button"
						onClick={onRegenerateSlug}
						className="text-blue-600 text-xs hover:underline dark:text-blue-400"
					>
						새로고침
					</button>
				</div>
				<input
					id="cms-slug"
					aria-invalid={Boolean(fieldIssue("slug")) || undefined}
					aria-describedby={fieldIssue("slug") ? "cms-slug-error" : undefined}
					type="text"
					value={slug}
					onChange={(e) => onSlugChange(e.target.value)}
					placeholder="url-friendly-slug"
					className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-neutral-900 text-xs outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
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
					<select
						id="cms-categoryId"
						aria-invalid={Boolean(fieldIssue("categoryId")) || undefined}
						aria-describedby={fieldIssue("categoryId") ? "cms-categoryId-error" : undefined}
						value={categoryId || ""}
						onChange={(e) => onCategoryIdChange(e.target.value ? e.target.value : null)}
						className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-xs outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
					>
						<option value="">카테고리 선택...</option>
						{categories.map((cat) => (
							<option key={cat.id} value={cat.id}>
								{cat.title}
							</option>
						))}
					</select>
					{fieldIssue("categoryId") && (
						<p id="cms-categoryId-error" className="text-red-500 text-xs">
							{cmsIssueMessage(fieldIssue("categoryId")!)}
						</p>
					)}
					{/* Inline Category Creator */}
					<div className="flex items-center gap-1.5 pt-1">
						<input
							type="text"
							value={newCategoryName}
							onChange={(e) => setNewCategoryName(e.target.value)}
							placeholder="새 카테고리 추가"
							className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
						/>
						<button
							type="button"
							disabled={isCreatingCategory || !newCategoryName.trim()}
							onClick={handleCreateNewCategory}
							className="rounded bg-neutral-200 px-2.5 py-1 text-neutral-800 text-xs hover:bg-neutral-300 disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
						>
							추가
						</button>
					</div>
				</div>
			)}

			{/* Publish Date */}
			<div className="space-y-1.5">
				<label
					htmlFor="cms-publish-date"
					className="block font-semibold text-neutral-600 text-xs dark:text-neutral-400"
				>
					발행 일시
				</label>
				<input
					id="cms-publish-date"
					type="datetime-local"
					value={publishDate}
					onChange={(e) => onPublishDateChange(e.target.value)}
					className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-xs outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
				/>
			</div>

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
						<input
							id="cms-seo-title"
							type="text"
							value={seoTitle}
							onChange={(e) => onSeoTitleChange(e.target.value)}
							placeholder={title || "글 제목"}
							className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-neutral-900 text-xs outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
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
						<input
							id="cms-canonical-url"
							type="text"
							value={canonicalUrl}
							onChange={(e) => onCanonicalUrlChange(e.target.value)}
							placeholder="/posts/slug 또는 https://..."
							className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-neutral-900 text-xs outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
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
						<input
							type="text"
							value={newTagName}
							onChange={(e) => setNewTagName(e.target.value)}
							placeholder="새 태그 생성 후 즉시 추가"
							className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
						/>
						<button
							type="button"
							disabled={isCreatingTag || !newTagName.trim()}
							onClick={handleCreateNewTag}
							className="rounded bg-neutral-200 px-2.5 py-1 text-neutral-800 text-xs hover:bg-neutral-300 disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
						>
							생성
						</button>
					</div>
				</fieldset>
			)}
		</div>
	);
}
