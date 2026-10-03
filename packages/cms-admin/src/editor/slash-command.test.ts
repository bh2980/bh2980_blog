import { describe, expect, it } from "vitest";
import { filterCommands, SLASH_COMMANDS } from "./slash-command";

describe("Slash Menu Commands & Filter Contract", () => {
	it("returns all commands when query is empty", () => {
		expect(filterCommands("")).toHaveLength(SLASH_COMMANDS.length);
	});

	it("filters accurately with English queries", () => {
		const h2Results = filterCommands("h2");
		expect(h2Results.map((c) => c.title)).toEqual(["제목 2"]);
		// 글 제목이 H1이므로 본문 제목 삽입은 H2부터다(§4.1).
		expect(filterCommands("h1")).toHaveLength(0);

		expect(filterCommands("table").some((c) => c.title.includes("표"))).toBe(true);
		expect(filterCommands("todo").some((c) => c.title.includes("체크"))).toBe(true);

		const codeResults = filterCommands("code");
		expect(codeResults.some((c) => c.title.includes("코드"))).toBe(true);
	});

	it("filters accurately with Korean queries", () => {
		const titleResults = filterCommands("제목");
		expect(titleResults.length).toBeGreaterThanOrEqual(3); // H2, H3, H4

		const quoteResults = filterCommands("인용");
		expect(quoteResults.some((c) => c.title.includes("인용구"))).toBe(true);

		const listResults = filterCommands("목록");
		expect(listResults.length).toBeGreaterThanOrEqual(2); // Bullet, Ordered
	});
});
