# @bh2980/cms-blocks

`@bh2980/cms`의 블록 확장. 본문 블록과 글자 꾸밈을 필요한 것만 플러그인으로 설치한다.

| 블록 | 플러그인 | 저장 문법 | 공개 화면 컴포넌트 |
| --- | --- | --- | --- |
| 콜아웃 | `callout()` | `:::callout{variant="tip" title="…"}` | `Callout` |
| 접기 | `collapsible()` | `:::collapsible{title="…"}` | `Collapsible` |
| 탭 | `tabs()` | `::::tabs` 안에 `:::tab{label="…"}` 2~8개 | `Tabs`·`Tab` |
| 단 나누기 | `columns()` | `::::columns{widths="60,40"}` 안에 `:::column` 2~4개 | `Columns`·`Column` |
| Mermaid | `mermaid()` | ` ```mermaid ` | `Mermaid` |
| 차트 | `chart()` | ` ```chart ` | `Chart` |
| 툴팁 | `tooltip()` | `:tooltip[글자]{content="설명"}` | `Tooltip` |
| 코드 연결 | `codeRef()` | `:code-ref[글자]{to="c1"}`(코드 줄 이름표 `// @line anchor {..} id="c1"`) | `CodeRef` |
| 글자색 | `color({ palette? })` | `:color[글자]{fg="#…" fgDark="#…" bg="#…" bgDark="#…"}` | `Color` |

## 설치

```ts
// cms.config.ts
import { blocks } from "@bh2980/cms-blocks";

export default defineConfig({
	// …
	plugins: [
		...blocks(), // 전부(콜아웃·접기·탭·단·Mermaid·차트·툴팁·코드 연결·글자색)
		// ...blocks({ only: ["callout", "tooltip"] })   고른 것만
		// ...blocks({ omit: ["chart"], codeRef: false }) 빼고(`false`도 뺀다)
		// ...blocks({ color: { palette: [...] } })       확장별 옵션
	],
});
```

하나씩 넣어도 된다(`plugins: [callout(), columns(), color({ palette })]`). 같은 확장을 두 번 넣으면 설정 오류다.

```css
@import "@bh2980/cms-admin/styles.css";
@import "@bh2980/cms-blocks/styles.css";
```

- 편집기: 콜아웃·접기·탭·단은 편집 화면이 함께 온다(관리자 테마 색, `styles.css`). Mermaid·차트는 코드 입력 칸과 미리보기로
  편집한다. 미리보기는 이 확장이 그리고(선택 의존성 `mermaid`·`recharts`를 앱이 설치한다. 미리보기를 열 때만 불러온다),
  사이트가 `fencePreviews`(`@bh2980/cms-admin`)로 같은 이름을 넣으면 그것이 이긴다. 차트 색은 CSS 변수 `--chart-1`~`--chart-5`이고
  앱이 정하지 않으면 `styles.css`의 기본값이다.
- 글자 꾸밈: 툴팁은 서식 도구(링크 뒤)·글자 버블·슬래시 메뉴, 글자색은 서식 도구(글자 꾸밈 뒤)·글자 버블, 코드 연결은 글자 버블
  (문서에 코드 블록이 있을 때)과 커서를 둔 연결의 설명·다시 연결·해제를 준다(`@bh2980/cms-admin` README의 "글자 꾸밈").
  코드 줄 이름표·코드 블록 줄 메뉴의 "본문 연결"·잇기 안내 줄·마우스를 올린 줄 강조는 본체 코드 블록 기능이고, 이 확장의
  `to` 속성(`codeAnchor`)으로 이 꾸밈을 쓴다. 코드 블록 안 글자 툴팁(`// @char Tooltip`)은 본체 코드 블록 기능이다.
- 글자색 고르기 목록은 `color({ palette })`(없으면 기본 8색 `DEFAULT_TEXT_PALETTE`). 본문에는 헥스 값이 저장되므로 목록을 바꿔도
  이미 쓴 글은 그대로다. 공개 화면은 `@bh2980/cms-blocks/color`의 `cleanTextColor`·`textColorProps`로 그리고, 색은
  `styles.css`의 `.cms-color`가 테마에 맞춰 고른다.
