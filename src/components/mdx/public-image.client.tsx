"use client";

import { ImageOff } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";

export function PublicImage({
	src,
	alt,
	decorative,
	style,
}: {
	src: string;
	alt: string;
	decorative?: boolean;
	style?: CSSProperties;
}) {
	const [failed, setFailed] = useState(false);

	if (failed) {
		return (
			<div
				role="img"
				aria-label={decorative ? undefined : "이미지를 표시할 수 없습니다"}
				className="flex h-48 w-full items-center justify-center gap-2 rounded-md border border-slate-300 border-dashed bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
			>
				<ImageOff className="h-5 w-5" aria-hidden />
				{decorative ? null : <span className="text-sm">이미지를 표시할 수 없습니다</span>}
			</div>
		);
	}

	return (
		// biome-ignore lint/performance/noImgElement: the public URL is dynamic and not next/image-compatible
		<img
			alt={decorative ? "" : alt}
			className="h-auto max-w-full rounded-md"
			loading="lazy"
			onError={() => setFailed(true)}
			src={src}
			style={style}
		/>
	);
}
