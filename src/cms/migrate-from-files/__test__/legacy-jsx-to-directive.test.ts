import { describe, expect, it } from "vitest";
import { convertLegacySource } from "../legacy-jsx-to-directive";

const convert = (source: string) => convertLegacySource(source);

describe("레거시 JSX → directive 변환", () => {
	it("컨테이너를 directive로 바꾼다", () => {
		const result = convert('<Callout variant="note">\n\n본문\n\n</Callout>');

		expect(result.source).toBe(':::callout{variant="note"}\n본문\n:::');
		expect(result.counts).toEqual({ callout: 1 });
		expect(result.leftovers).toEqual([]);
	});

	it("중첩 컨테이너는 바깥 콜론을 늘린다(3 + 단계 수)", () => {
		const result = convert('<Tabs>\n<Tab label="첫 번째">\nA\n</Tab>\n<Tab label="두 번째">\nB\n</Tab>\n</Tabs>');

		expect(result.source).toBe('::::tabs\n:::tab{label="첫 번째"}\nA\n:::\n:::tab{label="두 번째"}\nB\n:::\n::::');
		expect(result.counts).toEqual({ tabs: 1, tab: 2 });
	});

	it("문장 안 텍스트 directive로 바꾼다", () => {
		expect(convert("문장 <u>밑줄</u> 끝").source).toBe("문장 :u[밑줄] 끝");
		expect(convert('<Tooltip content="설명">라벨</Tooltip>').source).toBe(':tooltip[라벨]{content="설명"}');
	});

	it("속성값은 원문 그대로 옮긴다(따옴표 안 `>` 포함)", () => {
		expect(convert('<Tooltip content="a > b">라벨</Tooltip>').source).toBe(':tooltip[라벨]{content="a > b"}');
	});

	it("불리언·정적 리터럴 속성을 §4.4 문자열 형식으로 정규화한다", () => {
		expect(convert("<Collapsible defaultOpen>\n본문\n</Collapsible>").source).toBe(
			':::collapsible{defaultOpen="true"}\n본문\n:::',
		);
		expect(convert("<Collapsible defaultOpen={false}>\n본문\n</Collapsible>").source).toBe(
			':::collapsible{defaultOpen="false"}\n본문\n:::',
		);
	});

	it("줄 끝 하드브레이크를 :br[] 로 바꾸고 문단을 한 줄로 만든다", () => {
		const result = convert("첫 줄\\\n둘째 줄");

		expect(result.source).toBe("첫 줄:br[]둘째 줄");
		expect(result.counts).toEqual({ br: 1 });
	});

	it("IdeographicSpace는 컴포넌트만 걷어내고 글자를 남긴다(간격 보존)", () => {
		const result = convert("앞 문단\n\n<IdeographicSpace />\n\n뒤 문단");

		expect(result.source).toBe("앞 문단\n\n\u3164\n\n뒤 문단");
		expect(result.counts).toEqual({ IdeographicSpace: 1 });
	});

	it("코드 펜스 안은 건드리지 않는다", () => {
		const source = ["```tsx", '<Callout variant="note">그대로</Callout>', "```"].join("\n");
		const result = convert(source);

		expect(result.source).toBe(source);
		expect(result.counts).toEqual({});
	});

	it("모르는 JSX는 그대로 두고 기록한다(무음 변환 금지)", () => {
		const result = convert("<Unknown prop={1}>\n본문\n</Unknown>");

		expect(result.source).toBe("<Unknown prop={1}>\n본문\n</Unknown>");
		expect(result.leftovers).toEqual(["Unknown"]);
	});

	it("frontmatter를 바이트 그대로 보존한다", () => {
		const source = ["---", "title: 제목", "tags:", "  - a", "---", "", "<u>밑줄</u>", ""].join("\n");
		const result = convert(source);

		expect(result.source.startsWith("---\ntitle: 제목\ntags:\n  - a\n---\n")).toBe(true);
		expect(result.source.endsWith(":u[밑줄]\n")).toBe(true);
	});

	it("두 번 돌려도 결과가 같다(멱등)", () => {
		const once = convert('<Callout variant="note">\n\n문장 <u>밑줄</u>\n\n</Callout>').source;

		expect(convert(once).source).toBe(once);
	});
});
