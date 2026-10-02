"use client";

import { computeImageTransform, intrinsicDisplayWidth } from "@bh2980/cms/mdx/image-transform";
import { ImageOff } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { useTranslate } from "@/libs/i18n/use-locale";

export function PublicImage({
	src,
	alt,
	decorative,
	style,
	crop,
	rotate,
	title,
	intrinsicSize,
}: {
	src: string;
	alt: string;
	/** Markdown 이미지의 제목(`![alt](src "제목")`). 브라우저 도움말로 보인다. */
	title?: string;
	decorative?: boolean;
	style?: CSSProperties;
	crop?: string;
	rotate?: string | number;
	/** 서버가 아는 원본 픽셀 크기. 로드 전 비율 자리를 잡아 레이아웃 이동을 막는다. */
	intrinsicSize?: { width: number; height: number };
}) {
	const [failed, setFailed] = useState(false);
	const [natural, setNatural] = useState<{ width: number; height: number } | null>(intrinsicSize ?? null);
	const readNaturalSize = (image: HTMLImageElement) => {
		const { naturalWidth, naturalHeight } = image;
		if (naturalWidth <= 0 || naturalHeight <= 0) return;
		setNatural((current) =>
			current?.width === naturalWidth && current.height === naturalHeight
				? current
				: { width: naturalWidth, height: naturalHeight },
		);
	};
	const aspectRatio = natural ? natural.width / natural.height : null;
	const { t } = useTranslate();

	const transform = computeImageTransform({
		crop,
		rotate,
		aspectRatio,
	});

	if (failed) {
		return (
			<div
				role="img"
				aria-label={decorative ? undefined : t("mdx.imageUnavailable")}
				className="flex h-48 w-full items-center justify-center gap-2 rounded-md border border-slate-300 border-dashed bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
			>
				<ImageOff className="h-5 w-5" aria-hidden />
				{decorative ? null : <span className="text-sm">{t("mdx.imageUnavailable")}</span>}
			</div>
		);
	}

	if (transform.isTransformed) {
		// 너비를 지정하지 않았으면 변환 없는 이미지처럼 원본 크기(보이는 영역)로, 부모보다 넓으면 부모 폭으로 보인다.
		const intrinsic = intrinsicDisplayWidth(transform, natural);
		const width = style?.width ?? (intrinsic ? `${intrinsic}px` : "100%");
		return (
			<div
				data-slot="image-transform-wrapper"
				className="relative max-w-full overflow-hidden rounded-md"
				style={{
					...style,
					width,
					maxWidth: "100%",
					...transform.wrapperStyle,
				}}
			>
				{/* biome-ignore lint/performance/noImgElement: the public URL is dynamic and not next/image-compatible */}
				<img
					alt={decorative ? "" : alt}
					className="rounded-md"
					loading="lazy"
					onError={() => setFailed(true)}
					onLoad={(e) => readNaturalSize(e.currentTarget)}
					ref={(image) => {
						// 캐시된 이미지는 hydration 전에 load가 끝나 onLoad가 누락될 수 있다.
						if (image?.complete) readNaturalSize(image);
					}}
					src={src}
					style={transform.imageStyle}
					title={title}
				/>
			</div>
		);
	}

	return (
		// biome-ignore lint/performance/noImgElement: the public URL is dynamic and not next/image-compatible
		<img
			alt={decorative ? "" : alt}
			className="h-auto max-w-full rounded-md"
			height={intrinsicSize?.height}
			loading="lazy"
			onError={() => setFailed(true)}
			src={src}
			style={style}
			title={title}
			width={intrinsicSize?.width}
		/>
	);
}
