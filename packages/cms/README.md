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
	kind: "document", // 본문·초안·발행. 태그 같은 작은 항목은 "item"
	path: "/blog/:slug/", // 공개 주소. 본문 내부 링크·미리보기 주소에 쓴다
	icon: "newspaper", // 관리자 사이드바 아이콘(lucide 이름)
	fields: {
		title: fields.text({ label: "Title", required: true }), // 발행(항목은 저장) 때 비면 안 된다
		slug: fields.slug({ label: "Slug", from: "title", required: true }),
	},
	// layout·list를 적지 않으면 필드 순서대로 그리고 기본 목록 컬럼을 쓴다("컬렉션").
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
import { blocks } from "@bh2980/cms-blocks";

export default defineConfig({
	// …
	plugins: [...blocks()], // 전부. 고르려면 blocks({ only: ["callout", "tooltip"] }), 하나씩은 callout()·tabs()…
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
import { aiPlugin } from "@bh2980/cms-ai";

export default defineConfig({
	// …
	// 기본 기능(주소·요약·태그 추천 등)이 필드 종류·역할·관계 대상으로 저절로 붙는다. 바꾸거나 끌 것만 `actions`에 적는다.
	plugins: [aiPlugin({ siteDescription: "기술 블로그" })],
});
```

```css
@import "@bh2980/cms-ai/styles.css"; /* 관리자 패키지 스타일 다음 */
```

자세한 것은 `@bh2980/cms-ai`의 README.

### SEO 확장 (선택)

```sh
pnpm add @bh2980/cms-seo
```

```ts
// cms.config.ts
import { seo, seoFields } from "@bh2980/cms-seo";

const article = defineCollection({
	// …
	fields: { title, slug, ...seoFields() }, // 검색 제목·설명·공유 이미지·숨기기·원본 주소 + 미리보기, 모두 SEO 탭
});

export default defineConfig({
	// …
	plugins: [seo()],
});
```

자세한 것은 `@bh2980/cms-seo`의 README.

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

본체에는 다른 기능이 기대거나 Markdown 문법인 블록(이미지·파일·표·수식·정렬, 밑줄·위아래 첨자·줄바꿈·번역 안내)만 있다.
콜아웃·접기·탭·단·Mermaid·차트와 글자 꾸밈(툴팁·코드 연결·글자색)은 블록 확장 `@bh2980/cms-blocks`에서 필요한 것만
플러그인으로 설치한다.

```ts
import { blocks } from "@bh2980/cms-blocks";

plugins: [...blocks({ only: ["callout", "mermaid", "tooltip"] })],
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

- 더할 수 있는 블록은 지시자 블록(`container`·`leaf`), 글자 꾸밈(`text` + `editor.view: "mark"`), 코드 펜스 블록(`fence`)이다.
  코드 펜스 블록은 그 언어의 코드 펜스를 모두 가져가므로 일반 코드 언어 이름(`ts` 등)을 쓰지 않는다.
- 글자 꾸밈은 `:이름[글자]{속성}`으로 저장한다. 속성은 정의 순서대로 쓰고, 꼭 있어야 하는 속성(`required`)은 비어도, 나머지는
  값이 있을 때만 쓴다. 겹친 꾸밈은 더한 순서(바깥부터)로 저장한다. 편집기 표시는 관리자 패키지가 정의에서 만들고, 모양·서식
  도구·버블·슬래시 메뉴는 확장이 관리자 화면에 등록한다(`@bh2980/cms-admin` README의 "글자 꾸밈"). 속성에 `codeAnchor: true`를
  달면 그 값이 코드 블록 줄 이름표(`anchor` 줄 효과)이고, 편집기의 본문–코드 잇기가 이 꾸밈을 쓴다(사이트에 하나만).
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

글자색은 블록 확장(`@bh2980/cms-blocks`의 `color({ palette })`)이 준다. 예전 설정 `textColors`는 없어졌다(옵션으로 옮긴다).

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
- `validate`는 컬렉션·언어·블록 정의와 모든 플러그인(`plugins`)을 받는다. 역할을 쓰는 확장은 여기서 필드 종류를 확인한다.
- `contributes`는 다른 플러그인에 더하는 것이다. 키와 모양은 받는 플러그인이 정하고 본체는 읽지 않는다. 예를 들어
  `contributes: { ai: { actions: { … } } }`는 AI 플러그인(`@bh2980/cms-ai`)이 있으면 그 기능을 더하고, 없으면 쓰이지 않는다.
  확장은 받는 플러그인을 몰라도 기능을 더할 수 있다(블록 확장의 다이어그램 만들기, SEO 확장의 검색 제목 추천).
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
| `admin.locale` | 관리자 화면의 날짜·숫자 표기 언어(BCP 47). 없으면 `ko-KR`. 시각은 `timeZone`으로 보인다. |
| `admin.legacyBackupNames` | 예전 브라우저 복구본 DB 이름. 관리자 화면이 읽고 지우되 새로 만들지 않는다(지금 이름 `cms_backup`). |

### 컬렉션

- **종류(`kind`).** `document`(문서)는 본문을 쓰고 초안과 공개본을 나눠 명시적으로 발행한다. `item`(항목)은 작은 폼에서 저장하면
  곧바로 공개 값에 반영한다(발행·예약·보관·번역본이 없고, 언어별 값은 `translations`에 둔다). 본문(`body`)은 없으면 문서만 쓴다.
  예전 이름 `workflow: "publish" | "record"`도 받아 `document`·`item`으로 바꾼다(앞으로 없앨 이름이다). 본체 코드는 `kind`만 읽는다.
- **배치(`layout`).** 없으면 필드 선언 순서대로 한 묶음이고, 제 `tab`을 가진 필드는 그 탭에 모인다.
- **목록(`list.columns`).** 없으면 기본 컬럼이다. 문서는 제목·상태·언어(언어가 둘 이상일 때)·분류 필드(항목 컬렉션을 가리키는
  관계)·수정일·발행일, 항목은 제목·주소(주소 필드가 있을 때)·언어·상태·수정일.

컬렉션의 `path`(예: `/posts/:slug`)는 공개 주소 모양이다. 본문의 내부 링크를 알아보고(가리키는 글이 있는지·공개됐는지
발행 전에 검사) 편집기가 링크를 만들 때 쓴다. `path`가 없는 컬렉션은 본문 링크로 가리킬 수 없다.

### 필드 규칙

- **제목 필드 이름은 `title`, 이름표는 자유.** 라이브러리 약속이다. 모든 컬렉션은 `title` 텍스트 필드(`fields.text`)를 가진다.
  목록·검색·관계 고르기·본문 링크·복제·편집 화면 제목 칸이 이 필드를 쓴다. 이름표(`label`)는 사이트가 정한다(예: `Headline`·
  `이름`). 제목 글자 수 한도는 따로 없고 이 필드의 `max`를 따른다(없으면 한도 없음).
- **주소 필드는 하나.** 주소(`fields.slug`)는 본체 개념이라 콘텐츠마다 하나다. 한 컬렉션에 주소 필드를 둘 이상 두면 설정 오류다.
- **주소는 `from`에서 만든다.** `fields.slug({ from: "title" })`이면 주소를 직접 고치기 전까지 그 필드 값으로 주소를 만들고,
  항목 컬렉션은 주소를 비우고 저장하면 그 값에서 만든다. `from`이 없으면 자동으로 만들지 않는다. `from`은 같은 컬렉션의
  텍스트 필드여야 한다.
- **필드 역할(`role`).** 확장과 화면은 값을 필드 이름이 아니라 역할로 찾는다(`roleField(collection, role)`, 설정을 읽지 않는
  `fieldWithRole(schema, role)`). 역할 이름은 자유(영문자·숫자·하이픈)이고 한 컬렉션에 역할마다 한 필드만 둔다. 본체가 아는
  역할은 `summary`(텍스트 필드, 요약) 하나다. 필드 옆 동작(AI 등)에 `summary`로 넘어간다. 다른 역할은 그 역할을 쓰는 확장이
  정하고 필드 종류를 플러그인 `validate`에서 확인한다(예: SEO 확장의 `seoTitle`·`ogImage`·`noindex`).
- **미디어 필드.** `fields.media({ label, accept?: "image" | "file" })`는 미디어 라이브러리의 파일 하나를 고르고 미디어 ID를
  글자로 저장한다. 값은 미디어 사용처(`entry_references`, 종류 `media`)에 잡혀 미디어 화면의 "사용처"·"사용하지 않음" 거르기에
  보이고, 쓰고 있는 파일은 지울 수 없다. 미디어 ID가 아닌 값은 `invalid_metadata_value`, 빈 값(`""`)은 고르지 않은 것이다.

- **필수 필드(`required: true`).** 문서 컬렉션은 발행할 때, 항목 컬렉션은 저장할 때 비어 있으면 막는다. 초안 저장은 막지 않는다.
  예전 값 `required: "publish"`도 같은 뜻으로 받는다.
- **필드 값 오류.** 오류 코드는 필드와 상관없이 같다. 필수값이 비면 `missing_field`(주소는 `null_slug`), 글자 수가 `max`를
  넘으면 `field_too_long`이다. 문제(`issues`)의 `path`에 필드 이름, `message`에 필드 이름표가 담긴다(제목도 같다). 관계 대상
  컬렉션이 다르면 `invalid_reference_collection`이다. 빈 본문(`empty_body`)은 본문을 쓰는 컬렉션(`body`)만 막는다.
- **본문에서 채우기.** 텍스트 필드에 `fillFromBody: true`(160자) 또는 `fillFromBody: { maxLength }`를 두면 발행할 때 비어 있으면
  본문 앞부분의 일반 글자로 채운다(본문이 있는 컬렉션만, 필드 `max`를 넘지 않는다). 본체 함수는 `bodyExcerpt(mdx, maxLength)`다.
- **여러 줄 입력.** `multiline: true`인 텍스트 필드는 여러 줄 입력이고 `rows`(기본 2)로 처음 줄 수를 정한다.
- **쓸 수 없는 필드 이름.** 메타데이터에서 본체가 따로 쓰는 키(`translations`)는 필드 이름으로 쓸 수 없다.
- **탭.** 필드에 `tab: "이름"`을 두거나 `layout` 묶음에 `tab`을 두면 편집 화면 속성 칸에 그 이름의 탭이 생긴다(1~20자).
  묶음의 `tab`이 먼저고, 묶음에 `tab`이 없으면 필드의 `tab`이다. 제 `tab`을 가진 필드는 배치를 적지 않아도 탭마다 한 묶음으로
  모인다. 그래서 확장이 주는 필드 묶음(예: `seoFields()`)이 사이트가 `layout`을 적지 않아도 제 탭에 들어간다. 없으면 기본 탭
  `속성`이다.
- **보기 필드.** `fields.view({ view: "이름" })`은 값을 저장하지 않고 그 자리에 화면을 그리는 필드다. 화면은 관리자 확장이
  `fieldViews`로 등록한다(예: SEO 확장의 `search`). 등록한 화면이 없으면 아무것도 그리지 않는다.
- **입력 바꾸기.** `input: "이름"`은 관리자 확장이 `fieldInputs`로 등록한 입력을 가리킨다. 등록이 없으면 종류의 기본 입력이다.
  `inputOptions`(JSON 값)는 그 입력에 넘길 설정이고 본체는 읽지 않는다(예: 권장 글자 수).

```ts
fields: {
	title: fields.text({ label: "Title", required: true }),
	slug: fields.slug({ label: "Slug", from: "title" }),
	excerpt: fields.text({ label: "Excerpt", role: "summary", multiline: true, rows: 3, fillFromBody: { maxLength: 200 } }),
	hero: fields.media({ label: "Hero image", tab: "Media" }),
	credit: fields.text({ label: "Credit", tab: "Media" }),
},
layout: [{ fields: ["title", "slug", "excerpt"] }], // hero·credit은 Media 탭에 모인다
```

`defineConfig`는 관계 필드가 없는 컬렉션을 가리키거나, 기본 언어가 목록에 없거나, `title`이 없거나, 주소 필드가 둘 이상이거나,
역할이 겹치거나 `summary`가 텍스트 필드가 아니거나, 탭 이름이 1~20자가 아니거나, `from`·`fillFromBody`가 필드와 맞지 않거나,
필드 이름이 `translations`이거나, 컬렉션 종류가 없으면 앱이 뜰 때 바로 오류를 낸다.

복제(`POST /api/cms/v1/entries/:id/duplicate`)는 본문에 `{ title }`을 받으면 복제본 제목을 그 값으로 둔다(관리자 화면은 원본
제목에 "(복사)"를 붙여 보낸다). 없으면 원본 제목 그대로다. 저장소는 붙일 말을 정하지 않는다.

## 아직 남은 일

이 패키지는 bh2980 블로그에서 떼어 내는 중이다. 다른 블로그에서 쓰기 전에 아래를 정리해야 한다.

- 저장소는 Postgres(`ContentStore`)만 있다. 다른 DB를 쓰려면 같은 계약을 구현해야 하는데 계약이 아직 크다.

## 개발

```bash
pnpm --filter @bh2980/cms test:run
pnpm --filter @bh2980/cms typecheck
```

패키지 자체 테스트는 예시 설정 `test/cms.config.ts`·`test/cms.server.ts`로 돈다.

**다른 사이트 설정으로도 돈다(재발 방지).** `test/other-site.config.ts`는 블로그와 일부러 다른 설정이다(컬렉션 article·topic·author,
`title`·`slug` 말고는 다른 필드 이름, 영어만, 차트 + 사이트 블록, 글자 꾸밈 없음). 본체·관리자·AI 패키지마다 `vitest.othersite.config.ts`가 같은
테스트를 이 설정으로 다시 돌린다(묶음 이름 `cms (other-site)`·`cms-admin (other-site)`·`cms-ai (other-site)`, 저장소 루트
`pnpm test:run`이 함께 돈다. 패키지에서는 `pnpm test:other-site`). 새 테스트는 저절로 두 설정으로 돈다. 컬렉션·필드 이름은
테스트에 적지 말고 설정에서 찾는다(`test/any-site.ts`, 예: `src/services/__test__/any-site.test.ts`). 블로그 예시 데이터를 그대로
쓰는 테스트만 각 `vitest.othersite.config.ts`의 `BLOG_FIXTURE_TESTS`에 적어 뺀다.
