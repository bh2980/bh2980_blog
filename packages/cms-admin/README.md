# @bh2980/cms-admin

`@bh2980/cms`의 관리자 화면(Next.js App Router). 목록·편집기(tiptap)·미디어·본문 템플릿·휴지통·로그인 화면을 준다.
플러그인(예: `@bh2980/cms-ai`)이 화면·사이드바 항목·필드 옆 버튼·편집 화면 동작을 더한다.
화면은 본체의 관리자 API(`/api/cms/v1/*`)만 부른다. 설치하지 않고 같은 API로 화면을 직접 만들어도 된다.

## 붙이기

설치·라우트·스타일은 `@bh2980/cms` README의 "빈 Next 앱에 설치"를 따른다. 관리자 화면 주소는 `/admin`이고,
로그인은 `/admin/login`으로 보낸다.

## 사이트 컴포넌트 넣기

편집기의 코드 펜스 미리보기(예: `mermaid`·`chart`)와 필드 입력은 사이트가 넣는다. 클라이언트 컴포넌트에서 넣는다.

```tsx
"use client";
import { CmsAdminComponentsProvider } from "@bh2980/cms-admin";

const components = {
	fencePreviews: { chart: () => import("./chart").then((m) => m.Chart) }, // ({ source }) => ReactNode
	fieldInputs: { color: ColorInput }, // fields.text({ input: "color" })인 필드를 이 입력으로 그린다
	blockEditors: { notice: NoticeEditor }, // 더한 블록의 속성·본문 상자({ definition, values, setValue, content })
	blockViews: { banner: BannerView }, // 더한 블록의 편집 화면 전체(Tiptap NodeView). blockEditors보다 먼저 쓴다
};

export function SiteAdminComponents({ children }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
```

넣지 않은 펜스는 원문을 그대로 보인다.

### 아이콘

블록 정의의 `editor.icon`, 플러그인 사이드바 항목의 `icon`, 컬렉션의 `icon`, 코드 줄 효과의 `icon`은 lucide 이름이다.
관리자 패키지에는 자주 쓰는 아이콘만 있으므로, 다른 이름은 같은 공급자의 `icons`로 등록한다. 없는 이름은 기본 아이콘(퍼즐·플러그 등)으로
보인다.

```tsx
import { Eye } from "lucide-react";

const components = { icons: { eye: Eye } };
```

플러그인은 관리자 쪽 `Provider` 안에서 등록한다(`@bh2980/cms-blocks`의 각 블록, `@bh2980/cms-ai`가 예시). 서버 레이아웃은
컴포넌트를 브라우저로 넘길 수 없어 플러그인 정의가 아니라 클라이언트 공급자로 등록한다.

## 속성 칸

편집 화면 오른쪽 속성 칸은 컬렉션 정의대로 입력을 그린다. 입력은 필드 종류로 정한다: 텍스트·선택·관계, 미디어 필드
(`fields.media`)는 미디어 고르기(`accept: "file"`이면 파일 올리기)다. 필드 이름이나 역할로 입력을 바꾸지 않는다.
`input`으로 등록한 입력을 고르면 그 입력이 먼저다. 기본 입력 `auto-summary`는 여러 줄 요약 칸이다.

`fieldInputs`에는 컴포넌트(입력 전체를 바꾼다) 또는 조각(`FieldInputParts`, 기본 입력을 두고 일부만 바꾼다)을 등록한다.
조각은 지금 입력 중인 값(`form`)을 읽을 수 있다.

```tsx
const components = {
	fieldInputs: {
		// 비었을 때 쓸 값을 안내 문구로, 글자 수를 이름표 줄 오른쪽에
		"meta-title": { placeholder: ({ form }) => form.title, Aside: ({ value }) => <span>{String(value ?? "").length}</span> },
		// 입력 줄 없이 이름표 줄의 스위치만(`Input: null`)
		"hide-switch": { Input: null, Aside: HideSwitch },
	},
};
```

