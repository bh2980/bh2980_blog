import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		// 블로그와 CMS 패키지(`packages/*`)를 한 번에 돌린다. 패키지는 자기 설정 파일을 쓴다.
		projects: [
			{
				extends: true,
				test: {
					name: "blog",
					environment: "jsdom",
					globals: true,
					include: ["src/**/*.{test,spec}.{ts,tsx}"],
					setupFiles: ["./src/test/setup-dom.ts"],
					// 두 묶음을 동시에 돌리면 무거운 화면 테스트가 제한 시간에 걸린다. 블로그 묶음을 먼저 돌린다.
					sequence: { groupOrder: 0 },
				},
			},
			"packages/*",
			// 재발 방지(M10-1): 블로그와 다른 사이트 설정으로 본체·관리자·AI 테스트를 다시 돈다.
			"packages/*/vitest.othersite.config.ts",
		],
		testTimeout: 60000,
		hookTimeout: 60000,
		env: {
			...loadEnv(mode, process.cwd(), ""),
			// 운영(Vercel)은 UTC로 돈다. 테스트를 로컬 시간대에 두면 표시 날짜처럼
			// 타임존에 민감한 로직의 회귀를 개발자 환경에서만 못 잡는다.
			TZ: "UTC",
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@cms-config": path.resolve(__dirname, "./src/cms.config.ts"),
			"@cms-server": path.resolve(__dirname, "./src/cms.server.ts"),
			// `server-only`는 next의 의존성으로만 설치되어 루트에서 해석되지 않는다.
			// Next 빌드에는 영향이 없고, 테스트만 스텁으로 대체한다.
			"server-only": path.resolve(__dirname, "./src/test/stubs/server-only.ts"),
		},
	},
}));
