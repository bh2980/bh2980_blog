import { describe, expect, it } from "vitest";
import { defineBlock } from "../../../blocks/define";
import { compareStructure, readableAttributesByType, readableMdx } from "../skeleton";

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

	it("툴팁 설명·파일 이름·링크 제목은 바뀌어도 된다", () => {
		expect(compareStructure(':tooltip[가]{content="설명"}', ':tooltip[A]{content="Note"}').ok).toBe(true);
		expect(compareStructure('::file{mediaId="m1" label="보고서"}', '::file{mediaId="m1" label="Report"}').ok).toBe(
			true,
		);
		expect(compareStructure('::file{mediaId="m1" label="보고서"}', '::file{mediaId="m2" label="Report"}').ok).toBe(
			false,
		);
		expect(compareStructure('[글](/a "제목")', '[Text](/a "Title")').ok).toBe(true);
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

	it("사이트 블록은 번역할 속성(translatable)만 바뀌어도 된다", () => {
		// 예시 설정의 사용자 블록 `notice`는 `title`을 번역할 속성으로 둔다.
		const notice = ':::notice{level="info" title="공지 제목"}\n안내 글\n:::';
		expect(compareStructure(notice, ':::notice{level="info" title="Notice title"}\nNotice text\n:::')).toEqual({
			ok: true,
		});
		expect(compareStructure(notice, ':::notice{level="warn" title="Notice title"}\nNotice text\n:::').ok).toBe(false);
		// 번역할 속성이 아닌 속성(`embed`의 `url`)은 그대로여야 한다.
		expect(compareStructure('::embed{url="https://a.example"}', '::embed{url="https://b.example"}').ok).toBe(false);
	});

	it("사람이 읽는 속성은 블록 정의에서 정한다", () => {
		const card = defineBlock({
			name: "card",
			label: "카드",
			syntax: { kind: "container", directive: "card" },
			component: "Card",
			attributes: {
				heading: { type: "string", label: "머리말", translatable: true },
				tone: { type: "string", label: "색" },
			},
			children: { blocks: ["face"] },
			editor: { view: "opaque" },
		});
		const face = defineBlock({
			name: "face",
			label: "면",
			syntax: { kind: "container", directive: "face" },
			component: "Face",
			attributes: { name: { type: "string", label: "이름", translatable: true } },
			editor: { view: "opaque" },
		});
		const deck = defineBlock({
			name: "deck",
			label: "묶음",
			syntax: { kind: "container", directive: "deck" },
			component: "Deck",
			attributes: { first: { type: "string", label: "처음 면", childValue: "name" } },
			children: { blocks: ["face"] },
			editor: { view: "opaque" },
		});
		const readable = readableAttributesByType([card, face, deck]);
		expect([...(readable.get("Card") ?? [])]).toEqual(["heading"]);
		expect([...(readable.get("card") ?? [])]).toEqual(["heading"]);
		// 번역할 자식 속성을 가리키는 속성도 함께 바뀐다(탭 이름 ↔ 처음 열 탭).
		expect([...(readable.get("Deck") ?? [])]).toEqual(["first"]);
		expect(readable.get("link")).toEqual(new Set(["title"]));
	});
});
