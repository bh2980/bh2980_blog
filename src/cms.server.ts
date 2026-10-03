import { defineServerConfig, githubAuth, postgres, r2Storage } from "@bh2980/cms/server";

/**
 * 이 블로그의 CMS 서버 설정. 저장소·미디어·관리자 로그인 연결과 비밀 값은 환경 변수에서 읽는다.
 * 서버에서만 읽힌다(`@cms-server` 별칭). 브라우저도 읽는 사이트 설정은 `cms.config.ts`다.
 */
export default defineServerConfig({
	database: postgres({
		connectionString: process.env.CMS_DATABASE_URL,
		// 같은 DB를 여러 스키마로 나눠 쓰는 미리보기/스테이징에서 바꾼다. 운영은 미설정(`public`)이다.
		schema: process.env.CMS_SCHEMA,
	}),
	media: r2Storage({
		accountId: process.env.CMS_R2_ACCOUNT_ID,
		accessKeyId: process.env.CMS_R2_ACCESS_KEY_ID,
		secretAccessKey: process.env.CMS_R2_SECRET_ACCESS_KEY,
		bucket: process.env.CMS_R2_BUCKET,
		endpoint: process.env.CMS_R2_ENDPOINT,
		publicBaseUrl: process.env.CMS_R2_PUBLIC_BASE_URL,
	}),
	auth: githubAuth({
		clientId: process.env.AUTH_GITHUB_ID,
		clientSecret: process.env.AUTH_GITHUB_SECRET,
		adminIds: [process.env.CMS_ADMIN_GITHUB_ID],
		devBypass: process.env.CMS_DEV_AUTH_BYPASS === "1",
		// 운영 GitHub OAuth 앱의 콜백 주소가 `/api/auth/callback/github`라 예전 로그인 경로를 그대로 쓴다
		// (`src/app/api/auth/[...nextauth]/route.ts`). 새 사이트는 기본값(`/api/cms/auth`, 라우트 파일 없음)을 쓴다.
		basePath: "/api/auth",
	}),
	secret: process.env.AUTH_SECRET,
	schedulerToken: process.env.CMS_SCHEDULER_TOKEN,
});
