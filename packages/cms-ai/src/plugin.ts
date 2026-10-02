import { definePlugin } from "@bh2980/cms";
import { type AiConfig, validateAiConfig } from "./action";
import { AI_PLUGIN_NAME } from "./plugin-name";

/**
 * AI 플러그인. 사이트 설정(`cms.config.ts`)의 `plugins`에 한 번 적으면 AI 기능(이름으로 부르기·필드 옆 버튼·
 * 번역)과 관리자 AI 화면, AI API(`/api/cms/v1/ai/*`), AI 표가 생긴다.
 *
 * ```ts
 * plugins: [aiPlugin({ siteDescription: "개인 기술 블로그", actions: { summary: aiPresets.summary() } })]
 * ```
 */
export function aiPlugin<const Config extends AiConfig>(config: Config) {
	return definePlugin({
		name: AI_PLUGIN_NAME,
		options: config,
		nav: [{ path: "ai", label: "AI", icon: "sparkles" }],
		validate: ({ collections }) => validateAiConfig(config, collections),
		// 브라우저 묶음에서는 `./server`가 빈 진입점(`server.browser.ts`)으로 바뀐다(package.json `exports`).
		server: () => import("@bh2980/cms-ai/server"),
		admin: () => import("@bh2980/cms-ai/admin"),
	});
}
