# CMS v2 — C. 에디터 작업 계획

작성일: 2026-09-27 · 상태: **진행 중** · 브랜치: `feature/cms-v2`

> 범위는 [`CMS-V2-SPEC.md`](../../../CMS-V2-SPEC.md) §4. 이 문서는 결정·구현 설계·순서·결과다. 여기에 적지 않은 동작은 v1 명세 [`CMS-SPEC.md`](../../../CMS-SPEC.md) §4를 따른다. **C7(에디터 UI·디자인 개선)은 이번 범위에서 뺀다**(2026-09-27 사용자 결정).

## 1. 결정 (명세 §7에서 남은 것)

### 1.1 C2 크롭·회전 저장 방식 — 표시 속성

- 원본 파일은 그대로 두고 `::image`에 속성을 더한다. 새 파일을 만들지 않는다(R2·미디어 참조 무관, 되돌리기 쉬움).
- `crop="x,y,w,h"`: 원본 기준 백분율(0~100, 소수 둘째 자리까지). 없으면 전체.
- `rotate="90|180|270"`: 시계 방향. 없거나 `0`이면 회전 없음.
- 공개 렌더러(`src/components/mdx/image.tsx`)와 에디터가 같은 계산 함수(`src/cms/mdx/image-transform.ts`)로 CSS를 만든다. 잘못된 값은 무시한다(너비 규칙과 같음).
- 너비 조절은 모서리 핸들로 기존 `width`(px·%) 규칙에 쓴다.

### 1.2 C6 셀 병합 문법 — 병합이 있는 표만 `table` directive

병합 없는 표는 GFM 그대로. 병합이 하나라도 있으면:

```md
::::table{align="left,center"}
:::row
::cell[제목]{header colspan=2}
:::
:::row
::cell[값]{rowspan=2}
::cell[값]
:::
::::
```

- 확정 문법:
  - 표: 컨테이너 지시자 `::::table{align="..."}`. `align`은 열 정렬(left, center, right)을 쉼표로 잇는다.
  - 행: 컨테이너 지시자 `:::row`.
  - 셀: 리프 지시자 `::cell[인라인]{header colspan=N rowspan=N}`. 인라인 서식(`**굵게**`, `*기울임*`, `` `코드` ``, `:br[]` 줄바꿈 등)을 온전히 보존한다.
  - 속성: `header`(불리언 참일 때만 이름 기재), `colspan`(2 이상일 때만 기재), `rowspan`(2 이상일 때만 기재).
  - 병합 없는 표는 기존 GFM 표(`| a | b |`)로 저장되며 바이트 불변을 보장한다.
  - 병합 표에서 모든 병합을 해제하면 자동으로 GFM 표로 복귀한다.
- B3 블록 정의(`src/cms/blocks/definitions.ts`)에 `table`, `row`, `cell` 정의를 추가하고 parent/children 관계를 명시한다.
- 발행 전 검사(`src/cms/core/snapshot.ts`)에서 rowspan의 전체 행 수 초과, 병합 영역 중복, 행별 열 수 불일치, 0 이하의 span 값을 감지하여 `invalid_table_span` 경고를 보고한다.
- 공개 렌더러(`src/components/mdx/table.tsx`)에서 `Table`, `TableRow`, `TableCell`을 구현하고, 표 격자 구조를 계산해 각 셀에 올바른 열 정렬(`align`)을 주입한다.
- 편집기(`src/cms/editor/converters/table.ts` 및 `tiptap-editor.tsx`)에서 `CmsTable`을 통해 colspan/rowspan을 보존하고, `CellSelection` 시 활성화되는 '셀 병합'·'셀 나누기' 도구를 제공한다.

### 1.3 C3 편집 방식

- **컨테이너(Callout·Collapsible·Tabs·Tab·Columns·Column):** NodeView 안에서 본문을 바로 편집한다(content hole). 속성은 블록 머리의 설정 버튼 → 정의(`attributes`)에서 만든 설정 폼(Popover)으로 바꾼다.
- **펜스·수식(Mermaid·차트·수식):** 원자 노드. 원문 편집 칸 + 미리보기(C4).
- **Tooltip:** 선택한 글자에 툴팁 마크를 거는 툴바·슬래시 명령, 설명 입력 Popover.
- 슬래시 메뉴는 정의의 `editor.insertable`·`keywords`로 만든다. 정의에 없는 삽입 경로를 따로 두지 않는다.
- 편집 UI가 없는 구조(예: 알 수 없는 directive)는 지금처럼 원문 보존 상자로 둔다.

