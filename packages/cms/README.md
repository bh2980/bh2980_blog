# @bh2980/cms

DB(Postgres) 기반 블로그 CMS의 본체. 사이트 설정, 컬렉션 스키마, 콘텐츠 저장·발행, MDX 변환, 관리자 API, 플러그인 연결을 맡는다.
관리자 화면은 `@bh2980/cms-admin`, AI 기능은 플러그인 `@bh2980/cms-ai`다. 다 붙인 예는 `examples/other-site`다.

## 빈 Next 앱에 설치

Next 16(App Router)·React 19·Tailwind CSS 4 앱 기준이다. 저장소는 Postgres만 지원한다.

### 1. 패키지

```sh
pnpm add @bh2980/cms @bh2980/cms-admin next-auth@5.0.0-beta.32 next-themes @tanstack/react-query sonner \
  @tiptap/core @tiptap/pm @tiptap/react
pnpm add -D tsx tw-animate-css @tailwindcss/typography
```

관리자 패키지와 AI 플러그인은 React Query·sonner·Tiptap을 앱과 같은 하나로 써야 해서 앱이 설치한다(peer).

### 2. 사이트 설정 `cms.config.ts`

서버와 관리자 화면이 함께 읽는다. 비밀 값은 넣지 않는다.

```ts
import { defineCollection, defineConfig, fields } from "@bh2980/cms";

const article = defineCollection({
	label: "Article",
	workflow: "publish", // 초안·발행. 분류(태그 등)는 "record"
	path: "/blog/:slug/", // 공개 주소. 본문 내부 링크·미리보기 주소에 쓴다
	icon: "newspaper", // 관리자 사이드바 아이콘(lucide 이름)
	fields: {
		title: fields.text({ label: "Title", required: "publish" }),
		slug: fields.slug({ label: "Slug", from: "title", required: "publish" }),
	},
	list: { columns: ["title", "status", "updatedAt"] },
});

export default defineConfig({
	collections: { article },
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	site: { name: "My site", previewPath: "/preview" },
	timeZone: "UTC",
});
```

### 3. 서버 설정 `cms.server.ts`

저장소·미디어·로그인 연결과 비밀 값. 서버에서만 읽힌다. 연결은 처음 쓸 때 만들어 빌드 중에는 환경 변수가 비어 있어도 된다.

```ts
import { defineServerConfig, githubAuth, postgres } from "@bh2980/cms/server";

export default defineServerConfig({
	database: postgres({ connectionString: process.env.CMS_DATABASE_URL, schema: process.env.CMS_SCHEMA }),
	auth: githubAuth({
		clientId: process.env.AUTH_GITHUB_ID,
		clientSecret: process.env.AUTH_GITHUB_SECRET,
		adminIds: [process.env.CMS_ADMIN_GITHUB_ID], // 관리자 GitHub 숫자 ID
		devBypass: process.env.CMS_DEV_AUTH_BYPASS === "1", // `next dev`에서만 로그인 없이 관리자
	}),
	secret: process.env.AUTH_SECRET,
	// media: r2Storage({ … }) — 미디어(이미지 올리기)를 쓸 때
});
```

### 4. 두 설정을 잇기

CMS 코드는 두 설정 파일을 `@cms-config`·`@cms-server`라는 이름으로 읽는다.

```ts
// next.config.ts
import { withCms } from "@bh2980/cms/next";

export default withCms({ /* 기존 설정 */ }, { config: "./cms.config.ts", server: "./cms.server.ts" });
```

```jsonc
// tsconfig.json
{ "compilerOptions": { "paths": { "@cms-config": ["./cms.config.ts"], "@cms-server": ["./cms.server.ts"] } } }
```

테스트(Vitest)를 쓰면 `resolve.alias`에도 같은 별칭을 둔다.

### 5. 라우트 네 개

```ts
// app/api/cms/[...path]/route.ts — 관리자 API(/api/cms/v1/*)
import { createCmsRouteHandler } from "@bh2980/cms/next/route-handler";
export const { GET, POST, PATCH, PUT, DELETE } = createCmsRouteHandler();

// app/api/auth/[...nextauth]/route.ts — 로그인
import { handlers } from "@bh2980/cms/runtime";
export const { GET, POST } = handlers;
```

