import { defineConfig } from "@bh2980/cms";
import base from "../../cms/test/other-site.config";
import { aiPlugin, aiPresets } from "../src";

/** 본체 패키지의 예시 사이트 설정에 AI 플러그인을 더한 설정. 타입 검사(`tsconfig.other-site.json`)만 쓴다. */
export default defineConfig({
	...base,
	plugins: [
		aiPlugin({
			actions: {
				articleSlug: aiPresets.slug({ collections: ["article"] }),
				suggestTopics: aiPresets.tags({ choices: "topic", field: "topicIds", collections: ["article"] }),
			},
		}),
	],
});
