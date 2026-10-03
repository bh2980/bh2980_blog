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
		// 요약·검색 값은 이름이 아니라 역할(`role`)로 찾는다. 블로그와 다른 이름을 쓴다.
		excerpt: fields.text({ label: "Excerpt", role: "summary", multiline: true, fillFromBody: true }),
		metaTitle: fields.text({ label: "Search title", role: "seoTitle" }),
		metaDescription: fields.text({ label: "Search description", role: "seoDescription", multiline: true }),
		shareImage: fields.text({ label: "Share image", role: "ogImage" }),
		hideFromSearch: fields.select({
			label: "Hide from search",
			role: "noindex",
			options: { index: "No", noindex: "Yes" },
			defaultValue: "index",
		}),
	},
	layout: [
		{ fields: ["title", "slug", "excerpt", "topicIds"] },
		// `seo: true` 묶음은 편집 화면의 SEO 탭에 그린다.
		{ group: "Search", seo: true, fields: ["metaTitle", "metaDescription", "shareImage", "hideFromSearch"] },
	],
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
