import { chartBlock } from "../../cms-blocks/src/definitions";
import { defineBlock, defineCollection, defineConfig, fields } from "../src";

/**
 * 재발 방지용 다른 사이트 설정(M10-1). bh2980 블로그(`cms.config.ts`)와 일부러 다르게 만든다.
 * - 컬렉션: article·topic·author(블로그의 post·memo·category·tag·collection이 없다)
 * - 필드: 라이브러리 약속인 `title`과 주소 필드 `slug`만 같고 나머지 이름(`excerpt`·`topicIds`·`authorId`·`heroImage`·
 *   `metaTitle`…)과 이름표는 모두 다르다. 제목 글자 수 한도도 블로그(200)와 다르다(120).
 * - 언어: 영어 하나. 블록: 블록 확장의 차트만 + 사이트 블록(인용 카드·코드 펜스 지도).
 *
 * 본체·관리자·AI 테스트 일부가 이 설정으로도 돈다(각 패키지의 `vitest.othersite.config.ts`). 타입 검사도 한다
 * (`tsconfig.other-site.json`). 예시 앱 `examples/other-site/cms.config.ts`와 모양을 맞춘다.
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
	site: { url: "https://example.org", name: "Example site", previewPath: "/preview" },
	timeZone: "UTC",
	blocks: [chartBlock, quoteCard, mapBlock],
});
