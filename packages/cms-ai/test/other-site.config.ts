import { defineConfig } from "@bh2980/cms";
import base from "../../cms/test/other-site.config";
import { chartAi } from "../../cms-blocks/src/chart/ai";
import { aiPlugin, aiPresets } from "../src";

/**
 * 본체 패키지의 다른 사이트 설정(article·topic·author, 영어)에 AI 플러그인을 더한 설정. 필드 기능은 이 사이트의 필드
 * 이름(`excerpt`·`topicIds`·`authorId`·`metaTitle`…)에 붙인다. 타입 검사(`tsconfig.other-site.json`)와 AI 플러그인 테스트의
 * 다른 사이트 묶음(`vitest.othersite.config.ts`)이 쓴다.
 */
export default defineConfig({
	...base,
	plugins: [
		aiPlugin({
			siteDescription: "Example site",
			actions: {
				articleSlug: aiPresets.slug({ collections: ["article"] }),
				excerpt: aiPresets.summary({ field: "excerpt", collections: ["article"] }),
				suggestTopics: aiPresets.tags({ choices: "topic", field: "topicIds", collections: ["article"] }),
				pickAuthor: aiPresets.category({ choices: "author", field: "authorId", collections: ["article"] }),
				metaTitle: aiPresets.seoTitle({ field: "metaTitle", collections: ["article"] }),
				metaDescription: aiPresets.seoDescription({ field: "metaDescription", collections: ["article"] }),
				imageAlt: aiPresets.imageAlt(),
				translate: aiPresets.translate(),
				polish: aiPresets.polish(),
				chartDraft: chartAi.draft(),
				chartEdit: chartAi.edit(),
			},
		}),
	],
});
