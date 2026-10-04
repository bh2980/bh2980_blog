import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "blog",
					environment: "jsdom",
					globals: true,
					include: ["src/**/*.{test,spec}.{ts,tsx}"],
					setupFiles: ["./src/test/setup-dom.ts"],
				},
			},
		],
		// Monti 패키지는 `@cms-config`·`@cms-server` 별칭을 불러온다. node_modules 안 코드는 vite를 거치지 않아 별칭이 안 먹으니 변환 대상에 넣는다.
		server: { deps: { inline: [/@monti-cms\//] } },
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
			// `server-only`는 React 서버 환경 밖에서 불러오면 오류를 던진다. Next 빌드에는 영향이 없고, 테스트만 스텁으로 대체한다.
			"server-only": path.resolve(__dirname, "./src/test/stubs/server-only.ts"),
		},
	},
}));
