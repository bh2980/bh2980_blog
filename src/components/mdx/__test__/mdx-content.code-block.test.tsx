import type { ReactNode } from "react";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderMDX } from "../mdx-content";

/**
 * M7-TW-1 / D3-1: `pre` shim을 실제 RSC 렌더 경로로 재검증한다.
 *
 * `pre`는 async 서버 컴포넌트라서 `renderToStaticMarkup`으로는 “suspended” 예외로 실패한다.
 * M6 점검 러너는 이때 동기 스텁(`PreShim`)으로 갈아 끼워 통과시켰기 때문에 **실제 `pre`가 렌더된 적이 없었다**.
 * 여기서는 스트리밍 렌더로 실제 컴포넌트를 통과시킨다. 전환 후 공개 본문 렌더가 유일한 출력 경로다.
 */
async function renderServerComponent(element: ReactNode): Promise<string> {
	const stream = await renderToReadableStream(element);
	await stream.allReady;

	return await new Response(stream).text();
}

const fenced = (...lines: string[]) => lines.join("\n");

describe("renderMDX 코드 블록 실제 렌더 (D3-1)", () => {
	it("pre는 동기 렌더로는 실패하고 스트리밍 렌더에서 실제 마크업을 낸다", async () => {
		const { content } = await renderMDX(fenced('```ts title="demo.ts" showLineNumbers', "const a = 1;", "```"));

		// 스텁 없이 통과시킬 수 없다는 사실 자체를 고정한다(이 테스트가 D3-1의 근거다).
		expect(() => renderToStaticMarkup(content)).toThrow(/suspend/i);

		const html = await renderServerComponent(content);

		expect(html).toContain('data-title="demo.ts"');
		expect(html).toContain('data-show-line-numbers="true"');
		expect(html).toContain("<pre");
		expect(html).toContain("const");
		// fence 원문이 그대로 노출되지 않는다.
		expect(html).not.toContain("```");
	});

	it("파일 경로 meta가 제목 표시줄로 렌더된다", async () => {
		const { content } = await renderMDX(fenced('```ts title="src/libs/example.ts"', "export const a = 1;", "```"));
		const html = await renderServerComponent(content);

		expect(html).toContain("src");
		expect(html).toContain("libs");
		expect(html).toContain("example.ts");
	});

	it("meta가 없으면 제목 표시줄과 줄번호 표시가 없다", async () => {
		const { content } = await renderMDX(fenced("```ts", "const a = 1;", "```"));
		const html = await renderServerComponent(content);

		// 주의: CopyButton className의 `peer-data-title:` 문자열에 걸리지 않도록 속성 형태로 본다.
		expect(html).not.toContain('data-title="');
		expect(html).not.toContain('data-show-line-numbers="true"');
		expect(html).toContain("const");
	});

	it("복사 버튼이 렌더되고 코드 본문이 하이라이팅되어 실린다", async () => {
		const { content } = await renderMDX(fenced('```ts title="copy.ts"', "const copied = 42;", "```"));
		const html = await renderServerComponent(content);

		expect(html).toContain('aria-label="클립보드에 복사하기"');
		// 하이라이팅 결과는 토큰별 span으로 쪼개져 실린다(원문 복사용 text prop은 클라이언트 prop이라 HTML에 없다).
		expect(html).toContain('<span class="line">');
		expect(html).toContain("copied");
		expect(html).toContain("42</span>");
	});

	it("언어를 알 수 없는 fence도 렌더가 깨지지 않는다", async () => {
		const { content } = await renderMDX(fenced("```", "plain text", "```"));

		await expect(renderServerComponent(content)).resolves.toContain("plain text");
	});
});
