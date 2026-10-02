"use client";

import { resolveImageUrl } from "@bh2980/cms/mdx/image-src";
import { computeImageTransform } from "@bh2980/cms/mdx/image-transform";
import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, Crop, Settings2, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/utils/cn";
import { type SlotRequest, useSlot } from "../slots/slots";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Separator } from "../ui/separator";
import { ImageCropDialog } from "./image-crop-dialog";

/** §4.3 너비 입력: 1~100% 또는 4096 이하의 양의 정수 px. 빈 값은 본문에 맞춤이다. */
export const isValidImageWidth = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return true;
	const percent = /^(\d{1,3})%$/.exec(trimmed);
	if (percent) return Number(percent[1]) >= 1 && Number(percent[1]) <= 100;
	const px = /^(\d{1,4})(px)?$/.exec(trimmed);
	return Boolean(px) && Number(px?.[1]) >= 1 && Number(px?.[1]) <= 4096;
};

const normalizeWidth = (value: string) => {
	const trimmed = value.trim();
	return /^\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
};

/** 이미지 앞뒤의 본문 글자(자리 동작이 이미지를 글 흐름 안에서 설명할 때 쓴다). */
const AROUND_CHARS = 1500;
function surroundingText(editor: NodeViewProps["editor"], getPos: NodeViewProps["getPos"], nodeSize: number): string {
	const pos = typeof getPos === "function" ? getPos() : undefined;
	if (!editor || typeof pos !== "number") return "";
	const doc = editor.state.doc;
	const before = doc.textBetween(Math.max(0, pos - AROUND_CHARS), pos, "\n", " ");
	const after = doc.textBetween(pos + nodeSize, Math.min(doc.content.size, pos + nodeSize + AROUND_CHARS), "\n", " ");
	return `${before.trim()}\n[이미지]\n${after.trim()}`;
}

