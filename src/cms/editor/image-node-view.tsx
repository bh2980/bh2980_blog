"use client";

import { useState } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from "lucide-react";
import { resolveImageUrl } from "@/cms/mdx/image-src";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CmsImageNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
	const { src, alt, width, align, caption, mediaId } = node.attrs;
	const [isEditing, setIsEditing] = useState(false);
	const resolved = resolveImageUrl(typeof src === "string" ? src : undefined);
	const canRender = resolved !== null && "url" in resolved;
	const resolveReason = !src
		? mediaId
			? "미디어가 아직 준비되지 않았거나 주소를 해석할 수 없습니다"
			: "이미지 주소가 없습니다"
		: resolved && "failure" in resolved
			? "허용되지 않는 이미지 주소입니다"
			: null;

	const alignClasses = {
		left: "mr-auto",
		center: "mx-auto",
		right: "ml-auto",
	}[align as "left" | "center" | "right"] || "mx-auto";

	return (
		<figure
			data-image-block
			className={`my-6 flex flex-col group relative rounded-lg transition-all ${alignClasses} ${
				selected ? "ring-2 ring-blue-500" : ""
			}`}
			style={{ width: width || "100%", maxWidth: "100%" }}
		>
			{/* Image Controls Overlay */}
			<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border border-neutral-200 dark:border-neutral-800 rounded-md p-1 shadow-sm z-10">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={`h-7 w-7 p-0 ${align === "left" ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
					onClick={() => updateAttributes({ align: "left" })}
				>
					<AlignLeft className="h-3.5 w-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={`h-7 w-7 p-0 ${align === "center" ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
					onClick={() => updateAttributes({ align: "center" })}
				>
					<AlignCenter className="h-3.5 w-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={`h-7 w-7 p-0 ${align === "right" ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
					onClick={() => updateAttributes({ align: "right" })}
				>
					<AlignRight className="h-3.5 w-3.5" />
				</Button>
				<div className="w-[1px] h-4 bg-neutral-200 dark:border-neutral-800 mx-0.5" />
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 px-1.5 text-xs"
					onClick={() => setIsEditing(!isEditing)}
				>
					{width || "100%"}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
					onClick={() => deleteNode()}
				>
					<Trash2 className="h-3.5 w-3.5" />
				</Button>
			</div>

			{/* Dimension / Alt Quick Form Popover */}
			{isEditing && (
				<div className="absolute top-12 right-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 shadow-lg z-20 flex flex-col gap-2 w-64 text-xs">
					<div className="flex flex-col gap-1">
						<label className="font-medium text-neutral-600 dark:text-neutral-400">너비 (예: 100%, 600px)</label>
						<Input
							value={width || "100%"}
							onChange={(e) => updateAttributes({ width: e.target.value })}
							className="h-7 text-xs"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label className="font-medium text-neutral-600 dark:text-neutral-400">대체 텍스트 (Alt)</label>
						<Input
							value={alt || ""}
							onChange={(e) => updateAttributes({ alt: e.target.value })}
							className="h-7 text-xs"
							placeholder="이미지 설명"
						/>
					</div>
				</div>
			)}

			{/* Actual Image */}
			<div className="relative overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
				{canRender ? (
					// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic and not next/image-compatible
					<img src={src} alt={alt || ""} className="w-full h-auto object-contain rounded-md" />
				) : (
					<div className="w-full h-48 flex items-center justify-center text-neutral-400 text-sm">
						이미지를 불러올 수 없습니다
					</div>
				)}
			</div>
			{resolveReason ? (
				<p className="mt-1 text-center text-xs text-red-500 dark:text-red-400">{resolveReason}</p>
			) : null}

			{/* Caption Input / Display */}
			<figcaption className="mt-2 text-center">
				<input
					type="text"
					value={caption || ""}
					placeholder="캡션 입력..."
					onChange={(e) => updateAttributes({ caption: e.target.value })}
					className="w-full text-center text-xs text-neutral-500 dark:text-neutral-400 bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
				/>
			</figcaption>
		</figure>
	);
}
