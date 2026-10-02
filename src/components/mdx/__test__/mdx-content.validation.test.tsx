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

	it("등록되지 않은 JSX는 analyze가 거부한다(M8-TW-1)", async () => {
		// 배치 4에서 `REGISTERED_JSX_NAMES`를 analyze에 배선했다(무음 손실 방지).
		await expect(renderMDX("<UnknownComponent />")).rejects.toThrow(/MDX validation failed/);
		await expect(renderMDX("<ContentLink />")).rejects.toThrow(/MDX validation failed/);
	});

	it("정상 MDX는 그대로 컴파일한다", async () => {
		const { content, toc } = await renderMDX(["## 제목", "", "본문 **강조**"].join("\n"));

		expect(content).toBeTruthy();
		expect(toc.length).toBeGreaterThan(0);
	});
});
