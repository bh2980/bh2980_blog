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

- 실제 문법 세부(리프/컨테이너 선택)는 기존 directive 파서가 인라인 내용을 가장 손실 없이 왕복하는 형태로 C6 작업자가 확정하고 이 문서 §4에 적는다. 요구사항: 셀 내용은 인라인만(GFM 표와 같음), `colspan`·`rowspan`·`header` 속성, 열 정렬 보존, 병합을 모두 풀면 GFM으로 돌아감.
- B3 블록 정의에 `table`(및 자식) 정의를 더하고 공개 렌더러를 둔다. D2 번역은 이 directive 구조를 보존한다.

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

(단계별로 채운다.)
