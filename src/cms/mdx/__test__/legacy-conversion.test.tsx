import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Root } from "mdast";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import { analyze } from "@/cms/mdx";
import { splitFrontmatter } from "@/cms/mdx/frontmatter";
import { parseMdxAst } from "@/cms/mdx/parse";
import { readLegacyCorpus } from "@/cms/migrate-from-files/legacy-parser";
import { MDX_COMPONENTS, MDX_REHYPE_PLUGINS, MDX_REMARK_PLUGINS } from "@/components/mdx/mdx-content";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const MANIFEST = path.join(__dirname, "__fixtures__", "legacy-render-hashes.json");

const PreShim = ({ children, title }: { children?: ReactNode; title?: string }) => (
	<div data-audit-pre-shim data-title={title}>
		{children}
	</div>
);

const renderPublic = async (source: string): Promise<string> => {
	const { content } = await compileMDX({
		source,
		options: { mdxOptions: { remarkPlugins: MDX_REMARK_PLUGINS(), rehypePlugins: MDX_REHYPE_PLUGINS } },
		components: { ...MDX_COMPONENTS, pre: PreShim },
	});

	return renderToStaticMarkup(content);
};

/**
 * 변환으로 생기는 차이 **두 가지만** 접어서 비교한다. 둘 다 화면이 바뀌지 않거나(공백) 사용자 결정 사항이다.
 *
 * ① `IdeographicSpace` → 빈 줄: `<span>ㅤ</span>` ↔ `<p><br/></p>` (보이지 않는 글자 대신 `:br[]`를 쓴다)
 * ② `<br/>` 뒤에 남는 공백 — HTML에서 줄머리 공백은 접힌다(`mdast` break가 붙이던 개행, 다음 줄 들여쓰기)
 *
 * 그 밖의 차이는 허용하지 않는다. `__fixtures__/legacy-render-hashes.json`은 **변환 전** 원본 렌더로
 * 만든 정규화 해시이고, 이 테스트는 현재 본문 렌더가 그 값과 같은지 본다(M8-DA-1 A6).
 *
 * 렌더러 자체가 바뀌면 기록을 다시 만든다. v2 A0(2026-09-27)에서 UI primitive를 Radix → Base UI로 바꾸며
 * 42편의 해시를 갱신했다. 46편 모두 보이는 텍스트는 이전 렌더와 같고, 차이는 Collapsible·Tabs·Tooltip의
 * 상태 속성(`data-state` → `data-closed`·`data-panel-open` 등)과 닫힌 패널의 빈 요소를 렌더하지 않는 것,
 * 그리고 Tooltip 설명을 스크린 리더용 숨긴 텍스트(`sr-only`, `aria-describedby`)로 함께 내보내는 것뿐이다.
 * v2 C6 후속(2026-09-27): GFM `<th>`에 `scope="col"`을 부여해 해당 표가 있는 2편의 해시를 갱신했다.
 * 컨테이너 편집 개선(2026-09-28): Tabs 방향 변형(`data-[orientation=horizontal]`)·여백과 Column 래퍼(`<div>`)를
 * 바로잡아 탭·단이 있는 3편의 해시를 갱신했다. 보이는 글자는 같다. 이어서 단 너비(`widths`)를 받도록
 * Columns를 grid로 바꿔 단이 있는 1편의 해시를 다시 갱신했다.
 * 코드 툴팁 주석(2026-09-29): 코드 안 툴팁에 터치 기기용 번호(`<sup>`)와 코드 아래 주석 목록(`<ol>`)을 더해
 * 코드 툴팁이 있는 2편의 해시를 갱신했다. 둘을 빼면 이전 해시와 같다(데스크톱에서는 CSS로 숨는다).
 * 블록 간격 맞춤(2026-09-29): 콜아웃·접기에 위아래 여백(`my-6`)과 안쪽 첫·끝 블록 여백 없애기를 더해
 * 콜아웃·접기가 있는 39편의 해시를 갱신했다. 더한 클래스를 빼면 모두 이전 해시와 같다.
 */
const canonical = (html: string): string =>
	html.replaceAll("<span>ㅤ</span>", "<p><br/></p>").replace(/<br\/>\s+/g, "<br/>");

const bodyOf = (source: string): string => splitFrontmatter(source).body;

/** 원문이 `<`로 시작하는 MDX 요소 = directive로 바꾸지 못하고 남은 레거시 JSX. */
const legacyJsxNames = (source: string): string[] => {
	const body = bodyOf(source);
	const tree = parseMdxAst(body);
	const names: string[] = [];

	visit(tree as Root, ["mdxJsxFlowElement", "mdxJsxTextElement"], (node) => {
		const element = node as { name?: string | null; position?: { start?: { offset?: number } } };
		const offset = element.position?.start?.offset;
		if (typeof offset !== "number") return;
		if (!body.startsWith("<", offset)) return;
		names.push(element.name ?? "");
	});

	return names;
};

describe("M8-DA-1 변환 등가성", () => {
	const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, { sha256: string; bytes: number }>;

	it("변환된 46편의 공개 HTML이 변환 전 기록과 같다", async () => {
		const mismatches: string[] = [];

		for (const [relative, expected] of Object.entries(manifest)) {
			const source = readFileSync(path.join(REPO_ROOT, relative), "utf8");
			// 공개 페이지는 Keystatic이 분리한 **본문**(frontmatter 제외)을 렌더한다.
			const html = canonical(await renderPublic(bodyOf(source)));
			const sha256 = createHash("sha256").update(html, "utf8").digest("hex");

			if (sha256 !== expected.sha256) mismatches.push(`${relative} (${html.length}자, 기록 ${expected.bytes}자)`);
		}

		expect(Object.keys(manifest)).toHaveLength(46);
		expect(mismatches).toEqual([]);
	});

	it("미등록 `:이름` 2건이 본문 글자로 남아 있다", () => {
		// demote 규칙의 실측 근거 — 변환기가 손대지 않고 렌더가 보존한다(M8-TW-1).
		const cases: [string, string][] = [
			["src/contents/posts/블로그를-검색하는-벡터-rag-만들기.mdx", ":free를"],
			["src/contents/posts/코드-블럭에-툴팁을-띄우고-싶었을-뿐인데.mdx", ":1로"],
		];
		for (const [rel, text] of cases) {
			const source = readFileSync(path.join(REPO_ROOT, rel), "utf8");
			expect(source).toContain(text);
		}
	});

	it("49편에 레거시 JSX 표기가 남지 않고 분석 오류가 0이다", () => {
		const corpus = readLegacyCorpus(REPO_ROOT);
		const items = [...corpus.posts, ...corpus.memos];
		const leftovers: string[] = [];
		const errors: string[] = [];

		for (const item of items) {
			const names = legacyJsxNames(item.mdx);
			if (names.length > 0) leftovers.push(`${item.path}: ${names.join(", ")}`);

			const analysis = analyze(item.mdx, item.path);
			if (analysis.errors.length > 0) {
				errors.push(`${item.path}: ${analysis.errors.map((error) => error.message).join(" / ")}`);
			}
		}

		expect(items).toHaveLength(49);
		expect(leftovers).toEqual([]);
		expect(errors).toEqual([]);
	});
});
