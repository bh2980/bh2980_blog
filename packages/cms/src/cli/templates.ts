import { DEFAULT_ADMIN_PATH } from "../config/define";

/** `cms init`이 만드는 파일 내용. 앱이 바로 고쳐 쓰는 시작점이다. */

export function configTemplate(adminPath: string): string {
	const admin =
		adminPath === DEFAULT_ADMIN_PATH
			? ""
			: `\t// 관리자 화면 경로. 관리자 라우트 폴더((admin)${adminPath}/)와 같아야 한다.\n\tadmin: { path: "${adminPath}" },\n`;
	return `import { defineCollection, defineConfig, fields } from "@bh2980/cms";
// 선택: 블록 확장(콜아웃·탭·Mermaid·차트 등)과 SEO 확장. 패키지를 설치한 뒤 주석을 푼다.
// import { blocks } from "@bh2980/cms-blocks";
// import { seo, seoFields } from "@bh2980/cms-seo";

/**
 * 사이트 설정. 서버와 관리자 화면이 함께 읽으므로 비밀 값은 넣지 않는다(비밀 값은 cms.server.ts).
 * 컬렉션 이름(아래 \`post\`)은 DB에 저장되므로 운영 중에 바꾸지 않는다. 필드는 자유롭게 더하고 고친다.
 */
const post = defineCollection({
	label: "글",
	kind: "document", // 본문·초안·발행. 태그 같은 작은 항목은 "item"
	path: "/posts/:slug", // 공개 주소 모양. 본문 내부 링크·미리보기 주소에 쓴다
	icon: "file-text",
	fields: {
		// 제목 필드 이름은 \`title\`이다(이름표는 자유).
		title: fields.text({ label: "제목", required: true, max: 200 }),
		slug: fields.slug({ label: "주소", from: "title", required: true }),
		summary: fields.text({ label: "요약", role: "summary", multiline: true, fillFromBody: true }),
		// ...seoFields(), // SEO 탭: 검색 제목·설명·공유 이미지·검색에서 숨기기
	},
});

export default defineConfig({
	collections: { post },
	locales: [{ code: "ko", name: "한국어" }],
	defaultLocale: "ko",
	site: { name: "내 사이트" },
	timeZone: "Asia/Seoul",
${admin}	// plugins: [...blocks(), seo()],
});
`;
}

export const SERVER_TEMPLATE = `import { defineServerConfig, githubAuth, postgres } from "@bh2980/cms/server";

/**
 * 서버 설정. 저장소·로그인 연결과 비밀 값은 환경 변수(.env.local)에서 읽는다. 서버에서만 읽힌다.
 * 로그인 API는 관리자 API 라우트가 함께 받는다(/api/cms/auth/*). GitHub OAuth 앱의 콜백 주소는
 * <사이트 주소>/api/cms/auth/callback/github 이다.
 */
export default defineServerConfig({
	database: postgres({ connectionString: process.env.CMS_DATABASE_URL, schema: process.env.CMS_SCHEMA }),
	auth: githubAuth({
		clientId: process.env.AUTH_GITHUB_ID,
		clientSecret: process.env.AUTH_GITHUB_SECRET,
		adminIds: [process.env.CMS_ADMIN_GITHUB_ID], // 관리자 GitHub 숫자 ID
		devBypass: process.env.CMS_DEV_AUTH_BYPASS === "1", // next dev에서만 로그인 없이 관리자로 본다
	}),
	secret: process.env.AUTH_SECRET,
	// media: r2Storage({ ... }), // 이미지·파일 올리기(S3 호환 저장소). @bh2980/cms/server에서 가져온다
});
`;

export const ADMIN_PAGE_TEMPLATE = `export { CmsAdminPage as default } from "@bh2980/cms-admin/next";
`;

export const ADMIN_LAYOUT_TEMPLATE = `import { CmsAdminLayout } from "@bh2980/cms-admin/next";
import type { ReactNode } from "react";

export { cmsAdminMetadata as metadata } from "@bh2980/cms-admin/next";

/** 관리자 화면(@bh2980/cms-admin). 사이트 컴포넌트는 CmsAdminComponentsProvider로 넣는다(관리자 README). */
export default function AdminLayout({ children }: { children: ReactNode }) {
	return <CmsAdminLayout>{children}</CmsAdminLayout>;
}
`;

export const API_ROUTE_TEMPLATE = `import { createCmsRouteHandler } from "@bh2980/cms/next/route-handler";

/** 관리자 API(/api/cms/v1/*)와 로그인(/api/cms/auth/*). */
export const { GET, POST, PATCH, PUT, DELETE } = createCmsRouteHandler();
`;

export function nextConfigTemplate(config: string, server: string): string {
	return `import { withCms } from "@bh2980/cms/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default withCms(nextConfig, { config: "${config}", server: "${server}" });
`;
}

/** 관리자 화면이 쓰는 스타일 줄. 앱의 Tailwind 입력 CSS에 `@import "tailwindcss";` 다음으로 넣는다. */
export const CSS_LINES = [
	'@import "tw-animate-css";',
	'@import "@bh2980/cms-admin/styles.css";',
	'@plugin "@tailwindcss/typography";',
] as const;

/** 앱이 설치할 패키지(관리자 패키지가 앱과 같은 하나를 써야 하는 것 포함). */
export const INSTALL_COMMANDS = [
	"pnpm add @bh2980/cms @bh2980/cms-admin next-auth@5.0.0-beta.32 next-themes @tanstack/react-query sonner @tiptap/core @tiptap/pm @tiptap/react",
	"pnpm add -D tw-animate-css @tailwindcss/typography",
] as const;

/** `.env.local`에 둘 값. */
export const ENV_VARS: readonly { readonly name: string; readonly note: string }[] = [
	{ name: "CMS_DATABASE_URL", note: "Postgres 연결 주소" },
	{ name: "CMS_SCHEMA", note: "선택. 같은 DB를 나눠 쓸 때 스키마 이름(없으면 public)" },
	{ name: "AUTH_SECRET", note: "임의의 긴 값. 로그인 세션·AI 키 암호화" },
	{ name: "AUTH_GITHUB_ID", note: "GitHub OAuth 앱 Client ID" },
	{ name: "AUTH_GITHUB_SECRET", note: "GitHub OAuth 앱 Client secret" },
	{ name: "CMS_ADMIN_GITHUB_ID", note: "관리자 GitHub 숫자 ID" },
	{ name: "CMS_DEV_AUTH_BYPASS", note: "선택. 1이면 next dev에서 로그인 없이 관리자" },
];
