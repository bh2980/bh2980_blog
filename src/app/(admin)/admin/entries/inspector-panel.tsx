"use client";

import { slugify } from "./slugify";

interface InspectorPanelProps {
	title: string;
	slug: string;
	isSlugTouched: boolean;
	publishDate: string;
	description: string;
	tags: string;
	onTitleChange: (title: string) => void;
	onSlugChange: (slug: string) => void;
	onRegenerateSlug: () => void;
	onPublishDateChange: (date: string) => void;
	onDescriptionChange: (desc: string) => void;
	onTagsChange: (tags: string) => void;
}

export function InspectorPanel({
	title,
	slug,
	publishDate,
	description,
	tags,
	onTitleChange,
	onSlugChange,
	onRegenerateSlug,
	onPublishDateChange,
	onDescriptionChange,
	onTagsChange,
}: InspectorPanelProps) {
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
			</div>

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

			{/* Tags */}
			<div className="space-y-1.5">
				<label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
					태그 (쉼표로 구분)
				</label>
				<input
					type="text"
					value={tags}
					onChange={(e) => onTagsChange(e.target.value)}
					placeholder="React, Next.js, Architecture"
					className="w-full text-xs px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>
		</div>
	);
}
