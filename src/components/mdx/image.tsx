import { cn } from "@/utils/cn";

/**
 * `::image{...}` 리프 directive의 공개 렌더러.
 *
 * **해석 실패 계약(§4.4, A3 확정):** 캡션만 남기고 `width`·`align`은 적용하지 않는다.
 * `alt` 글자로 대체하지 않는다 — 문서 의미가 조용히 바뀌고 장식 이미지는 대체할 alt가 없다.
 *
 * 비차단 경고 대상(발행 전 검사가 알린다)은 **정상 데이터에서 실제로 발생하는 3가지**뿐이다:
 * ① 미디어 행은 있으나 `ready` 아님 ② `ready`인데 R2 객체 해석 실패 ③ 외부 `src`가 허용 규칙에 걸림.
 * 미디어 행이 아예 없는 경우는 `entry_references`의 FK·CHECK와 발행 검사가 먼저 막으므로 여기서 다루지 않는다.
 *
 * DB를 이 컴포넌트에서 직접 읽지 않는다. 주소 해석은 **호출자가 주입하는 resolver**의 책임이다.
 */

export type ImageResolveFailure =
	/** 미디어 행은 있는데 업로드가 `ready`가 아니다. */
	| "not-ready"
	/** 미디어 행은 `ready`인데 객체(R2)를 해석하지 못했다. */
	| "unresolved"
	/** 허용되지 않는 주소다(`javascript:` 등). */
	| "rejected";

export type ImageResolveResult = { url: string } | { failure: ImageResolveFailure };

export type ImageResolver = (input: { mediaId?: string; src?: string }) => ImageResolveResult;

/** 절대 http(s) 또는 사이트 상대 경로만 통과시킨다. 실행 가능한 URL(`javascript:`, `data:`)은 거부한다. */
export const resolveImageUrl = (src: string | undefined): ImageResolveResult | null => {
	const trimmed = src?.trim();
	if (!trimmed) return null;
	// `//host/path`는 프로토콜 상대 주소라 사이트 상대 경로로 취급하지 않는다.
	if (trimmed.startsWith("//")) return { failure: "rejected" };
	if (/^https?:\/\//i.test(trimmed)) return { url: trimmed };
	if (trimmed.startsWith("/")) return { url: trimmed };
	return { failure: "rejected" };
};

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
