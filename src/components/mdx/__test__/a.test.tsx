import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { a as Anchor } from "../a";

/**
 * M7-SEC-1 P2: `javascript:` 같은 스킴이 공개 앵커로 나가지 않아야 한다.
 * 레거시 49편의 링크는 `https:`와 `/`뿐이라 이 제한이 기존 본문을 깨지 않는다.
 */
describe("공개 앵커 스킴 제한", () => {
	it("javascript: 링크는 href 없이 텍스트로만 남긴다", () => {
		const html = renderToStaticMarkup(<Anchor href="javascript:alert(1)">본문</Anchor>);

		expect(html).not.toContain("javascript:");
		expect(html).not.toContain("href");
		expect(html).toContain("본문");
	});

	it("data: 링크도 링크로 만들지 않는다", () => {
		expect(renderToStaticMarkup(<Anchor href="data:text/html,x">본문</Anchor>)).not.toContain("href");
	});

	it("프로토콜 상대 //host도 링크로 만들지 않는다", () => {
		expect(renderToStaticMarkup(<Anchor href="//evil.example/a">본문</Anchor>)).not.toContain("href");
	});

	it("역슬래시가 섞인 /\\host도 링크로 만들지 않는다", () => {
		// 브라우저는 `\`를 `/`로 보므로 `/\evil.example`은 `//evil.example`과 같다.
		expect(renderToStaticMarkup(<Anchor href="/\\evil.example">본문</Anchor>)).not.toContain("href");
	});

	it("http(s) 링크는 새 창으로 연다", () => {
		const html = renderToStaticMarkup(<Anchor href="https://example.com/a">본문</Anchor>);

		expect(html).toContain('href="https://example.com/a"');
		expect(html).toContain('target="_blank"');
		expect(html).toContain("noopener");
	});

	it("사이트 상대 경로와 # 앵커는 일반 링크로 렌더한다", () => {
		expect(renderToStaticMarkup(<Anchor href="/posts/a">본문</Anchor>)).toContain('href="/posts/a"');
		expect(renderToStaticMarkup(<Anchor href="#section">본문</Anchor>)).toContain('href="#section"');
	});
});
