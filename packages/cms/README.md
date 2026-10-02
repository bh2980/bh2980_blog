# @bh2980/cms

DB(Postgres) 기반 블로그 CMS의 본체. 사이트 설정, 컬렉션 스키마, 콘텐츠 저장·발행, MDX 변환, 플러그인 연결을 맡는다.
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

2. 서버 설정 파일을 만든다. 저장소·미디어·관리자 로그인 연결과 비밀 값을 두고, 서버에서만 읽힌다.
   연결은 처음 쓸 때 만들므로 빌드 중에 환경 변수가 비어 있어도 된다.

   ```ts
   // src/cms.server.ts
   import { defineServerConfig, githubAuth, postgres, r2Storage } from "@bh2980/cms/server";

   export default defineServerConfig({
   	database: postgres({ connectionString: process.env.DATABASE_URL }),
   	media: r2Storage({ accountId: …, accessKeyId: …, secretAccessKey: …, bucket: …, endpoint: …, publicBaseUrl: … }),
   	auth: githubAuth({
   		clientId: process.env.AUTH_GITHUB_ID,
   		clientSecret: process.env.AUTH_GITHUB_SECRET,
   		adminIds: [process.env.ADMIN_GITHUB_ID],
   	}),
   	secret: process.env.AUTH_SECRET,
   });
   ```

3. CMS 코드가 두 설정 파일을 `@cms-config`·`@cms-server`라는 이름으로 읽도록 잇는다.

   ```ts
   // next.config.ts
   import { withCms } from "@bh2980/cms/next";

   export default withCms({ /* 기존 설정 */ }, { config: "./src/cms.config.ts", server: "./src/cms.server.ts" });
   ```

   ```jsonc
   // tsconfig.json
   {
   	"compilerOptions": {
   		"paths": { "@cms-config": ["./src/cms.config.ts"], "@cms-server": ["./src/cms.server.ts"] }
   	}
   }
   ```

   테스트(Vitest)를 쓰면 `resolve.alias`에도 같은 별칭을 둔다.

4. DB 표를 만든다: `tsx packages/cms/src/adapters/postgres/migrate-cli.ts`(서버 설정의 `database`를 쓴다).
   로그인 라우트는 `app/api/auth/[...nextauth]/route.ts`에서 `export const { GET, POST } = handlers;`
   (`@bh2980/cms/adapters/auth`)로 둔다.

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

컬렉션의 `path`(예: `/posts/:slug`)는 공개 주소 모양이다. 본문의 내부 링크를 알아보고(가리키는 글이 있는지·공개됐는지
발행 전에 검사) 편집기가 링크를 만들 때 쓴다. `path`가 없는 컬렉션은 본문 링크로 가리킬 수 없다.

`defineConfig`는 관계 필드가 없는 컬렉션을 가리키거나 기본 언어가 목록에 없으면 앱이 뜰 때 바로 오류를 낸다.

## 아직 남은 일

이 패키지는 bh2980 블로그에서 떼어 내는 중이다. 다른 블로그에서 쓰기 전에 아래를 정리해야 한다.

- 본문 블록(`blocks/definitions.ts`)은 내장 목록뿐이다. 사이트가 블록을 더하고 빼는 설정이 없다.
- 저장소는 Postgres(`ContentStore`)만 있다. 다른 DB를 쓰려면 같은 계약을 구현해야 하는데 계약이 아직 크다.
- 지금은 빌드 없이 TypeScript 소스를 그대로 내보낸다(`transpilePackages`). 배포 전에 빌드 단계가 필요하다.

## 개발

```bash
pnpm --filter @bh2980/cms test:run
pnpm --filter @bh2980/cms typecheck
```

패키지 자체 테스트는 예시 설정 `test/cms.config.ts`·`test/cms.server.ts`로 돈다.
