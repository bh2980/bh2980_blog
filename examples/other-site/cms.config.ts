import { defineBlock, defineCollection, defineConfig, fields } from "@bh2980/cms";
import { chart } from "@bh2980/cms-blocks";

/**
 * 블로그와 일부러 다르게 만든 예시 사이트. 컬렉션은 글(article)·주제(topic)·글쓴이(author), 언어는 영어 하나다.
 * 라이브러리 약속인 제목 필드 `title`과 주소 필드 `slug`만 블로그와 같고, 나머지 필드 이름·이름표는 사이트가 정한다.
 * 블록 확장에서는 차트만 설치하고 사이트 블록 둘(인용 카드·지도)을 더한다.
 * 패키지 테스트의 다른 사이트 설정(`packages/cms/test/other-site.config.ts`)과 모양이 같다.
 */

const article = defineCollection({
	label: "Article",
	icon: "newspaper",
	workflow: "publish",
	path: "/blog/:slug/",
	fields: {
		title: fields.text({ label: "Headline", required: "publish", max: 120 }),
		slug: fields.slug({ label: "Permalink", from: "title", required: "publish" }),
		// 요약·검색 값은 이름이 아니라 역할(`role`)로 찾는다. 블로그와 다른 이름을 쓴다.
		excerpt: fields.text({ label: "Excerpt", role: "summary", multiline: true, fillFromBody: true, max: 300 }),
		authorId: fields.relation({ label: "Author", to: "author", required: "publish" }),
		topicIds: fields.relation({ label: "Topics", to: "topic", many: true, createInline: true }),
		heroImage: fields.text({ label: "Hero image", placeholder: "https://" }),
		format: fields.select({
			label: "Format",
			options: { news: "News", guide: "Guide", review: "Review" },
			defaultValue: "news",
		}),
		metaTitle: fields.text({ label: "Search title", role: "seoTitle", max: 70 }),
		searchPreview: fields.view({ view: "search" }),
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
		{ fields: ["title", "slug", "excerpt", "authorId", "topicIds"] },
		{ group: "Presentation", fields: ["heroImage", "format"] },
		// 같은 `tab`의 묶음은 편집 화면의 한 탭에 모인다. 보기 필드 `searchPreview`는 검색 결과·공유 미리보기를 그린다.
		{ tab: "Search", fields: ["searchPreview", "metaTitle", "metaDescription", "shareImage", "hideFromSearch"] },
	],
	list: { columns: ["title", "status", "authorId", "topicIds", "updatedAt"] },
});

const topic = defineCollection({
	label: "Topic",
	icon: "tag",
	workflow: "record",
	fields: {
		title: fields.text({ label: "Name", required: "publish", max: 60 }),
		slug: fields.slug({ label: "Key", from: "title", required: "publish" }),
	},
	list: { columns: ["title", "slug", "updatedAt"] },
});

const author = defineCollection({
	label: "Author",
	icon: "user",
	workflow: "record",
	fields: {
		title: fields.text({ label: "Display name", required: "publish" }),
		slug: fields.slug({ label: "Handle", from: "title", required: "publish" }),
		bio: fields.text({ label: "Bio", multiline: true }),
	},
	list: { columns: ["title", "slug"] },
});

/** 사이트 블록: 인용 카드(컨테이너). 공개 화면은 사이트의 `QuoteCard` 컴포넌트가 그린다. */
const quoteCard = defineBlock({
	name: "quote-card",
	label: "Quote card",
	syntax: { kind: "container", directive: "quote-card" },
	component: "QuoteCard",
	attributes: { author: { type: "string", label: "Author", translatable: true } },
	editor: { view: "node", insertable: true, keywords: ["quote", "card"] },
});

/** 사이트 블록: 지도(코드 펜스). 펜스 안 글을 그대로 저장한다. */
const mapBlock = defineBlock({
	name: "map",
	label: "Map",
	syntax: { kind: "fence", lang: "map" },
	component: "MapEmbed",
	attributes: {},
	editor: { view: "node", insertable: true, keywords: ["map"], insert: { code: "lat 37.5\nlng 127.0" } },
});

export default defineConfig({
	collections: { article, topic, author },
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	site: { name: "Example site", previewPath: "/preview" },
	timeZone: "UTC",
	// 블록 확장에서 차트만 설치하고, 사이트 블록 둘을 더한다.
	plugins: [chart()],
	blocks: [quoteCard, mapBlock],
});
