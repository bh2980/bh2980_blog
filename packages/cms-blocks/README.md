# @bh2980/cms-blocks

`@bh2980/cms`의 블록 확장. 본문 블록을 필요한 것만 플러그인으로 설치한다.

| 블록 | 플러그인 | 저장 문법 | 공개 화면 컴포넌트 |
| --- | --- | --- | --- |
| 콜아웃 | `callout()` | `:::callout{variant="tip" title="…"}` | `Callout` |
| 접기 | `collapsible()` | `:::collapsible{title="…"}` | `Collapsible` |
| 탭 | `tabs()` | `::::tabs` 안에 `:::tab{label="…"}` 2~8개 | `Tabs`·`Tab` |
| 단 나누기 | `columns()` | `::::columns{widths="60,40"}` 안에 `:::column` 2~4개 | `Columns`·`Column` |
| Mermaid | `mermaid()` | ` ```mermaid ` | `Mermaid` |
| 차트 | `chart()` | ` ```chart ` | `Chart` |

## 설치

```ts
// cms.config.ts
import { callout, columns, mermaid } from "@bh2980/cms-blocks";

export default defineConfig({
	// …
	plugins: [callout(), columns(), mermaid()],
});
```

```css
@import "@bh2980/cms-admin/styles.css";
@import "@bh2980/cms-blocks/styles.css";
```

- 편집기: 콜아웃·접기·탭·단은 공개 화면과 비슷한 편집 화면이 함께 온다. Mermaid·차트는 코드 입력 칸과 미리보기로
  편집하고, 미리보기는 사이트가 `fencePreviews`(`@bh2980/cms-admin`)로 넣는다.
- 공개 화면: 사이트가 위 이름의 MDX 컴포넌트를 그린다. 코드 펜스 블록은 `remarkFenceBlocksToMdx`(`@bh2980/cms/mdx`)가
  `<Mermaid source="…" />`로 바꾼다. 단 너비는 `@bh2980/cms-blocks/columns`의 `parseColumnWidths`·`columnsGridTemplate`로 읽는다.
- 이미 쓴 블록의 플러그인을 빼면 그 블록은 저장 문법에서 빠져 다시 저장할 때 일반 글로 바뀐다.

플러그인 없이 정의만 쓰려면(예: 테스트) `@bh2980/cms-blocks/definitions`의 정의를 설정의 `blocks`에 넣는다.

## AI 기능 (선택)

`@bh2980/cms-ai`를 쓰는 사이트는 Mermaid·차트 AI 기능을 넣을 수 있다.

```ts
import { chartAi } from "@bh2980/cms-blocks/chart/ai";
import { mermaidAi } from "@bh2980/cms-blocks/mermaid/ai";

aiPlugin({
	actions: {
		diagramDraft: mermaidAi.draft(), // 다이어그램 만들기(슬래시 메뉴)
		diagramEdit: mermaidAi.edit(), // 다이어그램 고치기(블록 손잡이 옆)
		chartDraft: chartAi.draft(), // 차트 만들기
		chartEdit: chartAi.edit(), // 차트 고치기
	},
});
```

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

편집 화면이 없으면 관리자 화면의 기본 상자로 편집한다. 자세한 것은 `@bh2980/cms` README의 "본문 블록"과
`@bh2980/cms-admin` README의 "블록 편집 화면".

## 개발

```bash
pnpm --filter @bh2980/cms-blocks test:run
pnpm --filter @bh2980/cms-blocks typecheck
```