필드나 `layout` 묶음의 `tab`마다 속성 칸에 탭이 생긴다(없으면 `속성` 탭, 묶음의 `tab`이 먼저). 보기 필드
(`fields.view({ view })`)는 그 자리에 `CmsAdminComponentsProvider`의 `fieldViews`(`{ 이름: ({ collection, form, entry }) => … }`)로
등록한 화면을 그린다. 등록한 화면이 없으면 아무것도 그리지 않는다. 미디어 ID로 미리보기를 그리는 화면은
`@bh2980/cms-admin/media`의 `MediaThumbnail`·`useMediaUrl`을 쓴다(SEO 확장 `@bh2980/cms-seo`의 검색 미리보기가 예시다).
날짜·시각은 사이트 설정의 `timeZone`으로 보인다.

## 블록 편집 화면

설정의 `blocks`나 블록 확장 플러그인이 더한 블록(`editor.view: "node"`)은 관리자 화면이 정의에서 편집기 노드(`cms` + 파스칼
이름, 예: `cmsNotice`)·변환·슬래시 메뉴 삽입·끌기 규칙을 만든다. 편집 모양만 넣으면 된다.

- 아무것도 넣지 않으면 지시자 블록은 속성 입력과 본문을 담은 상자, 코드 펜스 블록은 코드 입력 칸과 미리보기다.
- `blockEditors`는 기본 틀 안의 속성·본문 모양을, `blockViews`는 틀까지 포함한 화면 전체를 바꾼다.
- `blockViews` 화면을 만드는 도구(속성 값 읽고 쓰기·자식 위치·입력 칸·도구 줄·노드 이름)는 `@bh2980/cms-admin/blocks`에 있다.
  `@bh2980/cms-blocks`의 콜아웃·탭 화면이 예시다.

## 플러그인 화면

플러그인 정의의 `admin`이 불러오는 모듈은 `defineAdminPlugin()`(`@bh2980/cms-admin/plugins`)을 기본 내보내기로 준다.

```ts
export default defineAdminPlugin({
	pages: { my: MyPage }, // /admin/my (클라이언트 컴포넌트). 로그인 확인은 관리자 화면이 한다
	Provider: MyProvider, // 관리자 화면 전체를 감싼다. 안에서 CmsAdminComponentsProvider로 입력·편집 화면 확장을 더한다
});
```

편집 화면 확장(`editorExtensions`)은 툴바 끝 요소·블록 손잡이 옆 동작을 더하는 훅이다. 필드 옆·본문 이미지·미디어·코드 블록
자리에는 `SlotRegistryProvider`(`@bh2980/cms-admin/slots`)로 동작을 붙인다.

## 맞춤법·문장 검사 확장

본체 편집기는 검사기를 모르고, 확장이 준 버튼·창을 그리기만 한다. 사이트·확장이 검사기(유료 API, 브라우저에서 도는 npm 패키지
등)를 만들어 `textCheckExtension({ checkers })`를 관리자 확장(`editorExtensions`)에 넣으면, 글의 언어를 검사하는 검사기마다
도구 모음 버튼(이름 `label`, 아이콘 `icon`)이 생기고 결과는 물결 밑줄·결과 창·목록으로 보인다. 확장을 여럿 넣어도 밑줄은
겹치지 않는다.

```tsx
"use client";
import { defineTextChecker } from "@bh2980/cms-admin/text-check";
import { textCheckExtension } from "@bh2980/cms-admin/text-check/extension";

const myChecker = defineTextChecker({
	id: "my-words",
	label: "금지어 검사", // 도구 모음 버튼 이름
	icon: "ban", // lucide 이름이나 컴포넌트. 없으면 맞춤법 아이콘
	locales: ["ko"], // 없으면 모든 언어
	limits: { maxChars: 10_000, maxSegments: 50 }, // 넘으면 나눠 보낸다
	// auto: true, // 입력을 멈추면 바뀐 문단만 저절로 검사(기본은 끔)
	check: async (segments, { signal }) => [
		// { segmentId, start, end, message, suggestions: [], severity: "error" | "warning" | "info", ruleId?, category?, source?, url? }
	],
});

const components = { editorExtensions: [textCheckExtension({ checkers: [myChecker] })] };
```

- 검사 단위는 문단(제목·목록 항목·표 칸 등 글이 든 블록) 하나다: `{ id, text, locale }`. 결과의 `start`·`end`는 그 문단 안의
  UTF-16 위치(JS 문자열 인덱스, `end` 미포함)다.
- 코드 블록·수식·코드 펜스 블록·블록 속성은 보내지 않는다. 인라인 코드와 주소는 `￼` 한 글자로 바꿔 보내고, 그 글자에 걸친
  결과는 버린다. 링크는 글자만 보낸다.
