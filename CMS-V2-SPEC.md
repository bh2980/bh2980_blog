# bh2980 블로그 CMS v2 — 범위와 설계 메모

작성일: 2026-09-27 · 상태: **A(UI 기반) 구현 완료 · B 이후 착수 전** · 브랜치: `feature/cms-v2` (`feature/new-cms`의 `cda2fff1`에서 분기)

> v1 명세는 [`CMS-SPEC.md`](CMS-SPEC.md)다. 이 문서는 v1 위에 더하거나 바꾸는 것만 적는다. 여기에 적지 않은 동작은 v1 명세를 따른다.

## 0. 방향

- **v1을 따로 운영 전환하지 않는다.** v2까지 만든 뒤 한 번에 전환한다. v1에서 남은 검수(실제 한글 IME, 실 R2 업로드, 배포 후 smoke, 데이터 이전)는 v2 완료 조건(E)에 포함한다.
- **진행 순서: A → B → C → D → E.** A는 이후 모든 화면의 부품과 토큰을 정한다. B의 스키마·블록 정의 규격은 C의 블록 삽입 UI와 관계 기능의 토대다.
- 에디터를 먼저 완성하고 실제로 써 보면서 v3 범위를 정한다.

## 1. 범위

| ID | 기능 | 영역 |
| --- | --- | --- |
| A0 | Base UI 전환, 디자인 토큰, shadcn 부품으로 통일, 라이트 테마 | UI 기반 |
| A1 | Data Table 목록과 컬럼 헤더의 엑셀식 필터 | UI 기반 |
| A2 | 파일 탐색기식 오른쪽 클릭 메뉴 | UI 기반 |
| A3 | 휴지통 전용 화면·사이드바 메뉴·일괄 영구 삭제 | UI 기반 |
| A4 | 이름 붙인 저장된 보기 | UI 기반 |
| B1 | 코드로 정의하는 중앙 스키마 (Keystatic식 `fields.*`) | 스키마·확장(F07) |
| B2 | 관계 강화: 없는 대상 바로 만들기, 반대 방향 편집(게시글→모음집) | 스키마·확장 |
| B3 | 블록 정의 규격 (스키마·편집 UI·MDX 입출력·공개 렌더러) | 스키마·확장 |
| C1 | 노션식 블록 드래그 앤 드롭 | 에디터 |
| C2 | 이미지 드래그 크기 조절·크롭·회전 | 에디터 |
| C3 | 커스텀 블록 삽입 UI (Callout·Collapsible·Tabs·Columns·Tooltip·Mermaid·차트) | 에디터 |
| C4 | Mermaid·차트·수식 편집기 내 미리보기 | 에디터 |
| C5 | 코드 블록 고도화 (하이라이팅, 코드 안 밑줄·툴팁 주석, 줄 번호·언어 UI, 키·붙여넣기) | 에디터 |
| C6 | 표 셀 병합 | 에디터 |
| D1 | AI slug 추천·태그 추천 (선택 기능) | AI 보조 |
| E1 | v1 잔여 검수 + 데이터 이전 + `main` 병합·운영 전환 | 전환 |

### 1.1 v2에서 하지 않는 일

- **v3로 미룸:** 예약 실행기 연결(§8 메모), 휴지통 자동 비우기(§8 메모), 모바일 전용 편집, 실제 사용 중 나오는 요구.
- **하지 않음:** 스키마를 DB에 저장하고 관리자 UI로 필드를 추가·삭제하는 빌더(2026-09-27 결정, §9), AI 요약·alt 등 추천 외 기능, 공동 편집.

## 2. A — UI 기반

상세 작업 계획과 구현 결과(2026-09-27 완료)는 [`docs/cms/v2/a-ui-foundation.md`](docs/cms/v2/a-ui-foundation.md)에 있다. 여기에는 v2 전체에 적용되는 원칙만 둔다.

