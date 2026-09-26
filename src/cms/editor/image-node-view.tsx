"use client";

import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { resolveImageUrl } from "@/cms/mdx/image-src";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/utils/cn";

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

export function CmsImageNodeView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
	const widthInputId = useId();
	const altInputId = useId();
	const widthErrorId = useId();
	const { src, alt, width, align, caption, mediaId, decorative } = node.attrs;
	const [isEditing, setIsEditing] = useState(false);
	const [widthDraft, setWidthDraft] = useState<string>(width || "");
	useEffect(() => setWidthDraft(width || ""), [width]);
	const widthInvalid = !isValidImageWidth(widthDraft);
	// 노드 뷰는 항상 편집기 안에서 그려지지만, 편집기 없이 그리는 경우(미리보기·테스트)도 막지 않는다.
	const isEditable = editor?.isEditable ?? true;
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
			className={cn(
				"group relative my-6 flex flex-col rounded-lg transition-all",
				alignClasses,
				selected && "ring-2 ring-ring",
			)}
			style={{ width: width || "100%", maxWidth: "100%" }}
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
						render={
							<Button
								type="button"
								variant="ghost"
								size="sm"
								aria-label={`이미지 너비 설정 (${width || "100%"})`}
								className="h-7 px-1.5 text-xs"
							/>
						}
					>
						{width || "100%"}
					</PopoverTrigger>
					<PopoverContent align="end" className="flex w-64 flex-col gap-3 p-3 text-xs">
						<div className="flex flex-col gap-1">
							<Label htmlFor={widthInputId} className="text-muted-foreground text-xs">
								너비 (1~100% 또는 4096px 이하, 비우면 본문 맞춤)
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
							/>
							{widthInvalid && (
								<p id={widthErrorId} className="text-destructive">
									1~100% 또는 1~4096px로 입력하세요.
								</p>
							)}
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor={altInputId} className="text-muted-foreground text-xs">
								대체 텍스트 (Alt)
							</Label>
							<Input
								id={altInputId}
								value={alt || ""}
								disabled={decorative === true}
								aria-invalid={(!decorative && !alt) || undefined}
								onChange={(e) => updateAttributes({ alt: e.target.value })}
								className="h-7 text-xs"
								placeholder="이미지 설명"
							/>
							<Label className="font-normal text-xs">
								<Checkbox
									checked={decorative === true}
									onCheckedChange={(checked) =>
										updateAttributes(checked === true ? { decorative: true, alt: "" } : { decorative: null })
									}
								/>
								장식 이미지 (빈 alt로 저장)
							</Label>
						</div>
					</PopoverContent>
				</Popover>
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
			<div className="relative overflow-hidden rounded-md bg-muted">
				{canRender ? (
					// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic and not next/image-compatible
					<img
						src={resolved && "url" in resolved ? resolved.url : ""}
						alt={alt || ""}
						className="h-auto w-full rounded-md object-contain"
					/>
				) : (
					<div className="flex h-48 w-full items-center justify-center text-muted-foreground text-sm">
						이미지를 불러올 수 없습니다
					</div>
				)}
			</div>
			{resolveReason ? <p className="mt-1 text-center text-destructive text-xs">{resolveReason}</p> : null}

			{/* Caption Input / Display */}
			<figcaption className="mt-2 text-center">
				<Input
					type="text"
					value={caption || ""}
					placeholder="캡션 입력..."
					aria-label="이미지 캡션"
					readOnly={!isEditable}
					onChange={(e) => updateAttributes({ caption: e.target.value })}
					className="h-auto w-full rounded-none border-0 bg-transparent px-0 py-0 text-center text-muted-foreground text-xs shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0 md:text-xs dark:bg-transparent"
				/>
			</figcaption>
		</NodeViewWrapper>
	);
}