```tsx
// app/(admin)/admin/layout.tsx — 관리자 화면
import { CmsAdminLayout } from "@bh2980/cms-admin/next";
export { cmsAdminMetadata as metadata } from "@bh2980/cms-admin/next";
export default function AdminLayout({ children }) {
	return <CmsAdminLayout>{children}</CmsAdminLayout>;
}

// app/(admin)/admin/[[...path]]/page.tsx
export { CmsAdminPage as default } from "@bh2980/cms-admin/next";
```

### 6. 스타일

앱의 Tailwind 입력 CSS(루트 레이아웃이 import하는 파일)에 더한다.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@bh2980/cms-admin/styles.css";
@plugin "@tailwindcss/typography";

@custom-variant dark (&:where(.dark, .dark *));
@custom-variant data-horizontal (&[data-orientation="horizontal"]);
@custom-variant data-vertical (&[data-orientation="vertical"]);
```

### 7. 환경 변수와 DB 표

`.env.local`에 `CMS_DATABASE_URL`, `AUTH_SECRET`(임의의 긴 값), 로그인용 `AUTH_GITHUB_ID`·`AUTH_GITHUB_SECRET`·
`CMS_ADMIN_GITHUB_ID`(또는 로컬에서 `CMS_DEV_AUTH_BYPASS=1`)를 둔다. 그다음 표를 만든다.

```ts
// migrate.ts
import "@bh2980/cms/migrate";
```

```sh
tsx --env-file=.env.local --import @bh2980/cms/register migrate.ts
```

`@bh2980/cms/register`는 Next 밖에서 `@cms-config`·`@cms-server`를 `./cms.config.ts`·`./cms.server.ts`로 잇는다
(다른 곳이면 `CMS_CONFIG_PATH`·`CMS_SERVER_PATH`). 플러그인 표도 함께 만든다. 패키지를 올린 뒤에도 다시 돌린다.

### 8. 실행

`next dev`로 띄우고 `/admin`을 연다.

### 블록 확장 (선택)

```sh
pnpm add @bh2980/cms-blocks
```

```ts
// cms.config.ts
import { callout, tabs } from "@bh2980/cms-blocks";

export default defineConfig({
	// …
	plugins: [callout(), tabs()],
});
```

```css
@import "@bh2980/cms-blocks/styles.css"; /* 관리자 패키지 스타일 다음 */
```

자세한 것은 `@bh2980/cms-blocks`의 README.

### AI 플러그인 (선택)

```sh
pnpm add @bh2980/cms-ai
```

```ts
// cms.config.ts
import { aiPlugin, aiPresets } from "@bh2980/cms-ai";

export default defineConfig({
	// …
	plugins: [aiPlugin({ actions: { summary: aiPresets.summary({ collections: ["article"] }) } })],
});
```

```css
@import "@bh2980/cms-ai/styles.css"; /* 관리자 패키지 스타일 다음 */
```

자세한 것은 `@bh2980/cms-ai`의 README.

## 진입점

| 진입점 | 쓰는 곳 | 내용 |
| --- | --- | --- |
| `@bh2980/cms` | `cms.config.ts` | `defineConfig`·`defineCollection`·`fields`·`defineBlock`·`definePlugin` |
| `@bh2980/cms/server` | `cms.server.ts` | `defineServerConfig`·`postgres`·`r2Storage`·`githubAuth` |
| `@bh2980/cms/next` | `next.config.ts` | `withCms` |
| `@bh2980/cms/next/route-handler` | 관리자 API 라우트 | `createCmsRouteHandler` |
| `@bh2980/cms/runtime` | 서버 코드(공개 화면 등) | 저장소·공개본 읽기·로그인·미리보기 권한·본문 이미지 |
| `@bh2980/cms/client` | 화면 코드 | API 모양·컬렉션·언어·주소·블록·스키마 도우미 |
| `@bh2980/cms/mdx`·`/code-block` | 공개 렌더러·편집기 | MDX 해석·직렬화, 코드 블록 주석 모델 |
| `@bh2980/cms/plugin/server` | 플러그인 서버 쪽 | 라우트 틀·DB 연결·오류 |
| `@bh2980/cms/migrate`·`/register` | 명령줄 | 표 만들기, 설정 별칭 잇기 |
| `@bh2980/cms/testing` | 테스트 | 격리 스키마 DB·예시 데이터 |

## 패키지 빌드

저장소 안에서는 소스(`src`)를 바로 쓴다. 배포 묶음은 `pnpm build:packages`로 `dist`를 만들고 `pnpm pack`이
`publishConfig.exports`(dist)로 묶는다. `pnpm example:pack`은 묶음을 `examples/other-site/vendor`에 넣는다.

## 본문 블록

본체에는 다른 기능이 기대거나 Markdown 문법인 블록(이미지·파일·표·수식·정렬·글자 꾸밈)만 있다. 콜아웃·접기·탭·단·
Mermaid·차트는 블록 확장 `@bh2980/cms-blocks`에서 필요한 것만 플러그인으로 설치한다.

```ts
import { callout, mermaid } from "@bh2980/cms-blocks";

