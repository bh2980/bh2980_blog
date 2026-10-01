import { collection } from "./collection";
import { fields } from "./fields";

/**
 * 이 블로그의 컬렉션 정의(v2 B1). 필드를 더하거나 바꿀 때 여기만 고친다.
 * 공개 블로그에 새 필드를 보여 주려면 공개 템플릿 코드는 따로 고친다.
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

export const post = collection({
	label: "게시글",
	workflow: "publish",
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
						placeholder: "공개된 글 제목 검색",
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

export const memo = collection({
	label: "메모",
	workflow: "publish",
	fields: { title, slug: contentSlug, tagIds, ...seo },
	layout: [
		{ fields: ["title", "slug"] },
		{ group: "분류", fields: ["tagIds"] },
		{ group: "SEO", fields: ["seoTitle", "seoDescription", "ogImageId", "seoRobots", "canonicalUrl"], collapsed: true },
	],
	list: { columns: ["title", "status", "locale", "tagIds", "updatedAt", "publishedAt"] },
});

/** 이름만 언어별 값이고 주소와 연결 관계는 공통이다(v2 B4). */
const taxonomyFields = {
	title: fields.text({ label: "이름", required: "publish", max: 200, localized: true }),
	slug: fields.slug({ label: "주소", from: "title", required: "publish" }),
} as const;

export const category = collection({
	label: "카테고리",
	workflow: "record",
	fields: taxonomyFields,
	list: { columns: ["title", "slug", "status", "updatedAt"] },
});

export const tag = collection({
	label: "태그",
	workflow: "record",
	fields: taxonomyFields,
	list: { columns: ["title", "slug", "status", "updatedAt"] },
});

export const series = collection({
	label: "모음집",
	workflow: "record",
	fields: {
		...taxonomyFields,
		summary: fields.text({ label: "설명", multiline: true, localized: true }),
		itemIds: fields.relation({
			label: "게시글",
			to: "post",
			many: true,
			ordered: true,
			allowUnpublished: true,
			description: "아직 공개되지 않은 글도 담을 수 있고 공개 목록에서만 빠집니다.",
			placeholder: "게시글 제목 검색",
		}),
	},
	list: { columns: ["title", "slug", "status", "updatedAt"] },
});

export const SCHEMAS = { post, memo, category, tag, collection: series } as const;
