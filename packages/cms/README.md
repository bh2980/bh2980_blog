# @bh2980/cms

DB(Postgres) 기반 블로그 CMS의 본체. 사이트 설정, 컬렉션 스키마, 콘텐츠 저장·발행, MDX 변환, AI 기능을 맡는다.
React 화면은 없다. 관리자 화면은 `@bh2980/cms-admin`(준비 중)이 이 패키지의 API를 불러 그린다.

## 연결 방법 (Next.js)

1. 사이트 설정 파일을 만든다. 비밀 값은 넣지 않는다(서버와 관리자 화면이 함께 읽는다).

   ```ts
   // src/cms.config.ts
   import { defineCollection, defineConfig, fields } from "@bh2980/cms";

   const post = defineCollection({
   	label: "게시글",
   	workflow: "publish",
   	fields: {
   		title: fields.text({ label: "제목", required: "publish", localized: true }),
   		slug: fields.slug({ label: "주소", from: "title", required: "publish" }),
   	},
   	list: { columns: ["title", "status", "updatedAt"] },
   });

   export default defineConfig({
   	collections: { post },
   	locales: [{ code: "ko", name: "한국어" }],
   	defaultLocale: "ko",
   });
   ```

2. CMS 코드가 설정 파일을 `@cms-config`라는 이름으로 읽도록 잇는다.

   ```ts
   // next.config.ts
   import { withCms } from "@bh2980/cms/next";

   export default withCms({ /* 기존 설정 */ }, { config: "./src/cms.config.ts" });
   ```

   ```jsonc
   // tsconfig.json
   { "compilerOptions": { "paths": { "@cms-config": ["./src/cms.config.ts"] } } }
   ```

   테스트(Vitest)를 쓰면 `resolve.alias`에도 같은 별칭을 둔다.

3. 환경 변수를 둔다: `CMS_DATABASE_URL`(Postgres), `CMS_R2_*`(미디어 저장소), `AUTH_*`(관리자 로그인).
   DB 표는 `adapters/postgres/migrate-cli.ts`로 만든다.

## 설정

| 항목 | 뜻 |
|---|---|
| `collections` | 컬렉션 이름 → `defineCollection` 정의. 이름은 DB에 저장되므로 운영 중에 바꾸지 않는다. |
| `locales` | 콘텐츠 언어 목록(`code`, `name`, 관리자 화면 이름 `label`). |
| `defaultLocale` | 기본 언어. 공개 주소에 언어 접두사가 붙지 않는다. |
| `site.url` | 공개 사이트 주소. 본문에 전체 주소로 적은 링크도 내부 링크로 알아본다. 환경 변수에서 읽어도 된다. |
| `site.aliases` | 같은 사이트로 볼 다른 호스트 이름(예: `www.example.com`). |

컬렉션의 `path`(예: `/posts/:slug`)는 공개 주소 모양이다. 본문의 내부 링크를 알아보고(가리키는 글이 있는지·공개됐는지
발행 전에 검사) 편집기가 링크를 만들 때 쓴다. `path`가 없는 컬렉션은 본문 링크로 가리킬 수 없다.

`defineConfig`는 관계 필드가 없는 컬렉션을 가리키거나 기본 언어가 목록에 없으면 앱이 뜰 때 바로 오류를 낸다.

## 아직 남은 일

이 패키지는 bh2980 블로그에서 떼어 내는 중이다. 다른 블로그에서 쓰기 전에 아래를 정리해야 한다.

- AI 기본 기능이 컬렉션 이름(`post`·`memo`·`tag`·`category`)을 직접 안다. 설정으로 옮겨야 한다.
  `pnpm --filter @bh2980/cms typecheck:other-site`가 이름이 다른 예시 사이트(`test/other-site.config.ts`)로
  본체를 타입 검사한다. 지금은 AI 실행 코드(`ai/run.ts`)만 실패한다.
- 본문 블록(`blocks/definitions.ts`)은 내장 목록뿐이다. 사이트가 블록을 더하고 빼는 설정이 없다.
- DB·미디어 저장소·로그인 연결이 환경 변수로 고정돼 있다(`container.ts`). 설정에서 고르게 바꿔야 한다.
- 지금은 빌드 없이 TypeScript 소스를 그대로 내보낸다(`transpilePackages`). 배포 전에 빌드 단계가 필요하다.

## 개발

```bash
pnpm --filter @bh2980/cms test:run
pnpm --filter @bh2980/cms typecheck
```

패키지 자체 테스트는 예시 설정 `test/cms.config.ts`로 돈다.