plugins: [callout(), mermaid()],
```

사이트가 직접 만든 블록은 설정의 `blocks`에 넣는다. 블록 확장도 같은 정의(`definePlugin({ blocks })`)로 블록을 더한다.

```ts
import { defineBlock } from "@bh2980/cms";

blocks: [
	defineBlock({
		name: "notice", // 저장 문법 :::notice{level="warn"} … :::
		label: "공지",
		syntax: { kind: "container", directive: "notice" },
		component: "Notice", // 공개 화면은 사이트의 MDX 컴포넌트 표에서 이 이름으로 그린다
		attributes: {
			level: { type: "string", label: "단계", options: { info: "안내", warn: "주의" }, defaultValue: "info" },
			title: { type: "string", label: "제목", translatable: true }, // 번역 화면이 머리 줄로 따로 번역한다
		},
		translateInside: true, // 번역 화면이 상자를 펼쳐 안쪽 블록을 하나씩 번역한다
		editor: {
			view: "node", // "opaque"면 편집기에서 원문 상자로 보인다
			insertable: true,
			icon: "message-square", // 슬래시·컴포넌트 메뉴 아이콘(lucide 이름)
			insert: { values: { level: "warn" }, text: "내용" }, // 넣을 때 처음 값
		},
	}),
	defineBlock({
		name: "graphviz", // 저장 문법 ```graphviz … ```
		label: "Graphviz",
		syntax: { kind: "fence", lang: "graphviz" },
		component: "Graphviz", // 공개 화면은 remarkFenceBlocksToMdx가 <Graphviz source="…" />로 바꾼다
		attributes: {},
		editor: { view: "node", insertable: true, insert: { code: "digraph { a -> b }" }, placeholder: "Graphviz 코드를 입력하세요" },
	}),
],
```

- 더할 수 있는 블록은 지시자 블록(`container`·`leaf`)과 코드 펜스 블록(`fence`)이다. 코드 펜스 블록은 그 언어의 코드
  펜스를 모두 가져가므로 일반 코드 언어 이름(`ts` 등)을 쓰지 않는다.
- 속성의 선택 값·필수 값·자식 값(`childValue`, 예: 처음 열 탭은 탭 이름 중 하나)과 자식 개수(`children.min`·`max`)는
  발행 전에 검사한다.
- 쓰던 블록을 빼면 저장 문법에서 빠진다. 이미 그 블록을 쓴 본문은 다시 저장할 때 일반 글로 바뀌므로 쓰던 블록은 빼지 않는다.
- 편집기 노드는 관리자 패키지가 정의에서 만든다. 편집 모양은 관리자 패키지의 `blockEditors`(속성·본문 상자)나
  `blockViews`(화면 전체)로 바꾸고, 코드 펜스 블록의 미리보기는 `fencePreviews`로 넣는다.
- 공개 화면의 코드 펜스 블록은 `@bh2980/cms/mdx`의 `remarkFenceBlocksToMdx`를 렌더 체인(`remarkDirectivesToMdx` 뒤)에 넣어
  `component`로 그린다.
- 번역 구조 검사(`compareStructure`)는 `translatable` 속성과, 그 값을 가리키는 `childValue` 속성(예: 처음 열 탭)만 번역에서
  바뀌어도 된다고 본다. 사람이 읽는 속성(제목·설명 등)에는 `translatable: true`를 단다.
- `editor.icon`이 관리자 패키지의 기본 아이콘에 없는 이름이면 관리자 화면에 아이콘을 등록한다(`@bh2980/cms-admin` README).

### 코드 블록 줄 효과

코드 블록 줄 효과(`// @line 이름 {0-2}`)의 기본은 강조·추가·삭제·경고·오류다. 설정의 `codeBlock.lineEffects`로 더하고,
같은 이름을 적으면 기본을 바꾼다.

