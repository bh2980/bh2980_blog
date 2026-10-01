import { describe, expect, it } from "vitest";
import { compareStructure, readableMdx } from "../skeleton";

const SOURCE = [
	'<Callout variant="info" title="주의할 점">',
	"**React Query**의 [공식 문서](/posts/react-query)를 보고 `useQuery`를 쓴다.",
	"</Callout>",
].join("\n");

describe("번역 구조 검사", () => {
	it("글자와 사람이 읽는 속성만 바뀌면 통과한다", () => {
		const translated = [
			'<Callout variant="info" title="Things to note">',
			"Use `useQuery` after reading the [official docs](/posts/react-query) of **React Query**.",
			"</Callout>",
		].join("\n");
		// 굵게·링크의 위치가 문장 안에서 옮겨져도 된다.
		expect(compareStructure(SOURCE, translated)).toEqual({ ok: true });
	});

	it("링크 주소·인라인 코드·사람이 읽지 않는 속성이 바뀌면 실패한다", () => {
		expect(compareStructure(SOURCE, SOURCE.replace("/posts/react-query", "/posts/other")).ok).toBe(false);
		expect(compareStructure(SOURCE, SOURCE.replace("`useQuery`", "`useQueries`")).ok).toBe(false);
		expect(compareStructure(SOURCE, SOURCE.replace('variant="info"', 'variant="warning"')).ok).toBe(false);
	});

	it("서식을 빼거나 문단을 나누면 실패한다", () => {
		expect(compareStructure(SOURCE, SOURCE.replace("**React Query**", "React Query")).ok).toBe(false);
		expect(compareStructure("첫 문단입니다.", "First paragraph.\n\nSecond paragraph.").ok).toBe(false);
	});

	it("코드 블록·이미지 주소는 그대로여야 하고, alt·캡션은 바뀌어도 된다", () => {
		const code = "```ts\nconst a = 1;\n```";
		expect(compareStructure(code, code).ok).toBe(true);
		expect(compareStructure(code, "```ts\nconst b = 1;\n```").ok).toBe(false);
		expect(compareStructure("![설정 화면](/a.png)", "![Settings screen](/a.png)").ok).toBe(true);
		expect(compareStructure("![설정 화면](/a.png)", "![Settings screen](/b.png)").ok).toBe(false);
	});

	it("탭 이름과 기본 탭은 함께 번역해도 된다", () => {
		const tabs = '<Tabs defaultValue="하나">\n<Tab label="하나">\n가\n</Tab>\n<Tab label="둘">\n나\n</Tab>\n</Tabs>';
		const translated = '<Tabs defaultValue="One">\n<Tab label="One">\nA\n</Tab>\n<Tab label="Two">\nB\n</Tab>\n</Tabs>';
		expect(compareStructure(tabs, translated).ok).toBe(true);
	});

	it("안내 글이 남거나 MDX가 깨지면 실패한다", () => {
		expect(compareStructure("가나다", ":untranslated[가나다]").ok).toBe(false);
		expect(compareStructure("가나다", "<Callout>열고 닫지 않음").ok).toBe(false);
		expect(readableMdx("<Callout>열고 닫지 않음").ok).toBe(false);
		expect(readableMdx("정상 문단").ok).toBe(true);
	});
});