- 공개 화면: 사이트가 위 이름의 MDX 컴포넌트를 그린다. 코드 펜스 블록은 `remarkFenceBlocksToMdx`(`@bh2980/cms/mdx`)가
  `<Mermaid source="…" />`로 바꾼다. 단 너비는 `@bh2980/cms-blocks/columns`의 `parseColumnWidths`·`columnsGridTemplate`로,
  차트 문법·크기는 `@bh2980/cms-blocks/chart`의 `parseChartDsl`·`normalizeChartDsl`·`resolvePieGeometry`로 읽는다.
- 편집기 모양 바꾸기: `styles.css`의 변수(`--cms-callout-note`·`-tip`·`-info`·`-warning`·`-danger`, `--chart-1`~`5`)를 앱에서 정한다.
- 이미 쓴 블록의 플러그인을 빼면 그 블록은 저장 문법에서 빠져 다시 저장할 때 일반 글로 바뀐다.

플러그인 없이 정의만 쓰려면(예: 테스트) `@bh2980/cms-blocks/definitions`의 정의를 설정의 `blocks`에 넣는다.

## AI 기능 (선택)

`@bh2980/cms-ai`를 쓰는 사이트에는 `mermaid()`·`chart()`가 AI 기능을 저절로 더한다(플러그인 `contributes.ai`). 설정에 적지 않는다.

| 블록 | 기능 이름 | 붙는 곳 |
| --- | --- | --- |
| `mermaid()` | `diagramDraft` · `diagramEdit` | 다이어그램 만들기(슬래시 메뉴) · 고치기(블록 손잡이 옆) |
| `chart()` | `chartDraft` · `chartEdit` | 차트 만들기 · 고치기 |

바꾸거나 끌 때만 같은 이름으로 적는다.

```ts
import { mermaidAi } from "@bh2980/cms-blocks/mermaid/ai";

aiPlugin({ actions: { diagramDraft: mermaidAi.draft({ prompt: "…" }), chartEdit: false } });
```

블록 확장은 AI 플러그인 코드를 불러오지 않는다(타입만 읽는다). AI 플러그인이 없는 사이트에서는 기여가 쓰이지 않는다.

두 기능은 결과 문법을 코드 검사(`mermaidSyntax`·`chartSyntax`)로 본다. 같은 검사를 다른 기능의 `checks`에 넣어 쓸 수 있다.
개발 전용 가짜 연결(`CMS_AI_FAKE=1`)에는 기능 정의의 `fake`로 문법 검사를 통과하는 답을 준다(만들기는 예시 블록, 고치기는
원래 블록에 한 줄을 더한 것).
차트 지시문에는 차트 문법 설명(`CHART_SYNTAX_GUIDE`)이 들어간다. 차트 문법은 `@bh2980/cms-blocks/chart`의
`parseChartDsl`·`normalizeChartDsl`이 읽는다.

## 새 블록 만들기

이 패키지의 블록도 사이트가 만드는 블록과 같은 방법으로 만든다. 블록 정의(`defineBlock`) 하나와, 필요하면 편집 화면이다.

```ts
// 정의: 저장 문법·속성·편집 방식
export const bannerBlock = defineBlock({ name: "banner", syntax: { kind: "container", directive: "banner" }, … });

// 플러그인: 블록과 관리자 화면 쪽(선택)
export const banner = () =>
	definePlugin({ name: "banner", options: {}, blocks: [bannerBlock], admin: () => import("./banner/admin") });

// banner/admin.ts: 편집 화면 전체(blockViews)나 속성 상자(blockEditors)를 넣는 공급자
export default defineAdminPlugin({ Provider: BannerProvider });
```

편집 화면이 없으면 관리자 화면의 기본 상자로 편집한다. 메뉴 아이콘(`editor.icon`)이 관리자 패키지의 기본 아이콘에 없으면
공급자에서 `icons`로 등록한다(이 패키지의 블록은 모두 그렇게 한다). 번역할 속성(제목·탭 이름)에는 `translatable: true`를 단다. 자세한 것은 `@bh2980/cms` README의 "본문 블록"과
`@bh2980/cms-admin` README의 "블록 편집 화면".

## 개발

```bash
pnpm --filter @bh2980/cms-blocks test:run
pnpm --filter @bh2980/cms-blocks typecheck
```