```ts
codeBlock: {
	lineEffects: [
		{
			name: "focus", // 주석 이름(소문자 케밥). collapse·anchor와 글자 효과 이름은 쓸 수 없다
			label: "초점", // 줄 효과 메뉴 이름
			icon: "eye", // 메뉴 아이콘(lucide 이름, 관리자 화면에 등록된 이름)
			class: "bg-primary/10", // 공개 화면이 그 줄에 붙이는 클래스(사이트 Tailwind가 읽는 곳에 둔다)
			editor: { background: "bg-primary/10" }, // 편집기 표시: background·wavy(물결 밑줄 색)·marker({ text, className })
		},
	],
},
```

공개 화면은 `@bh2980/cms/code-block`의 `annotationConfig`(기본 + 설정)를 렌더 체인에 넘긴다.

### 글자색 목록

편집기의 글자색·배경색 고르기 목록은 설정의 `textColors`로 바꾼다. 없으면 기본 8색(`DEFAULT_TEXT_PALETTE`)이다. 본문에는 색
이름이 아니라 헥스 값이 저장되므로 목록을 바꿔도 이미 쓴 글은 그대로다.

```ts
textColors: [{ id: "brand", name: "브랜드", fg: { light: "#4f46e5", dark: "#818cf8" }, bg: { light: "#eef2ff", dark: "#1e1b4b" } }],
```

## 플러그인

사이트 설정의 `plugins`에 한 번 적는다(예: AI 플러그인 `@bh2980/cms-ai`의 `aiPlugin()`).

```ts
import { definePlugin } from "@bh2980/cms";

export const myPlugin = () =>
	definePlugin({
		name: "my-plugin",
		options: {}, // JSON 값. 서버·브라우저가 함께 읽는다
		nav: [{ path: "my", label: "내 화면", icon: "plug" }], // 관리자 사이드바 "관리" 묶음
		validate: ({ collections }) => {}, // 사이트 설정을 만들 때 부른다
		server: () => import("my-plugin/server"), // CmsServerPlugin: API 경로·표 만들기·메타 표시
		admin: () => import("my-plugin/admin"), // CmsAdminPlugin(@bh2980/cms-admin): 화면·공급자
	});
```

- 서버 쪽(`server`)은 브라우저 묶음에 들어가지 않게 패키지 `exports`의 `browser` 조건으로 빈 진입점을 준다.
- 서버 쪽 `routes`는 본체 경로(`/api/cms/v1/*`)에 없는 주소를 받는다. `migrate`는 `cms:db:migrate`가 본체 표 다음에 부른다.
- 플러그인 코드는 `@bh2980/cms/plugin/server`의 `getCmsDatabase()`(DB 연결)와 본체 라우트 틀(`adminRoute` 등)을 쓴다.

## 서버 설정

| 항목 | 뜻 |
|---|---|
| `database` | 콘텐츠 저장소. `postgres({ connectionString, schema })` |
| `media` | 이미지·첨부 파일 저장소. `r2Storage({...})`(S3 호환). 없으면 미디어 기능을 못 쓴다. |
| `auth` | 관리자 로그인. `githubAuth({ clientId, clientSecret, adminIds, devBypass })` |
| `secret` | AI 서비스 키를 DB에 암호화해 둘 때 쓰는 키. 바꾸면 저장된 키를 다시 넣어야 한다. |
| `schedulerToken` | 외부 예약 실행기가 예약 발행 API를 부를 때 쓰는 토큰. |

다른 저장소·로그인을 쓰려면 `DatabaseAdapter`·`MediaAdapter`·`AuthAdapter`를 직접 만들어 넣는다.

## 설정

| 항목 | 뜻 |
|---|---|
| `collections` | 컬렉션 이름 → `defineCollection` 정의. 이름은 DB에 저장되므로 운영 중에 바꾸지 않는다. |
| `locales` | 콘텐츠 언어 목록(`code`, `name`, 관리자 화면 이름 `label`). |
| `defaultLocale` | 기본 언어. 공개 주소에 언어 접두사가 붙지 않는다. |
| `site.url` | 공개 사이트 주소. 본문에 전체 주소로 적은 링크도 내부 링크로 알아본다. 환경 변수에서 읽어도 된다. |
| `site.aliases` | 같은 사이트로 볼 다른 호스트 이름(예: `www.example.com`). |
| `codeBlock.lineEffects` | 코드 블록 줄 효과 더하기·바꾸기("코드 블록 줄 효과"). |
| `textColors` | 편집기 글자색 고르기 목록("글자색 목록"). |

