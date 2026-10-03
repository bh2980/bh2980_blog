"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ImageInsertDialog } from "../../editor/image-insert-dialog";
import { cn } from "../../lib/utils/cn";
import { Button } from "../../ui/button";
import { cmsFetch } from "../admin-api";
import type { FieldInputProps } from "./field-inputs";

/** 미디어 ID → 공개 주소. 입력과 SEO 미리보기가 함께 쓴다. 불러오지 못하면 `null`. */
const urls = new Map<string, string | null>();
const loading = new Set<string>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/** 고른 이미지의 주소를 기억한다. 다시 불러오지 않는다. */
export function rememberMediaUrl(mediaId: string, url: string | null) {
	urls.set(mediaId, url);
	for (const listener of listeners) listener();
}

/** 미디어 ID의 공개 주소. 비었거나 아직 모르거나 불러오지 못하면 `null`. */
export function useMediaUrl(mediaId: string): string | null {
	const url = useSyncExternalStore(
		subscribe,
		() => (mediaId ? urls.get(mediaId) : undefined),
		() => undefined,
	);
	useEffect(() => {
		if (!mediaId || urls.has(mediaId) || loading.has(mediaId)) return;
		loading.add(mediaId);
		cmsFetch<{ publicUrl: string | null }>(`/api/cms/v1/media/${mediaId}`)
			.then((media) => rememberMediaUrl(mediaId, media.publicUrl))
			.catch(() => rememberMediaUrl(mediaId, null))
			.finally(() => loading.delete(mediaId));
	}, [mediaId]);
	return mediaId ? (url ?? null) : null;
}

/** 이미지 미리보기. 주소를 모르면 아이콘을 보인다. */
export function MediaThumbnail({ mediaId, className }: { mediaId: string; className?: string }) {
	const url = useMediaUrl(mediaId);
	return url ? (
		// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
		<img src={url} alt="" className={cn("object-cover", className)} />
	) : (
		<div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
			<ImageIcon aria-hidden className="size-4" />
		</div>
	);
}

/**
 * 미디어 ID를 저장하는 텍스트 필드의 입력. 역할이 `ogImage`인 필드의 기본 입력이다.
 * 미디어 라이브러리에서 이미지를 고르고, 고른 이미지를 작게 보여 준다.
 */
export function MediaImageInput({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const [picking, setPicking] = useState(false);
	const mediaId = typeof value === "string" ? value : "";
	return (
		<>
			<div className="flex items-center gap-1.5">
				{mediaId && <MediaThumbnail mediaId={mediaId} className="aspect-[1.91/1] h-7 shrink-0 rounded border" />}
				<Button
					id={id}
					type="button"
					size="sm"
					variant="outline"
					className="h-7 flex-1 text-xs"
					disabled={context.disabled}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					onClick={() => setPicking(true)}
				>
					{mediaId ? "바꾸기" : "이미지 고르기"}
				</Button>
				{mediaId && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="h-7 text-xs"
						disabled={context.disabled}
						onClick={() => onChange("")}
					>
						빼기
					</Button>
				)}
			</div>
			<ImageInsertDialog
				open={picking}
				initialFile={null}
				mode="pick"
				title={field.label}
				onClose={() => setPicking(false)}
				onInsert={(image) => {
					rememberMediaUrl(image.mediaId, image.publicUrl);
					onChange(image.mediaId);
					setPicking(false);
				}}
			/>
		</>
	);
}