### 1.4 C4 미리보기

공개 렌더러(`src/components/mdx/mermaid.client.tsx`, `chart.tsx`, katex)를 재사용하고 지연 로드한다. 렌더 오류는 편집기 안에 오류 문구로 보이고 원문은 잃지 않는다.

### 1.5 C5 범위

Keystatic 제거 커밋 `002720d3`에서 지운 코드 블록 NodeView·툴바·`codeblock-keys.ts`·`codeblock-paste.ts`를 참고한다. 하이라이팅(shiki, 편집기 decoration), 언어 선택, 줄 번호·파일명 등 기존 `meta` 표시, 코드 안 밑줄·툴팁 주석 편집, Tab/Shift-Tab 들여쓰기·Enter 들여쓰기 유지·붙여넣기(서식 없는 텍스트). 저장 형식은 코드 펜스 주석 문법(`src/libs/annotation/code-block`) 그대로.

## 2. 순서와 오케스트레이션

| 단계 | 내용 | 방식 |
| --- | --- | --- |
| C0 | 에디터 기반 정리(동작 불변): 확장 조립 등록부, 블록 변환기 등록부, 키 처리 분리, 왕복 테스트 틀 | 작업자 1, 순차 |
| 웨이브 A | C1 드래그 앤 드롭 · C2 이미지 · C5 코드 블록 · C6 표 셀 병합 | 작업자 4, worktree 병렬 |
| 웨이브 B | C3 컨테이너 블록 → C3 Tooltip + C4 미리보기 | C1 병합 후 |
| 통합 | 전체 게이트·브라우저 확인·문서 | 오케스트레이터 |

- 작업자: `gpt-6-luna`, `gemini-3.8-flash`. 리뷰: `gpt-6-sol`, `gemini-3.1-pro`, `claude-opus-5.5`. 복잡한 부분은 오케스트레이터가 직접 고친다.
- 병합 게이트: `pnpm test:run`, `pnpm typecheck`, `pnpm exec biome check .`, `pnpm build`, `pnpm cms:migration:audit`, 브라우저 확인. 커밋은 `feat(cms): v2 C{n} ...`.
- DB 이전이 필요해지면 멈추고 사용자에게 묻는다.

## 3. 완료 조건

- C1~C6이 편집기에서 동작하고 저장 결과가 명세 문법대로 왕복한다(기존 코퍼스 왕복 검수 불변).
- 전체 테스트·타입 검사·Biome·빌드 통과, 브라우저 확인.

## 4. 구현 결과

### 4.1 C1 노션식 블록 드래그 앤 드롭 결과

- **구현 요약:**
  - 핸들 오버레이(`src/cms/editor/block-handle-overlay.tsx`)의 메뉴를 Base UI 기반 shadcn `DropdownMenu`의 render prop 구조로 교체하고 `draggable={true}`와 드래그 이벤트를 연동함.
  - 마우스 클릭 시에는 기존처럼 블록 메뉴(위/아래 이동, 복제, 삭제)가 열리며, 드래그 시에는 ProseMirror의 `NodeSelection` 및 드래그 상태(`view.dragging = { slice, move: true, cmsBlockPos }`)를 설정하여 드롭 연산을 개시함.
  - 드래그 중 드롭 위치 표시는 Tiptap StarterKit의 `Dropcursor`를 사용해 삽입 위치를 표시함.
  - 드래그 이동 명령을 순수 함수(`src/cms/editor/drag/drag-commands.ts`)로 분리하여 `canDropBlockNode`, `calculateDropPosition`, `moveBlockNode`를 통해 스키마 제약(`canReplaceWith` / `contentMatch`)을 엄격히 검증함. 스키마가 허용하지 않는 위치(예: 코드 블록 내부, 문서 루트의 listItem, 원자 노드 내부 등)는 드롭을 거부(무시)함. 표시선은 Tiptap 기본 Dropcursor 규칙을 따르므로 거부 위치에도 보일 수 있음.
  - 단일 ProseMirror 트랜잭션(`tr.delete` + `tr.insert`)으로 원자적 이동을 수행하여 '한 드래그 = 한 undo'를 보장함.
  - 원자 노드(이미지 `image`, 원문 보존 상자 `cmsOpaqueBlock`, `cmsMermaid` 등) 및 중첩 블록(목록 항목 `listItem`/`taskItem`, 인용구 `blockquote` 내부 문단) 모두 핸들이 가리키는 블록 단위로 이동 가능함. 기존 키보드 단축키(`Alt+↑/↓` 등)는 v1처럼 최상위 블록 단위 이동을 유지함.

