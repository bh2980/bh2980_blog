"use client";

import { useEffect, useState } from "react";
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
		<div className="w-80 h-full border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 overflow-y-auto p-5 space-y-6 text-sm">
			<div className="border-b border-neutral-200 dark:border-neutral-800 pb-3">
				<h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">속성 설정</h3>
			</div>

			{/* Title */}
			<div className="space-y-1.5">
				<label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
					제목 (Title) <span className="text-red-500">*</span>
				</label>
				<input
					type="text"
					value={title}
					onChange={(e) => onTitleChange(e.target.value)}
					placeholder="글 제목을 입력하세요"
					className="w-full text-sm px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			{/* Slug */}
			<div className="space-y-1.5">
				<div className="flex justify-between items-center">
					<label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
						슬러그 (Slug) <span className="text-red-500">*</span>
					</label>
					<button
						type="button"
						onClick={onRegenerateSlug}
						className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
					>
						새로고침
					</button>
				</div>
				<input
					type="text"
					value={slug}
					onChange={(e) => onSlugChange(e.target.value)}
					placeholder="url-friendly-slug"
					className="w-full font-mono text-xs px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
				/>
				<p className="text-[11px] text-neutral-500 leading-tight">
					※ 기존 슬러그를 변경해도 이전 주소는 308 영구 리다이렉트로 자동 보존됩니다.
				</p>
			</div>

			{/* Category (Post only) */}
			{collection === "post" && (
				<div className="space-y-1.5">
					<label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
						카테고리 <span className="text-red-500">*</span>
					</label>
					<select
						value={categoryId || ""}
						onChange={(e) => onCategoryIdChange(e.target.value ? e.target.value : null)}
						className="w-full text-xs px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
					>
						<option value="">카테고리 선택...</option>
						{categories.map((cat) => (
							<option key={cat.id} value={cat.id}>
								{cat.title}
							</option>
						))}
					</select>
					{/* Inline Category Creator */}
					<div className="flex items-center gap-1.5 pt-1">
						<input
							type="text"
							value={newCategoryName}
							onChange={(e) => setNewCategoryName(e.target.value)}
							placeholder="새 카테고리 추가"
							className="flex-1 text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
						/>
						<button
							type="button"
							disabled={isCreatingCategory || !newCategoryName.trim()}
							onClick={handleCreateNewCategory}
							className="text-xs px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 disabled:opacity-40"
						>
							추가
						</button>
					</div>
				</div>
			)}

			{/* Publish Date */}
			<div className="space-y-1.5">
				<label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
					발행 일시
				</label>
				<input
					type="datetime-local"
					value={publishDate}
					onChange={(e) => onPublishDateChange(e.target.value)}
					className="w-full text-xs px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			{/* Description / Summary */}
			<div className="space-y-1.5">
				<label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
					요약 (Description)
				</label>
				<textarea
					rows={3}
					value={description}
					onChange={(e) => onDescriptionChange(e.target.value)}
					placeholder="글 목록 및 SEO에 노출될 간단한 소개글"
					className="w-full text-xs p-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none resize-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			{/* SEO 메타 (M7-FE-2): 비워두면 head가 글 제목·요약으로 폴백한다 */}
			{(collection === "post" || collection === "memo") && (
				<div className="space-y-2 rounded-md border border-neutral-200 dark:border-neutral-800 p-2.5">
					<div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">SEO</div>

					<div className="space-y-1">
						<label className="block text-[11px] text-neutral-500 dark:text-neutral-400">
							검색 제목 <span className="text-neutral-400">(미입력 시 글 제목)</span>
						</label>
						<input
							type="text"
							value={seoTitle}
							onChange={(e) => onSeoTitleChange(e.target.value)}
							placeholder={title || "글 제목"}
							className="w-full text-xs px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					<div className="space-y-1">
						<label className="block text-[11px] text-neutral-500 dark:text-neutral-400">
							검색 설명 <span className="text-neutral-400">(미입력 시 요약)</span>
						</label>
						<textarea
							rows={2}
							value={seoDescription}
							onChange={(e) => onSeoDescriptionChange(e.target.value)}
							placeholder={description || "요약"}
							className="w-full text-xs p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none resize-none focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					<div className="space-y-1">
						<label className="block text-[11px] text-neutral-500 dark:text-neutral-400">canonical URL</label>
						<input
							type="text"
							value={canonicalUrl}
							onChange={(e) => onCanonicalUrlChange(e.target.value)}
							placeholder="/posts/slug 또는 https://..."
							className="w-full text-xs px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
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
				<div className="space-y-2">
					<label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
						태그 선택 (순서 보존)
					</label>

					{/* Selected Tags Chips */}
					<div className="flex flex-wrap gap-1.5 min-h-6">
						{tagIds.length === 0 && (
							<span className="text-xs text-neutral-400 italic">선택된 태그 없음</span>
						)}
						{tagIds.map((id, index) => {
							const matched = allTags.find((t) => t.id === id);
							const name = matched ? matched.title : id.slice(0, 8);
							return (
								<span
									key={id}
									className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300"
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
						<div className="max-h-32 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded p-1.5 flex flex-wrap gap-1 bg-white dark:bg-neutral-900/50">
							{allTags.map((tag) => {
								const isSelected = tagIds.includes(tag.id);
								return (
									<button
										key={tag.id}
										type="button"
										onClick={() => handleToggleTag(tag.id)}
										className={`text-xs px-2 py-0.5 rounded transition ${
											isSelected
												? "bg-blue-600 text-white font-medium"
												: "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
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
							className="flex-1 text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
						/>
						<button
							type="button"
							disabled={isCreatingTag || !newTagName.trim()}
							onClick={handleCreateNewTag}
							className="text-xs px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 disabled:opacity-40"
						>
							생성
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
