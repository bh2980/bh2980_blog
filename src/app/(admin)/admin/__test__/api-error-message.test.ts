import { describe, expect, it } from "vitest";
import { cmsApiErrorMessage, cmsApiIssues, cmsIssueMessage } from "../api-error-message";

describe("M10 publish feedback", () => {
	it("keeps field paths for inline validation", () => {
		const payload = {
			issues: [
				{ code: "missing_title", path: "title" },
				{ code: "missing_category", path: "categoryId" },
			],
		};
		expect(cmsApiIssues(payload)).toEqual(payload.issues);
		expect(cmsApiErrorMessage(payload, "실패")).toContain("제목을 입력하세요. (title)");
		expect(cmsIssueMessage(payload.issues[1])).toContain("카테고리");
	});

	it("formats body position and image warnings with readable labels", () => {
		expect(cmsIssueMessage({ code: "mdx_error", position: { line: 4, column: 7 } })).toBe(
			"MDX 본문 구문을 확인하세요. (4행 7열)",
		);
		expect(cmsIssueMessage({ code: "image_media_not_ready", position: { line: 2, column: 1 } })).toBe(
			"이미지가 아직 준비되지 않았습니다. (2행 1열)",
		);
	});
});
