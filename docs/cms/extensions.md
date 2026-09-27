# CMS 확장 방법

v2부터 컬렉션 필드(B1)와 본문 블록(B3)을 코드 한 곳에서 정의합니다. 외부 플러그인 로더는 없습니다 — 이 저장소의 정의 파일과 등록부를 고칩니다. v1의 `extensions-example.ts` 예제 메타데이터는 이 규격으로 대체했습니다.

## 1. 컬렉션 필드 (B1)

- **정의:** [`src/cms/schema/definitions.ts`](../../src/cms/schema/definitions.ts)의 `collection({ fields: { title: fields.text(...), ... } })`.
- 정의 하나에서 TypeScript 타입, 서버 검증·저장, 속성 패널 입력, 목록 컬럼, 관계 참조 추적이 동작합니다.
- 필드 종류: `text`·`slug`·`relation`·`datetime`·`select`·`conditional`·`backlink`(반대 방향 관계, B2). 언어별 값은 `localized`(B4).
- **입력 교체:** 필드에 `input: "이름"`을 적고 [`field-inputs.tsx`](../../src/app/(admin)/admin/entries/field-inputs.tsx)의 `FIELD_INPUTS`에 컴포넌트를 둡니다.
- **입력 옆 버튼:** `actions: ["이름"]`. 서버 액션 등록부는 D1(AI 추천)에서 만듭니다.
- 공개 블로그에 새 필드를 보이려면 공개 템플릿 코드는 따로 고칩니다.

자세한 규칙은 [`docs/cms/v2/b1-schema.md`](./v2/b1-schema.md)에 있습니다.

## 2. 본문 블록 (B3)

- **정의:** [`src/cms/blocks/definitions.ts`](../../src/cms/blocks/definitions.ts)의 `defineBlock({ ... })`. 규격은 [`define.ts`](../../src/cms/blocks/define.ts).
- 블록 하나가 가진 것:
  - `syntax` — 저장 문법. 지시자(`:::이름`·`::이름`·`:이름[...]`), 코드 펜스(` ```mermaid `), 수식(`$$`).
  - `attributes` — 설정 속성(종류, 필수, 선택 값, 기본값, 입력). 발행 전 검사가 필수·선택 값을 확인합니다.
  - `children`·`parent` — 자식 블록과 개수(탭 2~8, 단 2~4), 어느 블록 안에서만 쓰는지.
  - `editor` — 에디터 표현(`opaque` 원문 보존 상자, `node` 전용 NodeView, `mark` 글자 꾸밈, `attribute` 다른 노드의 속성)과 슬래시 메뉴 노출·검색어.
  - `component` — 공개 렌더러 이름. 수식처럼 렌더 플러그인이 그리면 `renderedBy`.
- 정의에서 만드는 것: 지시자 표(`src/cms/mdx/directives.ts`), 자식 개수·정렬 값 상수, 속성 검증, `/meta`의 `blocks`.
- **구현을 두는 곳(이름으로 연결):**
  - 공개 렌더러 — [`mdx-content.tsx`](../../src/components/mdx/mdx-content.tsx)의 `MDX_COMPONENTS`
  - 에디터 NodeView — [`block-views.ts`](../../src/cms/editor/block-views.ts)의 `BLOCK_NODE_VIEWS`
- 정의 테스트(`src/cms/blocks/__test__/blocks.test.ts`)가 등록부 누락, 자식·부모 이름, 직렬화, 지시자 표를 확인합니다.

지금 전용 NodeView가 있는 블록은 이미지뿐이고, 나머지는 원문 보존 상자로 편집합니다. 콜아웃·접기·탭·단·툴팁·Mermaid·차트의 삽입 UI와 NodeView는 C3에서 이 규격 위에 만듭니다.

## 3. `/meta`

`GET /api/cms/v1/meta`(관리자 인증)는 `schemas`(컬렉션 정의), `definitions`(v1 모양의 요약), `blocks`(블록 정의)와 서버 제한을 돌려줍니다. 모두 JSON으로 직렬화할 수 있는 값뿐입니다. 응답 모양은 [`docs/cms/openapi.yaml`](./openapi.yaml)이 기준입니다.

## 4. 보안과 공개 반영

- 정의에 함수·React 컴포넌트·비밀 값을 넣지 않습니다. 구현은 이름으로 가리키는 등록부에 둡니다.
- 공개 메타데이터에는 `src/cms/services/export-service.ts`의 공개 DTO allowlist를 적용합니다. 관리자 전용 필드를 공개 응답에 그대로 전달하지 마세요.
- API 경로를 추가하거나 바꾸면 `docs/cms/openapi.yaml`과 `src/cms/__test__/openapi-contract.test.ts`를 함께 갱신합니다.
