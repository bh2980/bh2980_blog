import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyze, serialize, toDocument } from "@/cms/mdx";
import { splitFrontmatter } from "@/cms/mdx/frontmatter";
import {
	alignUnits,
	buildTranslatedDoc,
	flattenUnits,
	ignoreChange,
	type StoredUnit,
	toStoredUnits,
	translatedMdx,
	withTarget,
} from "../units";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const docOf = (mdx: string) => toDocument(analyze(mdx));

const corpus = ["posts", "memos"].flatMap((folder) => {
	const dir = path.join(REPO_ROOT, "src/contents", folder);
	return readdirSync(dir)
		.filter((name) => name.endsWith(".mdx"))
		.map((name) => [`${folder}/${name}`, splitFrontmatter(readFileSync(path.join(dir, name), "utf8")).body] as const);
});

describe("번역 단위 나누기·다시 합치기(v3)", () => {
	it("기존 글 모두: 단위마다 원문을 그대로 넣어 합치면 원문과 같다", () => {
		expect(corpus.length).toBeGreaterThan(40);
		const mismatches: string[] = [];
		for (const [name, body] of corpus) {
			const doc = docOf(body);
			const units = flattenUnits(doc);
			const rebuilt = serialize(
				buildTranslatedDoc(
					doc,
					units.map((unit) => unit.source),
				),
			);
			if (rebuilt !== serialize(doc)) mismatches.push(name);
		}
		expect(mismatches).toEqual([]);
	});

	it("상자는 펼쳐서 머리 줄(제목·탭 이름)과 안쪽 블록으로 나누고, 목록·표는 통째로 하나다", () => {
		const doc = docOf(
			[
				"# 제목",
				':::callout{variant="note" title="알림"}\n안쪽 문단\n\n- 하나\n- 둘\n:::',
				'::::tabs\n:::tab{label="자바스크립트"}\n```js\nconst a = 1; // 주석\n```\n:::\n:::tab{label="파이썬"}\n파이썬 설명\n:::\n::::',
				"| a | b |\n| - | - |\n| 1 | 2 |",
				"---",
			].join("\n\n"),
		);
		const units = flattenUnits(doc);
		expect(units.map((unit) => [unit.kind, unit.type, unit.auto])).toEqual([
			["block", "heading", false],
			["header", "Callout", false],
			["block", "paragraph", false],
			["block", "bulletList", false],
			["header", "Tabs", false],
			["block", "codeBlock", false],
			["block", "paragraph", false],
			["block", "table", false],
			["block", "horizontalRule", true],
		]);
		expect(units[1]?.source).toBe(JSON.stringify({ title: "알림" }));
		expect(units[4]?.source).toBe(JSON.stringify({ labels: ["자바스크립트", "파이썬"] }));
		// 상자 안 문단과 밖 문단은 열쇠가 다르다(엉뚱한 자리와 짝이 되지 않는다).
		expect(units[2]?.key).not.toBe(units[0]?.key.replace("heading", "paragraph"));
	});

	it("번역을 끼우면 머리 줄 속성과 블록이 바뀌고, 미번역 블록은 빠진다", () => {
		const doc = docOf(
			':::callout{variant="note" title="알림"}\n안쪽 문단\n:::\n\n::::tabs\n:::tab{label="하나"}\n탭 본문\n:::\n::::\n\n남는 문단',
		);
		const out = serialize(
			buildTranslatedDoc(doc, [
				JSON.stringify({ title: "Notice" }),
				"Inner paragraph",
				JSON.stringify({ labels: ["One"] }),
				"Tab body",
				null,
			]),
		);
		expect(out).toBe(
			':::callout{variant="note" title="Notice"}\nInner paragraph\n:::\n\n::::tabs\n:::tab{label="One"}\nTab body\n:::\n::::\n',
		);
	});
});

describe("원문과 짝 맞추기(v3 §3.2)", () => {
	const unitsOf = (mdx: string) => flattenUnits(docOf(mdx));
	const translate = (mdx: string, map: Record<string, string>): StoredUnit[] =>
		unitsOf(mdx).map((unit) => ({ key: unit.key, source: unit.source, target: map[unit.source] ?? null }));

	const original = "첫 문단\n\n둘째 문단\n\n셋째 문단\n";
	const stored = translate(original, { "첫 문단": "First", "둘째 문단": "Second", "셋째 문단": "Third" });

	it("원문이 그대로면 모두 번역됨이다", () => {
		expect(alignUnits(unitsOf(original), stored).map((item) => [item.status, item.target])).toEqual([
			["translated", "First"],
			["translated", "Second"],
			["translated", "Third"],
		]);
	});

	it("바뀐 블록은 원문 변경됨(번역 유지, 바뀌기 전 원문 보관), 새 블록은 미번역, 지운 블록은 빠진다", () => {
		const edited = "첫 문단\n\n새로 넣은 문단\n\n둘째 문단 고침\n";
		const aligned = alignUnits(unitsOf(edited), stored);
		expect(aligned.map((item) => [item.unit.source, item.status, item.target])).toEqual([
			["첫 문단", "translated", "First"],
			["새로 넣은 문단", "changed", "Second"],
			["둘째 문단 고침", "changed", "Third"],
		]);
		// 순서가 모호할 때(가운데 삽입 + 수정)도 버리는 번역 없이 짝짓는다. 삽입만 하면 미번역이다.
		const inserted = alignUnits(unitsOf("첫 문단\n\n새로 넣은 문단\n\n둘째 문단\n\n셋째 문단\n"), stored);
		expect(inserted.map((item) => item.status)).toEqual(["translated", "untranslated", "translated", "translated"]);
		const removed = alignUnits(unitsOf("첫 문단\n\n셋째 문단\n"), stored);
		expect(removed.map((item) => item.target)).toEqual(["First", "Third"]);
	});

	it("번역을 고치거나 변경 무시를 하면 지금 원문이 기준이 되어 표시가 사라진다", () => {
		const aligned = alignUnits(unitsOf("첫 문단 고침\n\n둘째 문단\n\n셋째 문단\n"), stored);
		const first = aligned[0];
		if (!first) throw new Error("no unit");
		expect(first.status).toBe("changed");
		expect(first.baseSource).toBe("첫 문단");
		expect(withTarget(first, "First, fixed")).toMatchObject({ status: "translated", baseSource: "첫 문단 고침" });
		expect(ignoreChange(first)).toMatchObject({ status: "translated", baseSource: "첫 문단 고침", target: "First" });

		// 저장했다 다시 맞춰도 원문 변경됨이 유지된다(표시를 지우기 전까지).
		const again = alignUnits(unitsOf("첫 문단 고침\n\n둘째 문단\n\n셋째 문단\n"), toStoredUnits(aligned));
		expect(again[0]?.status).toBe("changed");
	});

	it("새 번역본(저장된 단위 없음)은 모두 미번역이고, 번역할 것이 없는 블록만 원문 그대로다", () => {
		const aligned = alignUnits(unitsOf("문단\n\n---\n\n![](https://example.com/a.png)\n"), []);
		expect(aligned.map((item) => [item.unit.type, item.status])).toEqual([
			["paragraph", "untranslated"],
			["horizontalRule", "translated"],
			["image", "translated"],
		]);
	});

	it("번역본 MDX는 원문 뼈대에 번역을 끼워 만든다", () => {
		expect(translatedMdx(original, stored)).toBe("First\n\nSecond\n\nThird\n");
		expect(translatedMdx("해석 <Callout>닫히지 않음", stored)).toBeNull();
	});
});
