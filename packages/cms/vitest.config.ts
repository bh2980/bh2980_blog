import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		name: "cms",
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		testTimeout: 60000,
		hookTimeout: 60000,
		env: {
			// 저장소 루트에서 돌려도 이 패키지에서 돌려도 같은 `.env.local`을 읽는다.
			...loadEnv(mode, path.resolve(__dirname, "../.."), ""),
			...loadEnv(mode, __dirname, ""),
			TZ: "UTC",
		},
	},
	resolve: {
		alias: {
			// 패키지 자체 테스트는 예시 블로그 설정으로 돈다.
			"@cms-config": path.resolve(__dirname, "./test/cms.config.ts"),
			"server-only": path.resolve(__dirname, "./test/server-only.ts"),
		},
	},
}));
