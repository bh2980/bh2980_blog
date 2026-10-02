import { aiPresets, defineCollection, defineConfig, fields } from "../src";

/**
 * 패키지 자체 테스트가 쓰는 예시 사이트 설정. bh2980 블로그의 설정(`src/cms.config.ts`)과 같은 모양이다.
 * 패키지 코드는 아직 이 컬렉션 이름(post·memo·category·tag·collection)을 직접 아는 곳이 있어 모양을 맞춘다.
 */

const title = fields.text({
	label: "제목",
	required: "publish",
	max: 200,
	placeholder: "제목 없는 글",
	localized: true,
});
const slug = fields.slug({
	label: "주소",
	from: "title",
	required: "publish",
	placeholder: "url-friendly-slug",
	localized: "inherit",
});
const contentSlug = {
	...slug,
	description: "발행된 글의 주소를 바꾸면 이전 주소는 308 리다이렉트로 새 주소를 안내합니다.",
} as const;
const tagIds = fields.relation({
	label: "태그",
	to: "tag",
	many: true,
	createInline: true,
	description: "고른 순서를 보존합니다.",
});

/**
 * 검색엔진·공유용 값(O1 A6, v3 SEO 탭). 비우면 공개 화면이 제목·요약·자동 카드를 쓴다.
 * 편집 화면은 이 묶음을 전용 SEO 탭(`seo-panel.tsx`)으로 그린다.
 */
const seo = {
	seoTitle: fields.text({ label: "검색 제목", localized: true }),
	seoDescription: fields.text({ label: "검색 설명", multiline: true, localized: true }),
	/** 링크 미리보기·검색 결과 이미지(미디어 ID). 비우면 제목으로 만든 카드를 쓴다. */
	ogImageId: fields.text({ label: "공유 이미지", localized: true }),
	/** `noindex`면 검색엔진에 숨기고 sitemap에서 뺀다. */
	seoRobots: fields.select({
		label: "검색 노출",
		options: { index: "노출", noindex: "숨기기" },
		defaultValue: "index",
	}),
	/** 다른 곳에 먼저 올린 글의 주소(canonical). 넣으면 sitemap에서 빠진다. 사이트 경로(/...)와 http(s)만 받는다. */
	canonicalUrl: fields.text({ label: "원본 주소", localized: true, placeholder: "https://" }),
} as const;

export const post = defineCollection({
	label: "게시글",
	workflow: "publish",
	path: "/posts/:slug",
	fields: {
		title,
		slug: contentSlug,
		summary: fields.text({
			label: "요약",
			multiline: true,
			placeholder: "목록과 검색 결과에 보일 소개글",
			input: "auto-summary",
			localized: true,
		}),
		categoryId: fields.relation({ label: "카테고리", to: "category", required: "publish", createInline: true }),
		tagIds,
		series: fields.backlink({
			label: "모음집",
			from: "collection",
			via: "itemIds",
			createInline: true,
			description: "누르는 즉시 모음집에 저장됩니다(글의 초안·발행과 별개). 추가하면 모음집 끝에 들어갑니다.",
			placeholder: "모음집에 추가",
		}),
		policy: fields.conditional(
			fields.select({
				label: "정책",
				description: "지원 중단 글은 공개 화면에서 대체 글을 안내합니다.",
				options: { normal: "일반", evergreen: "항상 최신 글", deprecated: "지원 중단" },
				defaultValue: "normal",
			}),
			{
				/** 독자를 안내할 최신 글(v1 §6.4 "대체 글 관계"). */
				deprecated: {
					replacementPostId: fields.relation({
						label: "대체 글",
						to: "post",
						publishedOnly: true,
						placeholder: "공개된 글 고르기",
					}),
				},
			},
		),
		...seo,
	},
	layout: [
		{ fields: ["title", "slug", "summary"] },
		{ group: "분류", fields: ["categoryId", "tagIds", "series"] },
		{ group: "정책", fields: ["policy"] },
		{ group: "SEO", fields: ["seoTitle", "seoDescription", "ogImageId", "seoRobots", "canonicalUrl"], collapsed: true },
	],
	list: { columns: ["title", "status", "locale", "categoryId", "tagIds", "updatedAt", "publishedAt"] },
});

