import { describe, expect, it } from "vitest";
import { analyze, serialize, toDocument } from "..";

/** 쓰기 경로: `MDX → analyze → toDocument → serialize`. */
const write = (source: string): string => serialize(toDocument(analyze(source)));

/** 한 번 더 왕복해도 같은 문자열이어야 한다(멱등). */
const writeTwice = (source: string): string => write(write(source));

describe("M8-ED-2 저장 형식 directive 전환", () => {
	it("읽기 호환 JSX와 HTML 인라인을 directive로 정규화한다", () => {
		expect(write('<Callout variant="note">\n\n본문\n\n</Callout>').trimEnd()).toBe(
			':::callout{variant="note"}\n본문\n:::',
		);
		expect(write("<u>밑줄</u>").trimEnd()).toBe(":u[밑줄]");
		expect(write("<sup>위</sup>").trimEnd()).toBe(":sup[위]");
		expect(write("<sub>아래</sub>").trimEnd()).toBe(":sub[아래]");
		expect(write("<br/>").trimEnd()).toBe(":br[]");
		expect(write('<Tooltip content="설명">라벨</Tooltip>').trimEnd()).toBe(':tooltip[라벨]{content="설명"}');
		expect(write('<TextAlign align="center">\n\n가운데\n\n</TextAlign>').trimEnd()).toBe(
			':::text-align{align="center"}\n가운데\n:::',
		);
	});

	it("중첩 컨테이너는 바깥일수록 콜론이 많다(3 + 단계)", () => {
		const nested = write(
			'<Tabs>\n<Tab label="a">\n<Columns>\n<Column>\n깊은 본문\n</Column>\n</Columns>\n</Tab>\n<Tab label="b">\nB\n</Tab>\n</Tabs>',
		);

		expect(nested).toContain(":::::tabs");
		expect(nested).toContain("::::tab");
		expect(nested).toContain(":::columns");
		expect(nested).toContain(":::column");
	});

	it("불리언 속성은 참일 때만 이름을 쓰고 거짓·없음은 생략한다", () => {
		expect(write("<Collapsible defaultOpen>본문</Collapsible>").trimEnd()).toBe(
			":::collapsible{defaultOpen}\n본문\n:::",
		);
		expect(write('<Collapsible defaultOpen="false">본문</Collapsible>').trimEnd()).toBe(":::collapsible\n본문\n:::");
		expect(write("<Collapsible>본문</Collapsible>").trimEnd()).toBe(":::collapsible\n본문\n:::");
	});

	it("Markdown 강조가 성립하지 않는 자리에서는 JSX로 쓴다", () => {
		// 안쪽 끝이 문장부호면 CommonMark 강조가 닫히지 않아 별표가 글자로 남는다.
		expect(write("<strong>정적(Static)</strong>과 동적").trimEnd()).toBe("<strong>정적(Static)</strong>과 동적");
		expect(write('<strong>"인용"</strong>').trimEnd()).toBe('<strong>"인용"</strong>');
		// 성립하는 자리는 Markdown 그대로 둔다.
		expect(write("<strong>정적</strong>과 동적").trimEnd()).toBe("**정적**과 동적");
		expect(write("<em>기울임</em>").trimEnd()).toBe("*기울임*");
		expect(write("<del>취소</del>").trimEnd()).toBe("~~취소~~");
		// 강조가 성립하지 않는 입력은 별표를 글자로 남기지 않는다(이스케이프한다).
		expect(write("**정적(Static)**과 동적").trimEnd()).toBe("\\*\\*정적(Static)\\*\\*과 동적");
	});

	it("문단은 한 줄로 저장하고 줄바꿈은 :br[]로만 표현한다", () => {
		expect(write("첫 줄\\\n둘째 줄").trimEnd()).toBe("첫 줄:br[]둘째 줄");
		expect(write("첫 줄<br/>둘째 줄").trimEnd()).toBe("첫 줄:br[]둘째 줄");
		// 하드브레이크는 문단을 쪼개지 않는다 — raw 줄바꿈을 만들지 않는다.
		const written = write("가\\\n나\\\n다");
		expect(written).toBe("가:br[]나:br[]다\n");
		expect(written.trimEnd().includes("\n")).toBe(false);
	});

	it("이미지는 미디어 참조·크기·정렬·캡션·장식이 있으면 리프로, 없으면 Markdown으로 쓴다", () => {
		expect(write('<Image mediaId="uuid-1" alt="설명" />').trimEnd()).toBe('::image{mediaId="uuid-1" alt="설명"}');
		expect(write('<Image src="/images/a.png" alt="설명" width="60%" align="center" caption="캡션" />').trimEnd()).toBe(
			'::image{src="/images/a.png" alt="설명" width="60%" align="center" caption="캡션"}',
		);
		expect(write('<Image src="/images/a.png" alt="설명" decorative />').trimEnd()).toBe(
			'::image{src="/images/a.png" alt="설명" decorative}',
		);
		expect(write("![설명](/images/a.png)").trimEnd()).toBe("![설명](/images/a.png)");
	});

	it("이스케이프된 `:이름`은 글자로 유지된다", () => {
		// 등록된 이름 뒤에 구분자가 오면 지시자로 읽히므로 `\:`로 끊는다(§4.4).
		expect(write("글자로 쓰는 \\:u[괄호] 예문").trimEnd()).toBe("글자로 쓰는 \\:u\\[괄호] 예문");
		expect(write("줄바꿈 글자 \\:br 입니다").trimEnd()).toBe("줄바꿈 글자 \\:br 입니다");
		expect(write("자물쇠 \\:\\:image{alt=x} 글자").trimEnd()).toBe("자물쇠 :\\:image{alt=x} 글자");
		// 미등록 이름·시각·URL의 콜론은 손대지 않는다.
		expect(write("벡터 rag openai/gpt-oss-120b:free를 쓴다").trimEnd()).toBe(
			"벡터 rag openai/gpt-oss-120b:free를 쓴다",
		);
		expect(write("낮 12:30에 만나요").trimEnd()).toBe("낮 12:30에 만나요");
	});

	it("쓴 문자열을 다시 써도 같은 문자열이다(멱등)", () => {
		const samples = [
			':::callout{variant="note"}\n\n본문 :u[밑줄] 과 :br[] 줄바꿈\n\n:::',
			'::::tabs\n:::tab{label="a"}\nA\n:::\n:::tab{label="b"}\nB\n:::\n::::',
			"**정적(Static)**과 **동적**",
			'::image{src="/images/a.png" alt="설명" width="60%"}',
			'문단 안의 :tooltip[라벨]{content="설명"} 입니다.',
		];

		for (const sample of samples) {
			expect(writeTwice(sample)).toBe(write(sample));
		}
	});
});