컬렉션의 `path`(예: `/posts/:slug`)는 공개 주소 모양이다. 본문의 내부 링크를 알아보고(가리키는 글이 있는지·공개됐는지
발행 전에 검사) 편집기가 링크를 만들 때 쓴다. `path`가 없는 컬렉션은 본문 링크로 가리킬 수 없다.

### 필드 규칙

- **`title`은 꼭 있어야 한다.** 모든 컬렉션은 `title` 텍스트 필드(`fields.text`)를 가진다. 목록·검색·관계 고르기·본문 링크·
  편집 화면 제목 칸이 이 필드를 쓴다.
- **주소는 `from`에서 만든다.** `fields.slug({ from: "title" })`이면 주소를 직접 고치기 전까지 그 필드 값으로 주소를 만들고,
  record 컬렉션은 주소를 비우고 저장하면 그 값에서 만든다. `from`이 없으면 자동으로 만들지 않는다. `from`은 같은 컬렉션의
  텍스트 필드여야 한다.
- **필드 역할(`role`).** 라이브러리는 요약·검색·공유 값을 필드 이름이 아니라 역할로 찾는다. 역할마다 한 컬렉션에 한 필드만 둔다.

| `role` | 필드 | 쓰는 곳 |
|---|---|---|
| `summary` | 텍스트 | 요약. 필드 옆 동작(AI 등)에 `summary`로 넘어가고 검색 설명이 비면 대신 쓴다. |
| `seoTitle` · `seoDescription` | 텍스트 | 검색 결과 제목·설명. 비우면 제목·요약을 쓴다. 입력 옆에 글자 수가 보인다. |
| `ogImage` | 텍스트(미디어 ID) | 공유 이미지. 관리자 화면은 미디어 고르기로 입력한다. |
| `canonical` | 텍스트 | 원본 주소. |
| `noindex` | 선택(`noindex` 선택지가 있어야 함) | 값이 `noindex`면 검색엔진에 숨긴다. 선택지가 둘이면 켜고 끄기로 그린다. |

- **본문에서 채우기.** 텍스트 필드에 `fillFromBody: true`를 두면 발행할 때 비어 있으면 본문 앞부분으로 채운다(본문이 있는
  컬렉션만).
- **탭과 미리보기.** `layout` 묶음에 `tab: "이름"`을 두면 편집 화면 속성 칸에 그 이름의 탭이 생기고, 같은 이름의 묶음이
  모인다(없으면 기본 탭 `속성`). `preview: "search"`를 두면 묶음 위에 검색 결과·공유 미리보기를 그린다. 미리보기 값은 위
  역할에서 온다. 다른 미리보기는 관리자 확장의 `groupPreviews`로 더한다.

```ts
fields: {
	title: fields.text({ label: "Title", required: "publish" }),
	slug: fields.slug({ label: "Slug", from: "title" }),
	excerpt: fields.text({ label: "Excerpt", role: "summary", multiline: true, fillFromBody: true }),
	metaTitle: fields.text({ label: "Search title", role: "seoTitle" }),
	shareImage: fields.text({ label: "Share image", role: "ogImage" }),
},
layout: [{ fields: ["title", "slug", "excerpt"] }, { tab: "Search", preview: "search", fields: ["metaTitle", "shareImage"] }],
```

`defineConfig`는 관계 필드가 없는 컬렉션을 가리키거나, 기본 언어가 목록에 없거나, `title`이 없거나, 역할·`from`·
`fillFromBody`가 필드와 맞지 않으면 앱이 뜰 때 바로 오류를 낸다.

## 아직 남은 일

이 패키지는 bh2980 블로그에서 떼어 내는 중이다. 다른 블로그에서 쓰기 전에 아래를 정리해야 한다.

- 저장소는 Postgres(`ContentStore`)만 있다. 다른 DB를 쓰려면 같은 계약을 구현해야 하는데 계약이 아직 크다.

## 개발

```bash
pnpm --filter @bh2980/cms test:run
pnpm --filter @bh2980/cms typecheck
```

패키지 자체 테스트는 예시 설정 `test/cms.config.ts`·`test/cms.server.ts`로 돈다.
