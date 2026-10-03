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

## 스타일

`@bh2980/cms-admin/styles.css`가 관리자 색 토큰과 배포 묶음의 Tailwind 클래스 찾기(`@source`)를 준다. 앱 쪽 준비물은
`styles.css` 머리 주석에 적었다.
