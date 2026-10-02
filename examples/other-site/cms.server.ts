import { defineServerConfig, githubAuth, postgres } from "@bh2980/cms/server";

/** 서버 설정. 저장소와 관리자 로그인은 환경 변수에서 읽는다(`.env.local`). 미디어 저장소는 두지 않았다. */
export default defineServerConfig({
	database: postgres({ connectionString: process.env.CMS_DATABASE_URL, schema: process.env.CMS_SCHEMA }),
	auth: githubAuth({
		clientId: process.env.AUTH_GITHUB_ID,
		clientSecret: process.env.AUTH_GITHUB_SECRET,
		adminIds: [process.env.CMS_ADMIN_GITHUB_ID],
		// 로컬 개발(`next dev`)에서만 로그인 없이 관리자로 본다.
		devBypass: process.env.CMS_DEV_AUTH_BYPASS === "1",
	}),
	secret: process.env.AUTH_SECRET,
});