- **shadcn에 있는 컴포넌트를 우선 쓴다.** 필요한 컴포넌트는 shadcn CLI로 받아 설치한다(사용자 허가 2026-09-27).
- **primitive는 Radix에서 Base UI로 옮긴다.** 관리자와 블로그가 함께 쓰는 `src/components/ui` 전체가 대상이다.
- 색은 shadcn 디자인 토큰만 쓰고, 관리자 화면도 밝은·어두운 테마를 모두 지원한다.
- 목록은 shadcn Data Table로 바꾸고 컬럼 헤더에서 엑셀식으로 거른다. 휴지통은 전용 화면으로, 저장된 보기는 폴더를 제외한 조건으로 둔다.
- A 작업 순서: A0 → A1 → A2 → A3 → A4.

## 3. B — 스키마와 확장 (F07)

### 3.1 B1 중앙 스키마

컬렉션을 Keystatic처럼 코드 한 곳에서 정의한다. 현재는 필드 하나(`replacementPostId`)가 `collections.ts`·`types.ts`·`snapshot.ts`·`entry-form.ts`·`inspector-panel.tsx`·`postgres.ts` 6곳에 흩어져 있다.

```ts
export const post = collection({
  label: "게시글",
  workflow: "publish",
  fields: {
    title: fields.text({ label: "제목", required: "publish", max: 200 }),
    slug: fields.slug({ from: "title", actions: ["suggestSlug"] }),
    summary: fields.text({ label: "요약", multiline: true, description: "비우면 자동 생성" }),
    categoryId: fields.relation({ to: "category", label: "카테고리", required: "publish", createInline: true }),
    tagIds: fields.relation({ to: "tag", many: true, label: "태그", createInline: true, actions: ["suggestTags"] }),
    publishedAt: fields.datetime({ label: "발행일" }),
    policy: fields.conditional(
      fields.select({ label: "정책", options: { normal: "일반", evergreen: "항상 최신 글", deprecated: "지원 중단" } }),
      { deprecated: { replacementPostId: fields.relation({ to: "post", label: "최신 글" }) } },
    ),
  },
  layout: [
    { group: "기본", fields: ["title", "slug", "summary"] },
    { group: "분류", fields: ["categoryId", "tagIds"] },
    { group: "정책", fields: ["policy"], collapsed: true },
  ],
  list: { columns: ["title", "status", "categoryId", "tagIds", "updatedAt"] },
});
```

- 정의 하나로 TypeScript 타입, 서버 검증·저장, 속성 패널 입력 UI, 목록 컬럼·필터(A1), 관계 참조 추적이 동작한다.
- 상태는 필드가 아니다(발행 흐름이 관리). `required: "publish"`는 발행 때만 필수다.
- UI 변경 3단계: ① 타입별 기본 입력 ② `actions`로 입력 옆 버튼 추가 ③ `fields.custom({ input: "color-picker" })`로 입력 교체.
- **스키마는 서버·브라우저 공용이므로 React 컴포넌트·함수·비밀 값을 넣지 않는다.** 입력 컴포넌트와 액션은 이름으로만 가리키고, 실제 구현은 클라이언트 등록부(컴포넌트)와 서버 등록부(액션, API 키)에 둔다.
- 공개 블로그에 새 필드를 보여주려면 공개 템플릿 코드는 따로 고친다.

### 3.2 B2 관계 강화

- 관계 필드마다 `createInline`으로 "없으면 바로 만들기"를 켠다(현재 태그·카테고리 하드코딩을 일반화).
- 반대 방향 편집: 게시글 속성 패널에 `모음집` 필드를 두고 모음집 추가·제거·새로 만들기를 한다. **제안(미확정):** 데이터는 지금처럼 모음집이 `itemIds`를 가지고, 이 필드는 게시글 초안이 아니라 모음집 레코드를 즉시 저장하며 UI에 그렇게 표시한다. 추가하면 모음집 끝에 들어간다.

### 3.3 B3 블록 정의 규격

블록마다 설정 스키마, 편집 UI(NodeView·설정 폼), MDX directive 입출력, 공개 렌더러를 한 곳에서 정의한다. C3의 7종을 이 규격으로 만든다. 외부 플러그인 로더는 만들지 않는다. `/meta`의 `extensions` 예제 메타데이터는 이 규격으로 대체한다.

## 4. C — 에디터