#### NodeView 컨테이너 드래그 규약 (C3 연계)

C3에서 도입되는 컨테이너 NodeView(Callout, Collapsible, Tabs, Columns 등 content hole을 가진 블록)는 다음 규약을 따른다:

1. **DOM 계층 구조 규약:**
   - 컨테이너 루트 래퍼 요소에는 TipTap 표준 `[data-node-view-wrapper]` 속성을 둔다.
   - 자식 블록들이 편집되는 content hole(contentDOM) 요소에는 `[data-node-view-content]` 속성 또는 `ProseMirror-content` 클래스를 둔다.
2. **핸들 대상 블록 감지 우선순위 (`findBlockDOM`):**
   - 마우스 커서가 `[data-node-view-content]` 내부의 자식 요소 위에 위치하면, 해당 자식 블록(예: Callout 안의 문단, 컬럼 안의 목록 등)을 이동 단위로 인식하여 핸들을 표시한다.
   - 마우스 커서가 `[data-node-view-wrapper]` 내부이지만 `[data-node-view-content]` 바깥(예: 컨테이너 헤더, 타이틀 영역, 접기/펼치기 버튼, 테두리 여백)에 위치하면, 컨테이너 NodeView 자체를 이동 단위로 인식하여 핸들을 표시한다.
3. **스키마 수용성 검증 규약:**
   - 컨테이너 내부로 다른 블록을 드롭하거나, 컨테이너 내부의 블록을 외부/다른 컨테이너로 드롭할 때 `parent.canReplaceWith` 및 `contentMatch`를 통해 대상 컨테이너의 `content` 스키마 제약(예: `content: "block+"`, Tabs/Columns 자식 제약 등)을 사전에 검사한다.
   - 컨테이너가 허용하지 않는 노드 타입은 드롭이 무시되며, 드롭 자체가 거부된다(기본 Dropcursor 표시선은 뜰 수 있다).
4. **원자적 이동 및 Undo 일관성:**
   - 컨테이너 안팎의 블록 이동은 항상 `moveBlockNode` 순수 함수를 거쳐 단일 트랜잭션으로 커밋되므로, 컨테이너에서 꺼내거나 집어넣는 동작도 정확히 1회의 `Undo`로 원상복구된다.

### 4.2 C6 표 셀 병합 구현 완료 (2026-09-27)

1. **확정 저장 문법:**
   - 표 컨테이너: `::::table{align="left,center"}` (정렬 없을 시 `::::table`)
   - 행 컨테이너: `:::row` ... `:::`
   - 셀 리프: `::cell[인라인 내용]{header colspan=2 rowspan=2}`
   - 병합(colspan > 1 또는 rowspan > 1)이 있는 경우에만 directive로 저장, 병합이 없으면 기존 GFM 표 바이트 그대로 유지.
   - 모든 병합 해제 시 자동으로 GFM 표로 복귀.

2. **구현 모듈:**
   - 블록 정의: `src/cms/blocks/definitions.ts` (`table`, `row`, `cell`), `src/cms/mdx/registry.ts`
   - MDX 파싱/직렬화: `src/cms/mdx/to-document.ts`, `src/cms/mdx/serialize.ts`
   - 발행 전 검사: `src/cms/core/snapshot.ts` (`checkTableSpans`, `invalid_table_span` 경고)
   - 편집기 연동: `src/cms/editor/converters/table.ts` (colspan/rowspan/header 보존), `src/cms/editor/tiptap-editor.tsx` (셀 병합/셀 나누기 버튼, CellSelection 활성)
   - 공개 렌더러: `src/components/mdx/table.tsx` (`Table`, `TableRow`, `TableCell`), `src/components/mdx/mdx-content.tsx` 등록

3. **테스트:**
   - `src/cms/mdx/__test__/table-roundtrip.test.ts` (MDX 왕복, GFM 복귀, 바이트 불변)
   - `src/cms/core/__test__/table-validation.test.ts` (span 초과/중복/불일치 경고)
   - `src/cms/editor/__test__/table-merge.test.ts` (편집기 병합/나누기 및 직렬화)
   - `src/components/mdx/__test__/table.test.tsx` (공개 컴포넌트 렌더 및 정렬 분배)
>>>>>>> theirs
