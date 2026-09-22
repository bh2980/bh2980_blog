import { describe, expect, it } from "vitest";
import { renderMDX } from "../mdx-content";

/**
 * M7-SEC-1 조건 3: 검증을 통과하지 못한 MDX는 실행 컴파일러(`compileMDX`)에 들어가면 안 된다.
 * 저장·발행 게이트를 지나온 본문이라도 렌더 입구에서 한 번 더 막는다(fail-closed).
 */
describe("공개 렌더 컴파일러 게이트", () => {
	it("analyze 오류가 있는 MDX는 컴파일하지 않는다", async () => {
		await expect(renderMDX("<Callout>")).rejects.toThrow(/MDX validation failed/);
	});

	it("이벤트 핸들러 속성이 있는 MDX도 컴파일하지 않는다", async () => {
		await expect(renderMDX('<Callout onclick="x">a</Callout>')).rejects.toThrow(/MDX validation failed/);
	});

	it("등록되지 않은 JSX는 analyze가 거부하지 않는다(알려진 한계, M8 안건)", async () => {
		// `REGISTERED_JSX_NAMES`는 정의만 되고 analyze에서 쓰이지 않는다.
		// 이 경우 공개 렌더는 React 단계에서 실패한다 → 발행 전 차단 규칙이 필요하다.
		await expect(renderMDX("<UnknownComponent />")).resolves.toBeTruthy();
	});

	it("정상 MDX는 그대로 컴파일한다", async () => {
		const { content, toc } = await renderMDX(["## 제목", "", "본문 **강조**"].join("\n"));

		expect(content).toBeTruthy();
		expect(toc.length).toBeGreaterThan(0);
	});
});
