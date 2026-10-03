import { definePlugin } from "@bh2980/cms";
import { type PaletteColor, validateTextPalette } from "./colors";
import { colorBlock } from "./definition";

export * from "./colors";
export { colorBlock } from "./definition";

export interface ColorOptions {
	/** 편집기 글자색·배경색 고르기 목록. 없으면 기본 8색(`DEFAULT_TEXT_PALETTE`). 본문에는 헥스 값이 저장된다. */
	readonly palette?: readonly PaletteColor[];
}

/**
 * 글자색·글자 배경색(`:color[글]{fg bg …}`). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [color({ palette: [...] })]
 * ```
 *
 * 편집기에는 서식 도구·글자 버블의 `글자색`이 생긴다. 공개 화면은 사이트가 `Color` 컴포넌트로 그리고(`textColorProps`),
 * 색은 이 패키지의 `styles.css`(`.cms-color`)가 테마에 맞춰 고른다.
 */
export const color = (options: ColorOptions = {}) =>
	definePlugin({
		name: "color",
		options,
		blocks: [colorBlock],
		validate: () => validateTextPalette(options.palette),
		admin: () => import("@bh2980/cms-blocks/color/admin"),
	});
