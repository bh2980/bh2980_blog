import { Mark, mergeAttributes } from "@tiptap/core";
import { cleanTextColor, TEXT_COLOR_ATTRS, textColorProps } from "../core/text-colors";

export const COLOR_MARK_NAME = "cmsColor";

/**
 * 글자색·글자 배경색(`:color[글]{fg bg …}`). 속성은 헥스 값이고, 밝은·어두운 테마 짝을 CSS 변수로 넘겨
 * `.cms-color`(globals.css)가 테마에 맞는 값을 고른다. 색 뒤에 이어 친 글자는 색을 이어받지 않는다.
 */
export const CmsColorMark = Mark.create({
	name: COLOR_MARK_NAME,
	inclusive: false,
	addAttributes() {
		return Object.fromEntries(
			TEXT_COLOR_ATTRS.map((name) => [
				name,
				{
					default: null,
					parseHTML: (element: HTMLElement) => element.getAttribute(`data-color-${name.toLowerCase()}`),
					// 속성마다 따로 그리지 않고 아래 `renderHTML`에서 한꺼번에 그린다.
					renderHTML: () => ({}),
				},
			]),
		);
	},
	parseHTML() {
		return [{ tag: "span[data-cms-color]" }];
	},
	renderHTML({ mark, HTMLAttributes }) {
		const attrs = cleanTextColor(mark.attrs);
		const { className, style, ...data } = textColorProps(attrs);
		return [
			"span",
			mergeAttributes(HTMLAttributes, {
				"data-cms-color": "",
				...Object.fromEntries(
					TEXT_COLOR_ATTRS.flatMap((name) => (attrs[name] ? [[`data-color-${name.toLowerCase()}`, attrs[name]]] : [])),
				),
				...data,
				class: className,
				style: Object.entries(style)
					.map(([key, value]) => `${key}: ${value}`)
					.join("; "),
			}),
			0,
		];
	},
});
