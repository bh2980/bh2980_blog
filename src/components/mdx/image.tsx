import { type ImageResolver, resolveImageUrl } from "@/cms/mdx/image-src";
import { cn } from "@/utils/cn";

/**
 * `::image{...}` 리프 directive의 공개 렌더러.
 *
 * **해석 실패 계약(§4.4, A3 확정):** 캡션만 남기고 `width`·`align`은 적용하지 않는다.
 * `alt` 글자로 대체하지 않는다 — 문서 의미가 조용히 바뀌고 장식 이미지는 대체할 alt가 없다.
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

	// 해석 실패: 캡션만 남긴다. alt 대체도, width·align 적용도 하지 않는다.
	if (!url) {
		return captionText ? <p className={cn("my-6", captionClassName, className)}>{captionText}</p> : null;
	}

	const figureClassName = cn("my-6 flex flex-col gap-2", ALIGN_CLASS[align ?? ""] ?? "items-center", className);
	const widthStyle = width && PERCENT.test(width) ? { width } : undefined;

	return (
		<figure className={figureClassName}>
			{/* biome-ignore lint/performance/noImgElement: 미디어 저장소가 만든 동적 주소라 next/image의 정적 최적화 대상이 아니다. */}
			<img
				alt={decorative ? "" : (alt ?? "")}
				className="h-auto max-w-full rounded-md"
				loading="lazy"
				src={url}
				style={widthStyle}
			/>
			{captionText ? <figcaption className={captionClassName}>{captionText}</figcaption> : null}
		</figure>
	);
};
