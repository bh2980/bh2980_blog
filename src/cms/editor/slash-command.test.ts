import { describe, expect, it } from "vitest";
import { filterCommands, SLASH_COMMANDS } from "./slash-command";

describe("Slash Menu Commands & Filter Contract", () => {
	it("returns all commands when query is empty", () => {
		expect(filterCommands("")).toHaveLength(SLASH_COMMANDS.length);
	});

	it("filters accurately with English queries", () => {
		const h1Results = filterCommands("h1");
		expect(h1Results.some((c) => c.title.includes("H1"))).toBe(true);

		const codeResults = filterCommands("code");
		expect(codeResults.some((c) => c.title.includes("코드"))).toBe(true);
	});

	it("filters accurately with Korean queries", () => {
		const titleResults = filterCommands("제목");
		expect(titleResults.length).toBeGreaterThanOrEqual(3); // H1, H2, H3

		const quoteResults = filterCommands("인용");
		expect(quoteResults.some((c) => c.title.includes("인용구"))).toBe(true);

		const listResults = filterCommands("목록");
		expect(listResults.length).toBeGreaterThanOrEqual(2); // Bullet, Ordered
	});
});
