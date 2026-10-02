# @bh2980/cms-admin

`@bh2980/cms`의 관리자 화면(Next.js App Router). 목록·편집기(tiptap)·미디어·본문 템플릿·AI 설정·휴지통·로그인 화면을 준다.
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

편집기의 코드 펜스 미리보기(예: `mermaid`·`chart`)는 사이트의 렌더러를 쓴다. 클라이언트 컴포넌트에서 넣는다.

```tsx
"use client";
import { CmsAdminComponentsProvider } from "@bh2980/cms-admin";

const components = {
	fencePreviews: { chart: () => import("./chart").then((m) => m.Chart) }, // ({ source }) => ReactNode
};

export function SiteAdminComponents({ children }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
```

넣지 않은 펜스는 원문을 그대로 보인다.

## AI 기능 부르기

직접 만든 화면에서 사이트 설정의 AI 기능을 이름으로 부른다. 이름·입력·결과 타입은 설정에서 나온다.

```ts
import { useAiAction } from "@bh2980/cms-admin";
const summary = useAiAction("summary");
const result = await summary.run({ title, body });
```

## 스타일

관리자 화면은 Tailwind 클래스로 그리고, 색은 앱의 테마 변수(shadcn 방식)를 쓴다. 모노레포 안에서는 앱의 Tailwind가
이 패키지 파일도 읽는다. 패키지로 배포할 때는 따로 빌드한 CSS를 함께 낸다(계획 M7).
