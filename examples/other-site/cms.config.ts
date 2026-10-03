import { defineBlock, defineCollection, defineConfig, fields } from "@bh2980/cms";
import { callout, chart } from "@bh2980/cms-blocks";

/** 블로그와 컬렉션·언어가 전혀 다른 예시 사이트. 글(article)과 주제(topic), 영어 하나다. */

const article = defineCollection({
	label: "Article",
	workflow: "publish",
	path: "/blog/:slug/",
	icon: "newspaper",
	fields: {
		title: fields.text({ label: "Title", required: "publish" }),
		slug: fields.slug({ label: "Slug", from: "title", required: "publish" }),
		topicIds: fields.relation({ label: "Topics", to: "topic", many: true }),
	},
	list: { columns: ["title", "status", "topicIds", "updatedAt"] },
});

const topic = defineCollection({
	label: "Topic",
	workflow: "record",
	icon: "tag",
	fields: {
		title: fields.text({ label: "Name", required: "publish" }),
		slug: fields.slug({ label: "Slug", from: "title", required: "publish" }),
	},
	list: { columns: ["title", "slug"] },
});

/** 사용자 블록: 인용 카드. 공개 화면은 사이트의 `QuoteCard` 컴포넌트가 그린다. */
const quoteCard = defineBlock({
	name: "quote-card",
	label: "Quote card",
	syntax: { kind: "container", directive: "quote-card" },
	component: "QuoteCard",
	attributes: { author: { type: "string", label: "Author" } },
	editor: { view: "node", insertable: true, keywords: ["quote", "card"] },
});

export default defineConfig({
	collections: { article, topic },
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	site: { name: "Example site", previewPath: "/preview" },
	timeZone: "UTC",
	// 블록 확장에서 콜아웃·차트만 설치하고, 사용자 블록 하나를 더한다.
	plugins: [callout(), chart()],
	blocks: [quoteCard],
});
