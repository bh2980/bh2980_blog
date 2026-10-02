import type { ReactNode } from "react";
import { TEXT_ALIGN_VALUES } from "@/cms/mdx/directives";
import { cn } from "@/utils/cn";

/**
 * `:::text-align{align="..."}` 컨테이너의 공개 렌더러.
 *
 * 공개 출력은 **검증된 값 → 고정 클래스 맵**이다(A4). directive의 `align` 값을 className·style에
 * 그대로 넣지 않는다. 저장소가 허용하는 값은 `left`·`center`·`right`뿐이고 `justify`는 쓰지 않는다.
 *
 * Tiptap 확장은 내부적으로 `style="text-align: …"`를 쓰지만 그건 편집기 표현이고,
 * 공개 렌더는 이 컴포넌트가 담당한다.
 */
const ALIGN_CLASS: Record<(typeof TEXT_ALIGN_VALUES)[number], string> = {
	left: "text-left",
	center: "text-center",
	right: "text-right",
};

const isAlignValue = (value: string | undefined): value is (typeof TEXT_ALIGN_VALUES)[number] =>
	TEXT_ALIGN_VALUES.some((allowed) => allowed === value);

export const TextAlign = ({
	align,
	className,
	children,
}: {
	align?: string;
	className?: string;
	children?: ReactNode;
}) => {
	// 허용하지 않는 값은 무시한다(기본 정렬). 발행 전 검사가 필수·허용 값을 다룬다(M8-TW-1).
	const alignClass = isAlignValue(align) ? ALIGN_CLASS[align] : undefined;

	return <div className={cn(alignClass, className)}>{children}</div>;
};
