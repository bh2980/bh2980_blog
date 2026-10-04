import { cleanTextColor, textColorProps } from "@monti-cms/blocks/color";
import type { PropsWithChildren } from "react";

/** 글자색·글자 배경색(`:color[글]{fg bg …}`). 잘못된 값은 버리고, 색이 없으면 글만 그린다. */
export function Color({ children, ...attrs }: PropsWithChildren<Record<string, unknown>>) {
	const { className, style, ...data } = textColorProps(cleanTextColor(attrs));
	return (
		<span className={className} style={style} {...data}>
			{children}
		</span>
	);
}
