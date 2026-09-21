import { describe, expect, it } from "vitest";
import { formatContentLinkMdx, parseInternalLinkTrigger, type InternalLinkItem } from "./internal-link";

describe("M3-ED-2 Internal Link ([[) Trigger & Format Contract", () => {
	it("detects [[ trigger correctly", () => {
		expect(parseInternalLinkTrigger("Hello world [[").active).toBe(true);
		expect(parseInternalLinkTrigger("Hello world [[").query).toBe("");

		expect(parseInternalLinkTrigger("참조할 글: [[리액트").active).toBe(true);
		expect(parseInternalLinkTrigger("참조할 글: [[리액트").query).toBe("리액트");

		expect(parseInternalLinkTrigger("이미 닫힌 링크 [[완료]]").active).toBe(false);
		expect(parseInternalLinkTrigger("일반 텍스트 [단일 대괄호]").active).toBe(false);
	});

	it("formats ContentLink cleanly for markdown", () => {
		const item: InternalLinkItem = {
			id: "123e4567-e89b-12d3-a456-426614174000",
			collection: "post",
			title: "Next.js 완전 정복",
			slug: "nextjs-guide",
		};

		expect(formatContentLinkMdx(item)).toBe("[Next.js 완전 정복](/entries/123e4567-e89b-12d3-a456-426614174000)");
		expect(formatContentLinkMdx(item, "가이드 보기")).toBe("[가이드 보기](/entries/123e4567-e89b-12d3-a456-426614174000)");
	});
});
