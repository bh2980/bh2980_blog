import { definePlugin } from "@bh2980/cms";
import { tooltipBlock } from "./definition";

export { tooltipBlock } from "./definition";

/**
 * 툴팁(`:tooltip[글자]{content="설명"}`). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [tooltip()]
 * ```
 *
 * 편집기에는 서식 도구·글자 버블·슬래시 메뉴의 `툴팁`이 생긴다. 공개 화면은 사이트가 `Tooltip` 컴포넌트로 그린다.
 * 코드 블록 안 글자 툴팁(코드 펜스 주석)은 본체 코드 블록 기능이라 이 확장과 따로다.
 */
export const tooltip = () =>
	definePlugin({
		name: "tooltip",
		options: {},
		blocks: [tooltipBlock],
		admin: () => import("@bh2980/cms-blocks/tooltip/admin"),
	});
