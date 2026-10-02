import { defineConfig } from "@bh2980/cms";
import base from "../../cms/test/cms.config";
import { aiPlugin, aiPresets } from "../src";

/** 본체 패키지의 예시 블로그 설정에 이 블로그와 같은 AI 플러그인을 더한 설정. AI 플러그인 테스트가 쓴다. */
export default defineConfig({
	...base,
	plugins: [
		aiPlugin({
			siteDescription: "개인 기술 블로그",
			shared: {
				styleGuide: { label: "문체 가이드", text: "" },
			},
			actions: {
				slug: aiPresets.slug({ collections: ["post", "memo"] }),
				summary: aiPresets.summary({ collections: ["post"] }),
				tags: aiPresets.tags({ choices: "tag", collections: ["post", "memo"] }),
				category: aiPresets.category({ choices: "category", collections: ["post"] }),
				seoTitle: aiPresets.seoTitle({ collections: ["post", "memo"] }),
				seoDescription: aiPresets.seoDescription({ collections: ["post", "memo"] }),
				imageAlt: aiPresets.imageAlt(),
				imageCaption: aiPresets.imageCaption(),
				mediaFilename: aiPresets.mediaFilename(),
				translate: aiPresets.translate(),
				codeFold: aiPresets.codeFold(),
				polish: aiPresets.polish({ styleGuide: "styleGuide" }),
				draft: aiPresets.draft({ styleGuide: "styleGuide" }),
			},
		}),
	],
});
