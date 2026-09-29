import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getSchema } from "@tiptap/core";
import { Node as PmNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { buildWithOwners, flattenUnits } from "@/cms/core/translation/units";
import { analyze, toDocument } from "@/cms/mdx";
import { splitFrontmatter } from "@/cms/mdx/frontmatter";
import { buildEditorExtensions } from "../../extensions";
import { cmsNodeToTiptap } from "../../tiptap-content";
import { unitRanges } from "../unit-ranges";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const schema = getSchema(buildEditorExtensions());

const rangesFor = (mdx: string, targetOf: (source: string, index: number) => string | null = (source) => source) => {
	const sourceDoc = toDocument(analyze(mdx));
	const units = flattenUnits(sourceDoc);
	const { doc, owners } = buildWithOwners(
		sourceDoc,
		units.map((unit, index) => targetOf(unit.source, index)),
	);
	const pmDoc = PmNode.fromJSON(schema, cmsNodeToTiptap(doc));
	return { units, pmDoc, ranges: unitRanges(pmDoc, doc, owners) };
};

describe("번역 미리보기의 단위 자리(v3)", () => {
	it("기존 글 모두: 모든 단위가 에디터 문서 안에 자리를 가진다", () => {
		const corpus = ["posts", "memos"].flatMap((folder) => {
			const dir = path.join(REPO_ROOT, "src/contents", folder);
			return readdirSync(dir)
				.filter((name) => name.endsWith(".mdx"))
				.map((name) => [name, splitFrontmatter(readFileSync(path.join(dir, name), "utf8")).body] as const);
		});
		const missing: string[] = [];
		for (const [name, body] of corpus) {
			const { units, pmDoc, ranges } = rangesFor(body);
			const covered = new Set(ranges.map((range) => range.index));
			const lost = units.map((_, index) => index).filter((index) => !covered.has(index));
			if (lost.length > 0) missing.push(`${name}: ${lost.length}/${units.length}`);
			for (const range of ranges) {
				expect(range.from).toBeGreaterThanOrEqual(0);
				expect(range.to).toBeLessThanOrEqual(pmDoc.content.size);
				expect(pmDoc.nodeAt(range.from)).not.toBeNull();
			}
		}
		expect(missing).toEqual([]);
	});

	it("상자 안 블록은 그 블록 자리, 머리 줄은 상자 자리를 가리킨다", () => {
		const { pmDoc, ranges } = rangesFor(
			':::callout{variant="note" title="알림"}\n안쪽 문단\n:::\n\n::::tabs\n:::tab{label="A"}\n탭 A\n:::\n:::tab{label="B"}\n탭 B\n:::\n::::\n\n밖 문단',
		);
		const typeAt = (index: number) =>
			ranges.filter((range) => range.index === index).map((range) => pmDoc.nodeAt(range.from)?.type.name);
		expect(typeAt(0)).toEqual(["cmsCallout"]);
		expect(typeAt(1)).toEqual(["paragraph"]);
		expect(typeAt(2)).toEqual(["cmsTabs"]);
		expect(typeAt(3)).toEqual(["paragraph"]);
		expect(typeAt(4)).toEqual(["paragraph"]);
		expect(typeAt(5)).toEqual(["paragraph"]);
		expect(pmDoc.nodeAt(ranges.find((range) => range.index === 1)?.from ?? -1)?.textContent).toBe("안쪽 문단");
	});

	it("번역하지 않은 블록이 빠진 미리보기에서도 나머지 단위의 자리가 맞는다", () => {
		const { pmDoc, ranges } = rangesFor("하나\n\n둘\n\n셋", (source, index) => (index === 1 ? null : `${source}!`));
		expect(ranges.map((range) => [range.index, pmDoc.nodeAt(range.from)?.textContent])).toEqual([
			[0, "하나!"],
			[2, "셋!"],
		]);
	});
});
