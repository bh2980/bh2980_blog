import { describe, expect, it } from "vitest";
import { tokenMatches } from "../routes";

describe("실행기 토큰", () => {
	it("없거나 틀린 토큰은 막고, 길이가 달라도 던지지 않으며 앞뒤 공백은 무시한다", () => {
		const token = "secret-scheduler-token";
		expect(tokenMatches(token, undefined)).toBe(false);
		expect(tokenMatches(token, "wrong-token")).toBe(false);
		expect(tokenMatches(token, token)).toBe(true);
		expect(tokenMatches(token, `${token}-longer`)).toBe(false);
		expect(tokenMatches(token, "short")).toBe(false);
		expect(tokenMatches(token, "secret-scheduler-tokeX")).toBe(false);
		expect(tokenMatches(token, `  ${token}  `)).toBe(true);
		expect(tokenMatches(undefined, token)).toBe(false);
	});
});
