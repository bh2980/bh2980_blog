import { ImageOff } from "lucide-react";
import { type ImageResolver, resolveImageUrl } from "@/cms/mdx/image-src";
import { cn } from "@/utils/cn";
import { PublicImage } from "./public-image.client";

/**
 * `::image{...}` 리프 directive의 공개 렌더러.
 *
 * **해석 실패 계약(§4.4, A3 확정):** 중립 플레이스홀더와 캡션을 남기고 `width`·`align`은 적용하지 않는다.
 * 내부 실패 사유는 공개 화면에 노출하지 않는다. `alt` 글자로 대체하지 않는다 — 문서 의미가 조용히 바뀌고 장식 이미지는 대체할 alt가 없다.
 *
 * 허용 규칙과 실패 종류는 `@/cms/mdx/image-src`가 단일 원천이다 — 발행 전 검사가 같은 함수로 경고를 만든다.
 * DB를 이 컴포넌트에서 직접 읽지 않는다. 주소 해석은 **호출자가 주입하는 resolver**의 책임이다.
 */

/** `width`는 백분율만 받는다(`60%`). 그 밖의 값은 무시한다. */
const PERCENT = /^\d{1,3}(?:\.\d+)?%$/;

const ALIGN_CLASS: Record<string, string> = {
	left: "items-start",
	center: "items-center",
	right: "items-end",
};

export const CmsImage = ({
	mediaId,
	src,
	alt,
	width,
	align,
	caption,
	decorative,
	resolve,
	className,
}: {
	mediaId?: string;
	src?: string;
	alt?: string;
	width?: string;
	align?: string;
	caption?: string;
	decorative?: boolean;
	/** 없으면 외부 `src`만 해석한다(`resolveImageUrl`). */
	resolve?: ImageResolver;
	className?: string;
}) => {
	const resolved = resolve ? resolve({ mediaId, src }) : resolveImageUrl(src);
	const url = resolved && "url" in resolved ? resolved.url : null;
	const captionText = caption?.trim();
	const captionClassName = "text-center text-slate-500 text-sm dark:text-slate-400";

	// 해석 실패: 장식 이미지는 캡션만 남긴다. 본문 이미지는 중립 플레이스홀더와 캡션을 남긴다.
	// 내부 사유·alt 대체·width·align 적용은 하지 않는다.
	if (decorative) {
		return captionText ? <p className={cn("my-6", captionClassName, className)}>{captionText}</p> : null;
	}
	if (!url) {
		return (
			<figure className={cn("my-6 flex flex-col items-center gap-2", className)}>
				<div
					role="img"
					aria-label="이미지를 표시할 수 없습니다"
					className={cn(
						"flex h-48 w-full items-center justify-center gap-2 rounded-md border border-dashed",
						"border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500",
					)}
				>
					<ImageOff className="h-5 w-5" aria-hidden />
					<span className="text-sm">이미지를 표시할 수 없습니다</span>
				</div>
				{captionText ? <figcaption className={captionClassName}>{captionText}</figcaption> : null}
			</figure>
		);
	}

	const figureClassName = cn("my-6 flex flex-col gap-2", ALIGN_CLASS[align ?? ""] ?? "items-center", className);
	const widthStyle = width && PERCENT.test(width) ? { width } : undefined;

	return (
		<figure className={figureClassName}>
			<PublicImage src={url} alt={alt ?? ""} decorative={decorative} style={widthStyle} />
			{captionText ? <figcaption className={captionClassName}>{captionText}</figcaption> : null}
		</figure>
	);
};