export function CmsImageNodeView({ node, updateAttributes, deleteNode, selected, editor, getPos }: NodeViewProps) {
	const widthInputId = useId();
	const altInputId = useId();
	const widthErrorId = useId();
	/** AI 자리 구분값. 노드 뷰가 살아 있는 동안 같다(같은 이미지를 두 번 넣어도 따로다). */
	const slotScope = useId();
	const { src, alt, width, align, caption, mediaId, decorative, crop, rotate } = node.attrs;
	const [isEditing, setIsEditing] = useState(false);
	const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
	const [previewWidth, setPreviewWidth] = useState<string | null>(null);
	const [aspectRatio, setAspectRatio] = useState<number | null>(null);
	const [widthDraft, setWidthDraft] = useState<string>(width || "");
	useEffect(() => setWidthDraft(width || ""), [width]);
	const widthInvalid = !isValidImageWidth(widthDraft);
	const activeResizeCleanupRef = useRef<(() => void) | null>(null);
	useEffect(() => {
		return () => {
			activeResizeCleanupRef.current?.();
		};
	}, []);
	// 노드 뷰는 항상 편집기 안에서 그려지지만, 편집기 없이 그리는 경우(미리보기·테스트)도 막지 않는다.
	const isEditable = editor?.isEditable ?? true;
	/** 본문 이미지 자리(alt·캡션). 서버는 미디어 라이브러리 이미지와 이 사이트 주소(`/images/...`)의 이미지를 읽는다. */
	const siteSrc = typeof src === "string" && src.startsWith("/") && !src.startsWith("//") ? src : undefined;
	const imageSlot = (target: "alt" | "caption"): SlotRequest => ({
		slot: "image",
		target,
		scope: slotScope,
		disabled: !isEditable || (!mediaId && !siteSrc),
		getContext: () => ({
			mediaId: typeof mediaId === "string" ? mediaId : undefined,
			imageSrc: typeof mediaId === "string" ? undefined : siteSrc,
			around: surroundingText(editor, getPos, node.nodeSize),
			current: (target === "alt" ? alt : caption) || undefined,
		}),
		apply: (value) => updateAttributes(target === "alt" ? { alt: value, decorative: null } : { caption: value }),
	});
	const altSlot = useSlot(imageSlot("alt"));
	const captionSlot = useSlot(imageSlot("caption"));
	const [mediaState, setMediaState] = useState<{ status: string; publicUrl: string | null } | null>(null);

	const transform = computeImageTransform({
		crop,
		rotate,
		aspectRatio,
	});

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
	// 공개 화면(CmsImage)과 같게 캡션을 이미지 정렬 쪽에 맞춘다.
	const captionAlignClass =
		{
			left: "text-left",
			center: "text-center",
			right: "text-right",
		}[align as "left" | "center" | "right"] || "text-center";

	// 모서리(좌·우 아래) 핸들 드래그로 너비 조절 (c-editor.md §1.1)
	const handleResizeStart = (e: React.PointerEvent, handle: "left" | "right") => {
		if (!isEditable) return;
		e.preventDefault();
		e.stopPropagation();

		const figure = (e.currentTarget as HTMLElement).closest("figure");
		if (!figure) return;

		activeResizeCleanupRef.current?.();

		const startX = e.clientX;
		const initialRect = figure.getBoundingClientRect();
		const parentRect = figure.parentElement?.getBoundingClientRect() ?? initialRect;
		const startWidth = initialRect.width;
		const parentWidth = parentRect.width || initialRect.width;
		const isPercent = typeof width === "string" && width.trim().endsWith("%");
		let currentPreview = width || `${Math.round(startWidth)}px`;
		let hasMoved = false;

		const onPointerMove = (moveEvent: PointerEvent) => {
			const delta = handle === "right" ? moveEvent.clientX - startX : startX - moveEvent.clientX;
			if (Math.abs(delta) >= 2) {
				hasMoved = true;
			}
			const newWidth = Math.max(20, startWidth + delta);
			if (isPercent) {
				const percent = Math.min(100, Math.max(1, Math.round((newWidth / parentWidth) * 100)));
				currentPreview = `${percent}%`;
			} else {
				const px = Math.min(4096, Math.max(20, Math.round(newWidth)));
				currentPreview = `${px}px`;
			}
			setPreviewWidth(currentPreview);
			setWidthDraft(currentPreview);
		};

		const cleanup = () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			activeResizeCleanupRef.current = null;
		};

		const onPointerUp = () => {
			cleanup();
			setPreviewWidth(null);
			// 이동 없이 클릭만 한 경우 커밋하지 않는다(P1-4: 너비 미지정 이미지 보존).
			if (hasMoved && currentPreview && currentPreview !== (width || null) && isValidImageWidth(currentPreview)) {
				updateAttributes({ width: normalizeWidth(currentPreview) });
			}
		};

		const onPointerCancel = () => {
			cleanup();
			setPreviewWidth(null);
			setWidthDraft(width || "");
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		activeResizeCleanupRef.current = cleanup;
	};

	// TipTap v3는 노드 뷰의 첫 자식이 `data-node-view-wrapper`를 가져야 한다.
	// 그 속성을 넣는 것이 `NodeViewWrapper`이고, 빠지면 "Please use the NodeViewWrapper
	// component for your node view"로 런타임에 터진다(이미지 있는 글에서 발생).
	return (
		<NodeViewWrapper
			as="figure"
			data-image-block
			className={cn(
				// 편집기 본문(prose)의 img 위아래 2em 여백이 회색 상자 안에 빈 띠로 보이지 않게 한다.
				"group relative my-6 flex flex-col rounded-lg transition-all [&_img]:m-0",
				alignClasses,
				selected && "ring-2 ring-ring",
			)}
			style={{ width: previewWidth || width || "100%", maxWidth: "100%" }}
		>
			{/* Image Controls Overlay */}
			<div
				hidden={!isEditable}
				className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border bg-popover/90 p-1 opacity-0 shadow-sm backdrop-blur transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-aria-expanded:opacity-100"
			>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-label="이미지 왼쪽 정렬"
					aria-pressed={align === "left"}
					className={cn("size-7 p-0", align === "left" && "bg-accent")}
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
					className={cn("size-7 p-0", align === "center" && "bg-accent")}
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
					className={cn("size-7 p-0", align === "right" && "bg-accent")}
					onClick={() => updateAttributes({ align: "right" })}
				>
					<AlignRight className="h-3.5 w-3.5" />
				</Button>
				<Separator orientation="vertical" className="mx-0.5 data-vertical:h-4" />
				<Popover open={isEditing} onOpenChange={setIsEditing}>
					<PopoverTrigger
						render={<Button type="button" variant="ghost" size="sm" aria-label="이미지 설정" className="size-7 p-0" />}
					>
						<Settings2 className="size-3.5" />
					</PopoverTrigger>
					<PopoverContent align="end" className="flex w-72 flex-col gap-3 p-3 text-xs">
						<div className="flex flex-col gap-1">
							<Label htmlFor={widthInputId} className="text-muted-foreground text-xs">
								너비
							</Label>
							<Input
								id={widthInputId}
								value={widthDraft}
								aria-invalid={widthInvalid || undefined}
								aria-describedby={widthInvalid ? widthErrorId : undefined}
								onChange={(e) => {
									setWidthDraft(e.target.value);
									if (isValidImageWidth(e.target.value)) {
										updateAttributes({ width: e.target.value.trim() ? normalizeWidth(e.target.value) : null });
									}
								}}
								className="h-7 text-xs"
								placeholder="본문 맞춤"
							/>
							{widthInvalid && (
								<p id={widthErrorId} className="text-destructive">
									1~100% 또는 1~4096px로 입력하세요.
								</p>
							)}
						</div>
						<div className="flex flex-col gap-1">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor={altInputId} className="text-muted-foreground text-xs">
									대체 텍스트
								</Label>
								{decorative !== true && altSlot.trigger}
							</div>
							<Input
								id={altInputId}
								value={alt || ""}
								disabled={decorative === true}
								aria-invalid={(!decorative && !alt) || undefined}
								onChange={(e) => updateAttributes({ alt: e.target.value })}
								className="h-7 text-xs"
								placeholder="이미지 설명"
							/>
							{altSlot.panel}
							<Label className="font-normal text-xs">
								<Checkbox
									checked={decorative === true}
									onCheckedChange={(checked) =>
										updateAttributes(checked === true ? { decorative: true, alt: "" } : { decorative: null })
									}
								/>
								장식 이미지
							</Label>
						</div>
					</PopoverContent>
				</Popover>
				{canRender && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						aria-label="이미지 자르기 및 회전"
						className="size-7 p-0"
						onClick={() => setIsCropDialogOpen(true)}
					>
						<Crop className="size-3.5" />
					</Button>
				)}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-label="이미지 삭제"
					className="size-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
					onClick={() => deleteNode()}
				>
					<Trash2 aria-hidden />
				</Button>
			</div>

			{/* Actual Image */}
			{canRender ? (
				transform.isTransformed ? (
					<div
						data-slot="image-transform-wrapper"
						className="relative w-full max-w-full overflow-hidden rounded-md bg-muted"
						style={{
							width: previewWidth || width || "100%",
							maxWidth: "100%",
							...transform.wrapperStyle,
						}}
					>
						{/* biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic and not next/image-compatible */}
						<img
							src={resolved && "url" in resolved ? resolved.url : ""}
							alt={alt || ""}
							className="rounded-md"
							onLoad={(e) => {
								const { naturalWidth, naturalHeight } = e.currentTarget;
								if (naturalWidth > 0 && naturalHeight > 0) {
									setAspectRatio(naturalWidth / naturalHeight);
								}
							}}
							style={transform.imageStyle}
						/>
					</div>
				) : (
					<div className="relative overflow-hidden rounded-md bg-muted">
						{/* biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic and not next/image-compatible */}
						<img
							src={resolved && "url" in resolved ? resolved.url : ""}
							alt={alt || ""}
							className="h-auto w-full rounded-md object-contain"
							onLoad={(e) => {
								const { naturalWidth, naturalHeight } = e.currentTarget;
								if (naturalWidth > 0 && naturalHeight > 0) {
									setAspectRatio(naturalWidth / naturalHeight);
								}
							}}
						/>
					</div>
				)
			) : (
				<div className="flex h-48 w-full items-center justify-center rounded-md bg-muted text-muted-foreground text-sm">
					이미지를 불러올 수 없습니다
				</div>
			)}
			{resolveReason ? <p className="mt-1 text-center text-destructive text-xs">{resolveReason}</p> : null}

			{/* Caption Input / Display */}
			<figcaption className={cn("mt-2 flex items-center gap-1", captionAlignClass)}>
				<Input
					type="text"
					value={caption || ""}
					placeholder="캡션 입력..."
					aria-label="이미지 캡션"
					readOnly={!isEditable}
					onChange={(e) => updateAttributes({ caption: e.target.value })}
					className={cn(
						"h-auto w-full rounded-none border-0 bg-transparent px-0 py-0 text-muted-foreground text-xs shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0 md:text-xs dark:bg-transparent",
						captionAlignClass,
					)}
				/>
				{isEditable && captionSlot.trigger}
			</figcaption>
			{captionSlot.panel && <div className="mt-1 text-left">{captionSlot.panel}</div>}

			{/* 모서리(좌·우 아래) 너비 조절 핸들 */}
			{isEditable && (
				<>
					<button
						type="button"
						data-slot="resize-handle-left"
						aria-label="이미지 너비 조절 핸들 (좌측 하단)"
						onPointerDown={(e) => handleResizeStart(e, "left")}
						className="absolute -bottom-1 -left-1 z-20 size-3 cursor-ew-resize rounded-sm border border-border bg-background p-0 opacity-0 shadow-sm transition-opacity hover:scale-125 group-focus-within:opacity-100 group-hover:opacity-100"
					/>
					<button
						type="button"
						data-slot="resize-handle-right"
						aria-label="이미지 너비 조절 핸들 (우측 하단)"
						onPointerDown={(e) => handleResizeStart(e, "right")}
						className="absolute -right-1 -bottom-1 z-20 size-3 cursor-ew-resize rounded-sm border border-border bg-background p-0 opacity-0 shadow-sm transition-opacity hover:scale-125 group-focus-within:opacity-100 group-hover:opacity-100"
					/>
				</>
			)}

			{/* 자르기 및 회전 대화상자 */}
			{canRender && (
				<ImageCropDialog
					open={isCropDialogOpen}
					onOpenChange={setIsCropDialogOpen}
					src={resolved && "url" in resolved ? resolved.url : ""}
					crop={crop}
					rotate={rotate}
					onApply={({ crop: nextCrop, rotate: nextRotate }) => {
						updateAttributes({ crop: nextCrop, rotate: nextRotate });
					}}
				/>
			)}
		</NodeViewWrapper>
	);
}
