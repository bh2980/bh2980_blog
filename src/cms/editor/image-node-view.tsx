"use client";

import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { resolveImageUrl } from "@/cms/mdx/image-src";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CmsImageNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
	const widthInputId = useId();
	const altInputId = useId();
	const { src, alt, width, align, caption, mediaId } = node.attrs;
	const [isEditing, setIsEditing] = useState(false);
	const [mediaState, setMediaState] = useState<{ status: string; publicUrl: string | null } | null>(null);

	useEffect(() => {
		if (!mediaId || src) {
			setMediaState(null);
			return;
		}
		let cancelled = false;
		setMediaState({ status: "checking", publicUrl: null });
		fetch(`/api/cms/v1/media/${encodeURIComponent(mediaId)}`)
			.then(async (response) => {
				if (!response.ok) throw new Error("media_lookup_failed");
				return (await response.json()) as { status?: string; publicUrl?: string | null };
			})
			.then((result) => {
				if (!cancelled) setMediaState({ status: result.status ?? "unknown", publicUrl: result.publicUrl ?? null });
			})
			.catch(() => {
				if (!cancelled) setMediaState({ status: "lookup-failed", publicUrl: null });
			});
		return () => {
			cancelled = true;
		};
	}, [mediaId, src]);

	const imageSrc = typeof src === "string" && src ? src : mediaState?.publicUrl;
	const resolved = resolveImageUrl(typeof imageSrc === "string" ? imageSrc : undefined);
	const canRender = resolved !== null && "url" in resolved;
	const resolveReason = canRender
		? null
		: src
			? "허용되지 않는 이미지 주소입니다"
			: !mediaId
				? "이미지 주소가 없습니다"
				: mediaState?.status === "checking"
					? "미디어 상태를 확인하는 중입니다"
					: mediaState?.status === "pending"
						? "미디어가 아직 준비되지 않았습니다"
						: mediaState?.status === "failed"
							? "미디어 업로드에 실패했습니다"
							: mediaState?.status === "missing"
								? "미디어 파일을 찾을 수 없습니다"
								: mediaState?.status === "lookup-failed"
									? "미디어 상태를 확인할 수 없습니다"
									: "미디어 주소를 해석할 수 없습니다";

	const alignClasses =
		{
			left: "mr-auto",
			center: "mx-auto",
			right: "ml-auto",
		}[align as "left" | "center" | "right"] || "mx-auto";

	// TipTap v3는 노드 뷰의 첫 자식이 `data-node-view-wrapper`를 가져야 한다.
	// 그 속성을 넣는 것이 `NodeViewWrapper`이고, 빠지면 "Please use the NodeViewWrapper
	// component for your node view"로 런타임에 터진다(이미지 있는 글에서 발생).
	return (
		<NodeViewWrapper
			as="figure"
			data-image-block
			className={`group relative my-6 flex flex-col rounded-lg transition-all ${alignClasses} ${
				selected ? "ring-2 ring-blue-500" : ""
			}`}
			style={{ width: width || "100%", maxWidth: "100%" }}
		>
			{/* Image Controls Overlay */}
			<div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border border-neutral-200 bg-white/90 p-1 opacity-0 shadow-sm backdrop-blur transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 dark:border-neutral-800 dark:bg-neutral-900/90">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-label="이미지 왼쪽 정렬"
					aria-pressed={align === "left"}
					className={`h-7 w-7 p-0 ${align === "left" ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
					onClick={() => updateAttributes({ align: "left" })}
				>
					<AlignLeft className="h-3.5 w-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-label="이미지 가운데 정렬"
					aria-pressed={align === "center"}
					className={`h-7 w-7 p-0 ${align === "center" ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
					onClick={() => updateAttributes({ align: "center" })}
				>
					<AlignCenter className="h-3.5 w-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-label="이미지 오른쪽 정렬"
					aria-pressed={align === "right"}
					className={`h-7 w-7 p-0 ${align === "right" ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
					onClick={() => updateAttributes({ align: "right" })}
				>
					<AlignRight className="h-3.5 w-3.5" />
				</Button>
				<div className="mx-0.5 h-4 w-[1px] bg-neutral-200 dark:border-neutral-800" />
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-expanded={isEditing}
					aria-label={`이미지 너비 설정 (${width || "100%"})`}
					className="h-7 px-1.5 text-xs"
					onClick={() => setIsEditing(!isEditing)}
				>
					{width || "100%"}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-label="이미지 삭제"
					className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
					onClick={() => deleteNode()}
				>
					<Trash2 className="h-3.5 w-3.5" />
				</Button>
			</div>

			{/* Dimension / Alt Quick Form Popover */}
			{isEditing && (
				<div className="absolute top-12 right-2 z-20 flex w-64 flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
					<div className="flex flex-col gap-1">
						<label htmlFor={widthInputId} className="font-medium text-neutral-600 dark:text-neutral-400">
							너비 (예: 100%, 600px)
						</label>
						<Input
							id={widthInputId}
							value={width || "100%"}
							onChange={(e) => updateAttributes({ width: e.target.value })}
							className="h-7 text-xs"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label htmlFor={altInputId} className="font-medium text-neutral-600 dark:text-neutral-400">
							대체 텍스트 (Alt)
						</label>
						<Input
							id={altInputId}
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
					<img
						src={resolved && "url" in resolved ? resolved.url : ""}
						alt={alt || ""}
						className="h-auto w-full rounded-md object-contain"
					/>
				) : (
					<div className="flex h-48 w-full items-center justify-center text-neutral-400 text-sm">
						이미지를 불러올 수 없습니다
					</div>
				)}
			</div>
			{resolveReason ? (
				<p className="mt-1 text-center text-red-500 text-xs dark:text-red-400">{resolveReason}</p>
			) : null}

			{/* Caption Input / Display */}
			<figcaption className="mt-2 text-center">
				<input
					type="text"
					value={caption || ""}
					placeholder="캡션 입력..."
					onChange={(e) => updateAttributes({ caption: e.target.value })}
					className="w-full border-none bg-transparent text-center text-neutral-500 text-xs placeholder:text-neutral-300 focus:outline-none focus:ring-0 dark:text-neutral-400 dark:placeholder:text-neutral-600"
				/>
			</figcaption>
		</NodeViewWrapper>
	);
}