export const memo = defineCollection({
	label: "메모",
	workflow: "publish",
	path: "/memos/:slug",
	fields: {
		title,
		slug: contentSlug,
		tagIds,
		series: fields.backlink({
			label: "모음집",
			from: "collection",
			via: "memoIds",
			createInline: true,
			description:
				"누르는 즉시 모음집에 저장됩니다(메모의 초안·발행과 별개). 메모를 담는 모음집만 고를 수 있고, 추가하면 끝에 들어갑니다.",
			placeholder: "모음집에 추가",
		}),
		...seo,
	},
	layout: [
		{ fields: ["title", "slug"] },
		{ group: "분류", fields: ["tagIds", "series"] },
		{ group: "SEO", fields: ["seoTitle", "seoDescription", "ogImageId", "seoRobots", "canonicalUrl"], collapsed: true },
	],
	list: { columns: ["title", "status", "locale", "tagIds", "updatedAt", "publishedAt"] },
});

/** 이름만 언어별 값이고 주소와 연결 관계는 공통이다(v2 B4). */
const taxonomyFields = {
	title: fields.text({ label: "이름", required: "publish", max: 200, localized: true }),
	slug: fields.slug({ label: "주소", from: "title", required: "publish" }),
} as const;

export const category = defineCollection({
	label: "카테고리",
	workflow: "record",
	fields: taxonomyFields,
	list: { columns: ["title", "slug", "locale", "status", "updatedAt"] },
});

export const tag = defineCollection({
	label: "태그",
	workflow: "record",
	fields: taxonomyFields,
	list: { columns: ["title", "slug", "locale", "status", "updatedAt"] },
});

export const series = defineCollection({
	label: "모음집",
	workflow: "record",
	fields: {
		...taxonomyFields,
		summary: fields.text({ label: "설명", multiline: true, localized: true }),
		/**
		 * 모음집은 게시글 또는 메모 한 종류를 순서대로 담는다. 게시글 목록은 예전 키(`itemIds`)를 그대로 쓴다.
		 * 종류를 바꿔 저장하면 다른 종류 목록은 비워진다.
		 */
		itemKind: fields.conditional(
			fields.select({
				label: "담는 글",
				options: { post: "게시글", memo: "메모" },
				defaultValue: "post",
				description: "종류를 바꿔 저장하면 담아 둔 다른 종류 목록은 비워집니다.",
			}),
			{
				post: {
					itemIds: fields.relation({
						label: "게시글",
						to: "post",
						many: true,
						ordered: true,
						allowUnpublished: true,
						description: "아직 공개되지 않은 글도 담을 수 있고 공개 목록에서만 빠집니다.",
						placeholder: "글 추가·빼기",
					}),
				},
				memo: {
					memoIds: fields.relation({
						label: "메모",
						to: "memo",
						many: true,
						ordered: true,
						allowUnpublished: true,
						description: "아직 공개되지 않은 메모도 담을 수 있고 공개 목록에서만 빠집니다.",
						placeholder: "메모 추가·빼기",
					}),
				},
			},
		),
	},
	list: { columns: ["title", "slug", "locale", "status", "updatedAt"] },
});

export default defineConfig({
	collections: { post, memo, category, tag, collection: series },
	locales: [
		{ code: "ko", name: "한국어", label: "한국어" },
		{ code: "en", name: "English", label: "영어" },
		{ code: "ja", name: "日本語", label: "일본어" },
	],
	defaultLocale: "ko",
	site: { url: "https://bh2980.dev", aliases: ["www.bh2980.dev"] },
	ai: {
		siteDescription: "개인 기술 블로그",
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
		},
	},
	seed: {
		templates: [
			{
				id: "00000000-0000-4000-8000-000000000001",
				name: "알고리즘 풀이",
				mdx: "## 문제\n\n\n## 풀이\n\n```ts\n\n```\n",
			},
			{
				id: "00000000-0000-4000-8000-000000000002",
				name: "Type Challenge 풀이",
				mdx: "### 질문\n\n\n```ts\n\n```\n\n### 풀이\n\n",
			},
			{
				id: "00000000-0000-4000-8000-000000000003",
				name: "일반 게시글",
				mdx: "## 개요\n\n글의 핵심을 소개합니다.\n\n## 본문\n\n\n## 정리\n\n마무리 내용을 작성합니다.\n",
			},
		],
	},
});
