import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * 재발 방지(M10-1): 블로그와 컬렉션·필드·언어·블록이 다른 설정(`test/other-site.config.ts`)으로 본체 테스트를 다시 돈다.
 * 새 테스트는 저절로 이 묶음에도 들어간다. 컬렉션·필드 이름은 설정에서 찾는다(`test/any-site.ts`).
 * 블로그 예시 설정의 컬렉션·필드·블록·언어(post·category·callout·ko…)를 그대로 쓰는 테스트만 아래에서 뺀다.
 */
const BLOG_FIXTURE_TESTS = [
	// 블로그 컬렉션(post·memo·category·tag·collection)으로 저장소·서비스를 시험한다.
	"src/adapters/postgres/__test__/content-store.test.ts",
	"src/adapters/postgres/__test__/duplicate.test.ts",
	"src/adapters/postgres/__test__/folders.test.ts",
	"src/adapters/postgres/__test__/lifecycle.test.ts",
	"src/adapters/postgres/__test__/list-entries.test.ts",
	"src/adapters/postgres/__test__/public-read.test.ts",
	"src/adapters/postgres/__test__/references.test.ts",
	"src/adapters/postgres/__test__/review-regressions.test.ts",
	"src/adapters/postgres/__test__/templates.test.ts",
	"src/adapters/postgres/__test__/translations.test.ts",
	"src/adapters/postgres/__test__/working-entry-by-slug.test.ts",
	"src/services/__test__/bulk-metadata.test.ts",
	"src/services/__test__/content-service.test.ts",
	"src/services/__test__/export-service.test.ts",
	"src/http/v1/__test__/bulk.test.ts",
	"src/http/v1/__test__/entries.test.ts",
	"src/http/v1/__test__/export.test.ts",
	"src/http/v1/folders/__test__/folders-api.test.ts",
	"src/http/v1/preferences/__test__/preferences.test.ts",
	// 블로그 컬렉션 목록·주소·시간대(Asia/Seoul)를 그대로 확인한다.
	"src/core/__test__/collections.test.ts",
	"src/core/__test__/links.test.ts",
	"src/core/__test__/time.test.ts",
	// 블로그 블록(콜아웃·탭·Mermaid 등)과 한국어·일본어 번역본을 쓰는 본문 변환·번역 검사.
	"src/blocks/__test__/resolve.test.ts",
	"src/core/__test__/table-validation.test.ts",
	"src/core/translation/__test__/skeleton.test.ts",
	"src/core/translation/__test__/source-diff.test.ts",
	"src/mdx/__test__/analyze-security.test.ts",
	"src/mdx/__test__/directive-write.test.ts",
	"src/mdx/__test__/directives.test.ts",
	"src/mdx/__test__/fence-blocks.test.ts",
	"src/mdx/__test__/roundtrip.test.ts",
];

export default defineConfig(({ mode }) => ({
	test: {
		name: "cms (other-site)",
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: BLOG_FIXTURE_TESTS,
		sequence: { groupOrder: 1 },
		testTimeout: 60000,
		hookTimeout: 60000,
		env: {
			...loadEnv(mode, path.resolve(__dirname, "../.."), ""),
			...loadEnv(mode, __dirname, ""),
			TZ: "UTC",
		},
	},
	resolve: {
		alias: {
			"@cms-config": path.resolve(__dirname, "./test/other-site.config.ts"),
			"@cms-server": path.resolve(__dirname, "./test/cms.server.ts"),
			"server-only": path.resolve(__dirname, "./test/server-only.ts"),
		},
	},
}));
