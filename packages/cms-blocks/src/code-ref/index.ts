import { definePlugin } from "@bh2980/cms";
import { codeRefBlock } from "./definition";

export { codeRefBlock } from "./definition";

/**
 * 코드 연결(`:code-ref[글자]{to="c1"}`). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [codeRef()]
 * ```
 *
 * 편집기에서는 글자를 고르고 `코드 연결`을 누른 뒤 코드 블록 줄을 고르거나, 코드 블록 줄 메뉴의 `본문 연결`로 시작한다.
 * 줄 이름표(`anchor` 줄 효과)와 잇기 화면은 본체 코드 블록 기능이고, 이 확장은 본문 쪽 꾸밈과 버블을 준다.
 * 공개 화면은 사이트가 `CodeRef` 컴포넌트로 그린다.
 */
export const codeRef = () =>
	definePlugin({
		name: "code-ref",
		options: {},
		blocks: [codeRefBlock],
		admin: () => import("@bh2980/cms-blocks/code-ref/admin"),
	});
