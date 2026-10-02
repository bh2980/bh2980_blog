import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		environment: "jsdom",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		setupFiles: ["./src/test/setup-dom.ts"],
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
			// `server-only`는 next의 의존성으로만 설치되어 루트에서 해석되지 않는다.
			// Next 빌드에는 영향이 없고, 테스트만 스텁으로 대체한다.
			"server-only": path.resolve(__dirname, "./src/test/stubs/server-only.ts"),
		},
	},
}));
