import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		environment: "jsdom",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		testTimeout: 20000,
		hookTimeout: 20000,
		env: loadEnv(mode, process.cwd(), ""),
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
}));

