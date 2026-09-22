import path from "node:path";
import type { JSONContent } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { analyze, serialize, toDocument } from "@/cms/mdx";
import { readLegacyCorpus } from "@/cms/migrate-from-files/legacy-parser";
import { CmsImageNode } from "../image-node";
import {
	cmsNodeToTiptap,
	mdxToTiptap,
	OPAQUE_BLOCK_NAME,
	TOOLTIP_MARK_NAME,
	tiptapToCmsNode,
	tiptapToMdx,
} from "../tiptap-content";
import { CMS_SCHEMA_EXTENSIONS } from "../tiptap-schema";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/**
 * `tiptap-editor.tsx`의 extensions 배열과 같은 구성이다. 바뀌면 여기도 함께 고친다.
 * 스키마 검증을 통과해야 실에디터가 노드를 버리지 않는다.
 */
const schema = getSchema([
	StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
	...CMS_SCHEMA_EXTENSIONS,
	CmsImageNode,
]);

/** Tiptap 스키마를 통과하는지 확인한다 — 통과하지 못하면 실에디터가 조용히 버린다. */
const throughSchema = (json: JSONContent): JSONContent => schema.nodeFromJSON(json).toJSON() as JSONContent;

const write = (source: string): string => serialize(toDocument(analyze(source)));

const firstDiff = (a: unknown, b: unknown, at: string): string | null => {
	if (a === b) return null;
	if (typeof a !== typeof b || a === null || b === null)
		return `${at}: ${JSON.stringify(a)?.slice(0, 100)} !== ${JSON.stringify(b)?.slice(0, 100)}`;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return `${at}.length: ${a.length} !== ${b.length}`;
		for (let i = 0; i < a.length; i += 1) {
			const diff = firstDiff(a[i], b[i], `${at}[${i}]`);
			if (diff) return diff;
		}
		return null;
	}
	if (typeof a === "object") {
		for (const key of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
			const diff = firstDiff((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${at}.${key}`);
			if (diff) return diff;
		}
		return null;
	}
	return `${at}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;
};

describe("CmsNode ↔ Tiptap 왕복", () => {
	it("인라인 mark·제목·줄바꿈을 잃지 않는다", () => {
		const first = toDocument(
			analyze(
				'문장 **굵게** *기울임* ~~취소~~ `코드` :u[밑줄] :sup[위] :sub[아래] :tooltip[라벨]{content="설명"} [링크](https://example.com "제목")\n\n## 제목\n\n첫 줄:br[]둘째 줄',
			),
		);

		const json = throughSchema(cmsNodeToTiptap(first));
		const second = tiptapToCmsNode(json);

		expect(second).toEqual(first);
	});

	it("정렬 컨테이너를 펼쳤다 접는다", () => {
		const first = toDocument(analyze(':::text-align{align="center"}\n\n## 가운데\n\n:::'));
		const json = cmsNodeToTiptap(first);

		expect(json.content?.[0]).toMatchObject({
			type: "heading",
			attrs: expect.objectContaining({ textAlign: "center" }),
		});

		const second = tiptapToCmsNode(throughSchema(json));
		expect(second).toEqual(first);
		expect(serialize(second)).toContain(":::text-align");
	});

	it("스키마에 없는 블록은 상자로 보존하고 되돌린다", () => {
		const source = [
			':::callout{variant="note"}\n\n보존\n\n:::',
			'::::tabs\n:::tab{label="a"}\nA\n:::\n:::tab{label="b"}\nB\n:::\n::::',
			"| a | b |\n| --- | --- |\n| 1 | 2 |",
			"$$\nx^2\n$$",
		].join("\n\n");
		const first = toDocument(analyze(source));
		const json = cmsNodeToTiptap(first);

		const names = (json.content ?? []).map((block) => block?.type);
		expect(names).toEqual([OPAQUE_BLOCK_NAME, OPAQUE_BLOCK_NAME, OPAQUE_BLOCK_NAME, OPAQUE_BLOCK_NAME]);

		const second = tiptapToCmsNode(throughSchema(json));
		expect(second).toEqual(first);
	});

	it("이미지 속성을 잃지 않는다", () => {
		const first = toDocument(
			analyze(
				'::image{mediaId="uuid-1" alt="설명" width="60%" align="left" caption="캡션"}\n\n![그냥](https://example.com/a.png)',
			),
		);
		const json = cmsNodeToTiptap(first);

		expect(json.content?.[0]).toMatchObject({ type: "image", attrs: expect.objectContaining({ mediaId: "uuid-1" }) });

		const second = tiptapToCmsNode(throughSchema(json));
		expect(second).toEqual(first);
	});

	it("Tiptap 기본값과 같은 명시는 저장이 한 번 정규화하고 수렴한다", () => {
		// `align="center"`는 렌더 기본값이라 저장하면 빠진다. 의미는 같고, 다시 열면 그대로다.
		const source = '::image{mediaId="uuid-1" alt="설명" align="center"}';
		const once = tiptapToMdx(throughSchema(mdxToTiptap(source)));
		expect(once).not.toContain("align");
		expect(tiptapToMdx(throughSchema(mdxToTiptap(once)))).toBe(once);
	});

	it("툴팁 mark 이름이 스키마와 같다", () => {
		expect(schema.marks[TOOLTIP_MARK_NAME]).toBeDefined();
		expect(schema.nodes[OPAQUE_BLOCK_NAME]).toBeDefined();
	});
});

describe("49편 전체를 에디터에 싣고 되돌린다", () => {
	it("49편 모두 스키마를 통과하고 문서가 같다", () => {
		const corpus = readLegacyCorpus(REPO_ROOT);
		const items = [...corpus.posts, ...corpus.memos];
		expect(items).toHaveLength(49);

		const failures: string[] = [];
		for (const item of items) {
			const first = toDocument(analyze(item.mdx));
			let json: JSONContent;
			try {
				json = throughSchema(mdxToTiptap(item.mdx));
			} catch (error) {
				failures.push(`${item.path}: 스키마 거부 (${error instanceof Error ? error.message : String(error)})`);
				continue;
			}
			const second = toDocument(analyze(tiptapToMdx(json)));
			try {
				expect(second).toEqual(first);
			} catch {
				failures.push(`${item.path}: 문서 불일치 (${firstDiff(first, second, "")})`);
			}
		}

		expect(failures).toEqual([]);
		expect(write).toBeDefined();
	});
});