- 검사기 버튼은 고른 글자가 있으면 그 범위에 걸친 문단만, 없으면 문서 전체를 그 검사기로 검사한다. 결과는 물결 밑줄로 보이고,
  밑줄을 누르면 설명·바꿀 글 후보·"무시"가 뜬다. 버튼 옆 숫자를 누르면 결과 목록이다. 결과 범위 안을 고치면 그 결과는 사라진다.
- 같은 검사기·언어·글자의 문단은 다시 보내지 않는다(편집 화면을 여는 동안). 다시 검사하거나 화면을 닫으면 진행 중인 요청을
  `signal`로 끊는다.
- `auto: true`는 유료·호출 제한 API면 비용이 들 수 있어 기본으로 끈다. 켜면 입력을 1.5초 멈춘 뒤, 연 뒤로 바뀐 문단만 보낸다.

### 키가 필요한 API

API 키는 브라우저에 두지 않는다. 브라우저는 `remoteTextChecker`로 사이트 경로에 `{ segments }`를 보내고, 경로가 키로 API를
불러 `{ issues }`를 돌려준다. `textCheckRoute`는 관리자 로그인·같은 출처를 확인하고 요청 크기(기본 100문단·20,000자)를 막는다.

```ts
// 관리자 컴포넌트(브라우저)
import { remoteTextChecker } from "@bh2980/cms-admin/text-check";
const checker = remoteTextChecker({ id: "bareun", label: "바른", locales: ["ko"], url: "/api/text-check" });

// app/api/text-check/route.ts(서버)
import { textCheckRoute } from "@bh2980/cms-admin/text-check/server";
export const POST = textCheckRoute({
	limits: { maxChars: 20_000 },
	check: async (segments, { signal }) => callProvider(segments, process.env.MY_API_KEY, signal), // TextIssue[]
});
```

### 검사기를 붙일 때

- 위치 단위가 다르면 검사기 쪽에서 UTF-16으로 바꾼다. 바이트(UTF-8)·코드 포인트·문장 기준 위치를 그대로 쓰면 이모지·한글 뒤에서
  밑줄이 어긋난다.
- 바른(Bareun): 요청에 `encoding_type: UTF16`을 주면 `begin_offset`·`length`를 그대로 쓸 수 있다. 중첩 결과(`nested`)는 펼친다.
- LanguageTool·Yahoo 같은 위치 기반 API: 문단을 이어 보낼 때는 돌아온 위치를 문단별로 다시 나눈다. 요청 크기·분당 호출 한도는
  `limits`와 서버 경로에서 맞춘다.
- textlint: `range`(`[start, end]`)를 그대로 쓴다. `fix.text`는 후보로 쓰되 `fix.range`가 표시 범위보다 넓을 수 있다.
- hunspell 계열(nspell·typo-js): 낱말 단위라 `Intl.Segmenter({ granularity: "word" })` 등으로 낱말을 나눠 검사하고 위치를 직접
  센다. 띄어쓰기·문법은 보지 못한다.
- 위치 없이 틀린 낱말만 주는 검사기는 문단 글자에서 낱말을 찾아 위치를 정한다(같은 낱말이 여럿이면 차례대로).

`examples/other-site`의 `app/(admin)/admin/admin-components.tsx`가 브라우저에서 도는 작은 금지어 검사기 예시다.

## 스타일

`@bh2980/cms-admin/styles.css`가 관리자 색 토큰과 배포 묶음의 Tailwind 클래스 찾기(`@source`)를 준다. 앱 쪽 준비물은
`styles.css` 머리 주석에 적었다.

## 개발

```bash
pnpm --filter @bh2980/cms-admin test:run        # 예시 블로그 설정 + 다른 사이트 설정
pnpm --filter @bh2980/cms-admin test:other-site # 다른 사이트 설정(`../cms/test/other-site.config.ts`)만
```

화면 테스트는 블로그와 다른 사이트 설정으로도 돈다(`vitest.othersite.config.ts`, 본체 README "개발"). 컬렉션·필드·블록 이름과
이름표는 테스트에 적지 말고 설정에서 읽는다(예: `src/screens/__test__/any-site-screens.test.tsx`).