- **C1 드래그 앤 드롭:** ⋮⋮ 핸들을 끌어 블록을 옮긴다. 기존 키보드 이동·메뉴는 유지하고 메뉴는 `DropdownMenu`로 바꾼다. 중첩 이동은 부모가 허용하는 구조 안에서만 한다(v1 §4.2).
- **C2 이미지:** 모서리 핸들로 너비를 조절한다(기존 px·% 규칙). 크롭·회전을 추가한다. 크롭·회전의 저장 방식(새 파일 생성 vs 표시 속성)은 C 구체화 때 정한다.
- **C3 커스텀 블록 삽입 UI:** Callout·Collapsible·Tabs·Columns·Tooltip·Mermaid·차트를 슬래시 메뉴와 설정 폼으로 삽입·편집한다. B3 위에서 만든다.
- **C4 미리보기:** Mermaid·차트·수식을 편집기 안에서 렌더링한다.
- **C5 코드 블록:** 하이라이팅, 코드 안 밑줄·툴팁 등 주석 편집, 줄 번호·언어 선택 UI, 들여쓰기·붙여넣기 키 처리. Keystatic 제거 커밋 `002720d3`에서 지운 `src/keystatic/fields/mdx/components/code-block/**`·`plugins/pm/codeblock-keys.ts`·`codeblock-paste.ts`를 참고한다. 저장 형식은 기존 코드 펜스 주석 문법(`src/libs/annotation/code-block`)을 유지한다.
- **C6 표 셀 병합:** GFM으로 표현할 수 없으므로 병합이 있는 표만 새 directive로 저장하고, 병합 없는 표는 GFM을 유지한다. 문법은 C 구체화 때 정한다.

## 5. D — AI 보조

- slug 추천, 태그 추천부터 시작한다. B1의 `actions`로 붙인다.
- 버튼을 눌렀을 때만 호출하고 결과는 제안으로만 보여준다. 사용자가 수락해야 값이 바뀐다.
- API 키가 서버에 없으면 액션이 사용 불가를 반환하고 버튼을 숨긴다. 제공자 SDK와 키는 서버 등록부에만 둔다.

## 6. E — 운영 전환

v1 명세 §11.3·§12.2의 전환 절차와 검수를 v2 결과물에 대해 수행한다. 실제 OS 한글 IME, 실 R2 업로드, 배포 후 smoke, 전체 기존 MDX 왕복 검수를 포함한다. 운영 데이터 이전과 공개 전환은 사용자 승인 후 실행한다.

## 7. 확인이 남은 것

- B2 반대 방향 편집의 저장 방식(§3.2 제안).
- C2 크롭·회전 저장 방식, C6 셀 병합 directive 문법.
- A의 확인 사항은 [`docs/cms/v2/a-ui-foundation.md`](docs/cms/v2/a-ui-foundation.md) §9에 답을 적었다.

## 8. v3 메모

- **예약 실행기:** v1의 예약 API는 그대로 둔다. 무료 운영 기준으로 GitHub Actions `schedule`(5분 단위, 지연 가능)이 유력하다. Vercel Hobby Cron의 실행 빈도 제한은 연결 시 확인한다.
- **휴지통 자동 비우기:** 예약 실행기를 연결할 때 같은 실행기로 처리한다(2026-09-27 결정). 영구 삭제의 참조 검증은 수동 삭제와 같게 적용한다. 실행기 없이 휴지통을 열 때 안내하는 방식은 채택하지 않았다.

## 9. 결정 기록

| 날짜 | 결정 |
| --- | --- |
| 2026-09-27 | v1 단독 전환 없이 v2까지 만든 뒤 한 번에 전환 |
| 2026-09-27 | 예약 실행기·휴지통 자동 비우기는 v3 |
| 2026-09-27 | 스키마는 코드로 정의(Keystatic식). DB 저장·UI 스키마 빌더는 하지 않음 |
| 2026-09-27 | AI는 slug·태그 추천부터, 선택 기능 |
| 2026-09-27 | 관리자 화면 라이트 테마 지원 |
| 2026-09-27 | 저장된 보기에 폴더 제외 |
| 2026-09-27 | shadcn 컴포넌트 우선 사용, CLI 설치 허가, Radix → Base UI 전환 |
