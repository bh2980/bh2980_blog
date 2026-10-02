import { aiPresets, defineCollection, defineConfig, fields } from "../src";

/**
 * bh2980 블로그와 컬렉션·언어가 전혀 다른 예시 사이트. 본체가 특정 블로그의 컬렉션 이름에 묶이지 않았는지
 * 타입 검사로 확인한다(`tsconfig.other-site.json`, `pnpm typecheck:other-site`).
 */

const article = defineCollection({
	label: "Article",
	workflow: "publish",
	path: "/blog/:slug/",
	fields: {
		title: fields.text({ label: "Title", required: "publish" }),
		slug: fields.slug({ label: "Slug", from: "title", required: "publish" }),
		topicIds: fields.relation({ label: "Topics", to: "topic", many: true }),
	},
	list: { columns: ["title", "status", "updatedAt"] },
});

const topic = defineCollection({
	label: "Topic",
	workflow: "record",
	fields: {
		title: fields.text({ label: "Name", required: "publish" }),
		slug: fields.slug({ label: "Slug", from: "title", required: "publish" }),
	},
	list: { columns: ["title", "slug"] },
});

export default defineConfig({
	collections: { article, topic },
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	ai: {
		actions: {
			articleSlug: aiPresets.slug({ collections: ["article"] }),
			suggestTopics: aiPresets.tags({ choices: "topic", field: "topicIds", collections: ["article"] }),
		},
	},
});
