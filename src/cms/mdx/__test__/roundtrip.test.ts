import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyze, serialize, toDocument } from "@/cms/mdx";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const SAMPLE_PATHS = [
  "src/contents/posts/내가-만든-rag의-성능-측정하기.mdx",
  "src/contents/memos/정규표현식-정리.mdx",
  "src/contents/memos/load-file.mdx",
  "src/contents/memos/download-file.mdx",
  "src/contents/posts/블로그라면-seo는-해봐야지.mdx",
  "src/contents/posts/왜-내-블로그는-ssg가-안될까.mdx",
  "src/contents/posts/코드-블럭에-툴팁을-띄우고-싶었을-뿐인데.mdx",
  "src/contents/memos/1-implement-curry.mdx",
  "src/contents/memos/js의-비동기-처리-메커니즘.mdx",
];

function readSample(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

function fullRoundtrip(mdx: string): { firstDoc: unknown; secondDoc: unknown } {
  const first = analyze(mdx);
  const firstDoc = toDocument(first);
  const serialized = serialize(firstDoc);
  const second = analyze(serialized);
  const secondDoc = toDocument(second);
  expect(second.errors ?? []).toEqual(first.errors ?? []);
  return { firstDoc, secondDoc };
}

const CODE_ANNOTATION_FENCE = [
  '```ts title="라인 범위 annotation 예시" lnum',
  "const greeting = 'hi'",
  '// @char Tooltip {0-5} content="인사말"   ',
  "// @line collapse",
  "export async function generateImageMetadata() {",
  "// @line collapse end",
  "  return gathering",
  "}",
].join("\n");

describe("MDX 왕복: analyze → toDocument → serialize → analyze", () => {
  describe("코드 펜스와 주석 메타데이터", () => {
    it("언어·title·lnum과 @char/@line 주석의 내용·공백·범위가 유실 없이 유지된다", () => {
      const { secondDoc } = fullRoundtrip(CODE_ANNOTATION_FENCE);
      const text = JSON.stringify(secondDoc);
      expect(text).toContain("라인 범위 annotation 예시");
      // JSON.stringify escapes quotes, so the MDX literal content="인사말" cannot appear verbatim.
      expect(text).toContain("인사말");
      expect(text).toContain("content");
      expect(text).toContain("@line collapse");
      expect(text).toContain("@char Tooltip {0-5}");
      expect(text).toContain("lnum");
    });

    it("주석 강조 겹침(@char 두 개)도 사라지지 않는다", () => {
      const mdx = [
        "```ts",
        '// @char Tooltip {0-7} content="첫째"',
        '// @char Tooltip {3-9} content="둘째"',
        "User-Agent: *",
        "```",
      ].join("\n");
      const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
      expect(text).toContain("{0-7}");
      expect(text).toContain("{3-9}");
      expect(text).toContain("첫째");
      expect(text).toContain("둘째");
    });

    it("일반 코드 펜스 내용이 보존되고 에디터 전용 문법으로 바뀌지 않는다", () => {
      const mdx = "```ts\nconst a = 1\n```";
      const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
      expect(text).toContain("const a = 1");
    });

    it("코드 안의 공백·들여쓰기 의미가 유지된다", () => {
      const mdx = [
        "```ts",
        "  const indented = true",
        "\tconst tabbed = true",
        "```",
      ].join("\n");
      const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
      expect(text).toContain("indented");
      expect(text).toContain("tabbed");
    });
  });

  describe("중첩 JSX 컴포넌트", () => {
    const NESTED = [
      "<Tabs>",
      '  <Tab label="robots.txt">',
      '    ```text title="src/app/robots.txt"',
      '    User-Agent: *',
      "    ```",
      "  </Tab>",
      '  <Tab label="sitemap.ts">',
      "    Callout은 Tab 안의 펜스 뒤에도 온다.",
      "  </Tab>",
      "</Tabs>",
    ].join("\n");

    it("Tabs > Tab > 코드 펜스 > 주석이 중첩 구조의 의미를 유지한다", () => {
      const text = JSON.stringify(fullRoundtrip(NESTED).secondDoc);
      expect(text).toContain("robots.txt");
      expect(text).toContain("sitemap.ts");
      expect(text).toContain("User-Agent: *");
    });

    it("Callout 안의 Tabs, Columns 안의 Callout도 유실되지 않는다", () => {
      const mdx = [
        '<Callout variant="note">',
        "  <Tabs>",
        '    <Tab label="a">바깥 Tab a</Tab>',
        '    <Tab label="b">바깥 Tab b</Tab>',
        "  </Tabs>",
        "</Callout>",
        "",
        "<Columns>",
        "  <Column>",
        '    <Callout variant="info" title="안쪽 콜아웃">',
        "      컬럼 안 문단이다.",
        "    </Callout>",
        "  </Column>",
        "  <Column>두 번째 컬럼</Column>",
        "</Columns>",
      ].join("\n");
      const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
      expect(text).toContain("안쪽 콜아웃");
      expect(text).toContain("바깥 Tab a");
      expect(text).toContain("두 번째 컬럼");
      expect(text).toContain("note");
      expect(text).toContain("info");
    });

    it("defaultOpen={true} 같은 리터럴 속성이 유지된다", () => {
      const mdx = [
        "<Collapsible defaultOpen={true}>",
        "펼친 상태로 저장된다.",
        "</Collapsible>",
      ].join("\n");
      const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
      expect(text).toContain("defaultOpen");
      expect(text).toContain("true");
    });

    it("Tab 개수 경계: 1개와 9개는 오류로 차단하고 2개·8개는 허용한다", () => {
      const two = '<Tabs><Tab label="1">a</Tab><Tab label="2">b</Tab></Tabs>';
      const eight = `<Tabs>${Array.from({ length: 8 }, (_, i) => `<Tab label="${i + 1}">a</Tab>`).join("")}</Tabs>`;
      const one = '<Tabs><Tab label="1">a</Tab></Tabs>';
      const nine = `<Tabs>${Array.from({ length: 9 }, (_, i) => `<Tab label="${i + 1}">a</Tab>`).join("")}</Tabs>`;

      fullRoundtrip(two);
      fullRoundtrip(eight);
      expect(analyze(one, "one-tab").errors ?? []).not.toEqual([]);
      expect(analyze(nine, "nine-tabs").errors ?? []).not.toEqual([]);
    });

    it("Column 개수 경계: 1개·5개는 오류, 2개·4개는 허용된다", () => {
      const two = "<Columns><Column>1</Column><Column>2</Column></Columns>";
      const four = "<Columns><Column>1</Column><Column>2</Column><Column>3</Column><Column>4</Column></Columns>";
      const one = "<Columns><Column>1</Column></Columns>";
      const five = "<Columns><Column>1</Column><Column>2</Column><Column>3</Column><Column>4</Column><Column>5</Column></Columns>";

      fullRoundtrip(two);
      fullRoundtrip(four);
      expect(analyze(one, "one-column").errors ?? []).not.toEqual([]);
      expect(analyze(five, "five-columns").errors ?? []).not.toEqual([]);
    });
  });

  describe("표", () => {
    const TABLE = [
      "행렬 | 시간 복잡도 | 비고",
      "--- | --- | ---",
      "A | O(log n) | 정렬 보조",
      "B | O(n log n) | 하한 경계",
    ].join("\n");

    it("셀 텍스트·열 구조가 유실되지 않는다", () => {
      const text = JSON.stringify(fullRoundtrip(TABLE).secondDoc);
      expect(text).toContain("행렬");
      expect(text).toContain("O(n log n)");
      expect(text).toContain("하한 경계");
    });

    it("코드블럭 안의 | 는 표로 해석되지 않는다", () => {
      const mdx = [
        "```ts",
        'if (a) { return "|" }',
        "```",
        "",
        "행렬 | 값",
        "--- | ---",
        "x | 1",
      ].join("\n");
      const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
      // JSON.stringify escapes quotes inside the fence value (`return \"|\"`).
      expect(text).toContain("return");
      expect(text).toContain("|");
      expect(text).toContain("x");
      expect(text).toContain("1");
    });
  });

  describe("블록 수식", () => {
    it("$$...$$ 블록 수식의 내용이 유실되지 않는다", () => {
      const mdx = [
        "태스크 큐는 <u>비동기 작업이 완료된 후</u> 순서대로 실행된다.",
        "",
        "$$",
        "\\text{마이크로태스트 큐} > \\text{애니메이션 콜백 큐} > \\text{매크로태스크 큐}",
        "$$",
      ].join("\n");
      const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
      expect(text).toContain("마이크로태스트 큐");
      expect(text).toContain("매크로태스크 큐");
    });

    it("코드 펜스 안의 SQL as $$ 는 블록 수식으로 바뀌지 않는다", () => {
      const mdx = [
        "```sql",
        "language plpgsql",
        "as $$",
        "begin return query; end;",
        "$$;",
        "```",
      ].join("\n");
      const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
      expect(text).toContain("$");
      expect(text).toContain("begin return query; end;");
    });
  });

  describe("원문 토글(§4.4)", () => {
    it("보기만 토글하면 serialize를 호출하지 않고 원문 바이트가 유지된다", () => {
      for (const relPath of SAMPLE_PATHS) {
        const source = readSample(relPath);
        const analysis = analyze(source);
        expect(analysis.source).toBe(source);
      }
    });

    it("임의 원문의 analyze.source도 원래 문자열과 같다", () => {
      const mdx = "## 주제\n\n문단이다.\n";
      expect(analyze(mdx, "toggle").source).toBe(mdx);
    });
  });

  describe("실제 src/contents 표본", () => {
    for (const relPath of SAMPLE_PATHS) {
      it(`${relPath} 의 왕복이 같은 문서를 다시 만든다`, () => {
        const source = readSample(relPath);
        const { firstDoc, secondDoc } = fullRoundtrip(source);
        expect(secondDoc).toEqual(firstDoc);
      });

      it(`${relPath} 의 analyze는 오류를 보고하지 않는다`, () => {
        const source = readSample(relPath);
        expect(analyze(source).errors ?? []).toEqual([]);
      });
    }
  });

  describe("미지원 문법·오류(§4.4)", () => {
    it("spread 속성은 오류 위치를 표시하고 원문을 삭제하지 않는다", () => {
      const mdx = ["# 미지원", "", "<Callout {...props}>내용</Callout>"].join("\n");
      const analysis = analyze(mdx, "spread-props");
      expect(analysis.errors ?? []).not.toEqual([]);
      const hasPosition = (analysis.errors ?? []).some(
        (error: { position: { line: number } }) => (error.position?.line ?? 0) >= 1,
      );
      expect(hasPosition).toBe(true);
      expect(analysis.source).toContain("{...props}");
      expect(analysis.source).toContain("내용");
    });

    it("함수 호출 속성은 거부되고 원문은 보존된다", () => {
      const mdx = [
        "<Tabs onChange={handle}>",
        '<Tab label="a">x</Tab>',
        '<Tab label="b">y</Tab>',
        "</Tabs>",
      ].join("\n");
      const analysis = analyze(mdx, "fn-prop");
      expect(analysis.errors ?? []).not.toEqual([]);
      expect(analysis.source).toContain("onChange={handle}");
    });

    it("미지원 문법이 포함된 문서는 시각 변환에서 유실되지 않는다", () => {
      const mdx = "<TemplateImport value={{a: 1}}>x</TemplateImport>";
      const analysis = analyze(mdx, "unsupported-doc");
      const firstDoc = toDocument(analysis);
      expect(analysis.source).toContain("<TemplateImport");
      expect(JSON.stringify(firstDoc)).toContain("x");
    });

    it("알 수 없는 코드 언어는 내용을 보존한다", () => {
      const mdx = "```madeup\nabstract sealed class Thing\n```";
      const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
      expect(text).toContain("sealed class");
    });
  });

  describe("메타데이터", () => {
    const FRONT = [
      "---",
      "title: loadFile",
      "status: published",
      "publishedDateTimeISO: 2025-08-07T19:17:00.000Z",
      "tags:",
      "  - typescript",
      "  - snippets",
      "policy:",
      "  discriminant: normal",
      "---",
      "",
      "## loadFile",
      "",
      "본문이다.",
    ].join("\n");

    it("frontmatter 값이 왕복에서 유실되지 않는다", () => {
      const text = JSON.stringify(fullRoundtrip(FRONT).secondDoc);
      expect(text).toContain("loadFile");
      expect(text).toContain("typescript");
      expect(text).toContain("normal");
    });
  });
});
