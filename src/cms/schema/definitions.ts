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
	label: "주소 (slug)",
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
	placeholder: "태그 검색·선택",
});
const publishedAt = fields.datetime({
	label: "표시 발행일 (서울 시간)",
	pastOnly: true,
	description: "비워 두면 처음 발행한 시각을 씁니다. 미래 발행은 예약 기능을 쓰세요.",
});

/** 검색엔진·공유용 값(O1 A6). 비우면 공개 화면이 제목·요약을 쓴다. */
const seo = {
	seoTitle: fields.text({ label: "검색 제목 (비우면 글 제목)", localized: true }),
	seoDescription: fields.text({ label: "검색 설명 (비우면 요약)", multiline: true, localized: true }),
	canonicalUrl: fields.text({
		label: "canonical URL",
		localized: true,
		placeholder: "/posts/slug 또는 https://...",
		description:
			"값을 넣으면 canonical이 이 주소가 되고 sitemap에서 빠집니다. 사이트 경로(/...)와 http(s) 주소만 반영됩니다.",
	}),
	/** OG 이미지 미디어 ID. 입력 UI와 head 반영은 아직 없다. */
	ogImageId: fields.text({ label: "OG 이미지", hidden: true }),
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
		publishedAt,
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
		{ group: "분류", fields: ["categoryId", "tagIds"] },
		{ group: "발행", fields: ["publishedAt", "policy"] },
		{ group: "SEO", fields: ["seoTitle", "seoDescription", "canonicalUrl"], collapsed: true },
	],
	list: { columns: ["title", "status", "categoryId", "tagIds", "updatedAt", "publishedAt"] },
});

export const memo = collection({
	label: "메모",
	workflow: "publish",
	fields: { title, slug: contentSlug, tagIds, publishedAt, ...seo },
	layout: [
		{ fields: ["title", "slug"] },
		{ group: "분류", fields: ["tagIds"] },
		{ group: "발행", fields: ["publishedAt"] },
		{ group: "SEO", fields: ["seoTitle", "seoDescription", "canonicalUrl"], collapsed: true },
	],
	list: { columns: ["title", "status", "tagIds", "updatedAt", "publishedAt"] },
});

/** 이름만 언어별 값이고 주소와 연결 관계는 공통이다(v2 B4). */
const taxonomyFields = {
	title: fields.text({ label: "이름", required: "publish", max: 200, localized: true }),
	slug: fields.slug({ label: "주소 (slug)", from: "title", required: "publish" }),
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
