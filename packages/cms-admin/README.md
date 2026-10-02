# @bh2980/cms-admin

`@bh2980/cms`의 관리자 화면(Next.js App Router). 목록·편집기(tiptap)·미디어·본문 템플릿·휴지통·로그인 화면을 준다.
플러그인(예: `@bh2980/cms-ai`)이 화면·사이드바 항목·필드 옆 버튼·편집 화면 동작을 더한다.
화면은 본체의 관리자 API(`/api/cms/v1/*`)만 부른다. 설치하지 않고 같은 API로 화면을 직접 만들어도 된다.

## 붙이기

```tsx
// app/(admin)/admin/layout.tsx
import "../../globals.css"; // Tailwind·테마 색. 관리자 화면도 앱의 전역 CSS로 그린다
import { CmsAdminLayout } from "@bh2980/cms-admin/next";
export { cmsAdminMetadata as metadata } from "@bh2980/cms-admin/next";

export default function AdminLayout({ children }) {
	return <CmsAdminLayout>{children}</CmsAdminLayout>;
}

// app/(admin)/admin/[[...path]]/page.tsx
export { CmsAdminPage as default } from "@bh2980/cms-admin/next";
```

관리자 화면 주소는 `/admin`이다. 로그인은 `/admin/login`으로 보낸다.

## 사이트 컴포넌트 넣기

편집기의 코드 펜스 미리보기(예: `mermaid`·`chart`)와 필드 입력은 사이트가 넣는다. 클라이언트 컴포넌트에서 넣는다.

```tsx
"use client";
import { CmsAdminComponentsProvider } from "@bh2980/cms-admin";

const components = {
	fencePreviews: { chart: () => import("./chart").then((m) => m.Chart) }, // ({ source }) => ReactNode
	fieldInputs: { color: ColorInput }, // fields.text({ input: "color" })인 필드를 이 입력으로 그린다
	blockEditors: { notice: NoticeEditor }, // 사용자 블록 편집 모양({ definition, values, setValue, content })
};

export function SiteAdminComponents({ children }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
```

넣지 않은 펜스는 원문을 그대로 보인다.

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

관리자 화면은 Tailwind 클래스로 그리고, 색은 앱의 테마 변수(shadcn 방식)를 쓴다. 모노레포 안에서는 앱의 Tailwind가
이 패키지 파일도 읽는다. 패키지로 배포할 때는 따로 빌드한 CSS를 함께 낸다(계획 M7).
