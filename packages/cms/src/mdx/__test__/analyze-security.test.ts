import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";

const errorText = (source: string) =>
	analyze(source)
		.errors.map((error) => error.message)
		.join(" | ");

/**
 * M7-SEC-1 P2: `EVENT_HANDLER_NAME`이 `/^on[A-Z]/`였을 때 `onerror`(소문자)가 통과했다.
 * React는 DOM 속성 이름을 대소문자와 무관하게 다루므로 소문자 핸들러도 거부해야 한다.
 */
describe("JSX 이벤트 핸들러 속성 거부", () => {
	it("대소문자와 무관하게 이벤트 핸들러 속성을 거부한다", () => {
		expect(errorText('<Callout onClick="x">a</Callout>')).toContain("이벤트 핸들러");
		expect(errorText('<Callout onclick="x">a</Callout>')).toContain("이벤트 핸들러");
		expect(errorText('<Callout onerror="x">a</Callout>')).toContain("이벤트 핸들러");
		expect(errorText('<Callout ONERROR="x">a</Callout>')).toContain("이벤트 핸들러");
	});

	it("이벤트 핸들러가 아닌 속성은 통과시킨다", () => {
		expect(errorText('<Callout title="t">a</Callout>')).toBe("");
	});
});
