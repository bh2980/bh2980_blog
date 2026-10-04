import { aiPlugin } from "@monti-cms/ai";
import { bareun } from "@monti-cms/bareun";
import { blocks } from "@monti-cms/blocks";
import { defineCollection, defineConfig, fields } from "@monti-cms/core";
import { seo, seoFields } from "@monti-cms/seo";
import { legacyListColumns } from "@/cms/legacy-list-columns";
import { DEFAULT_LOCALE, LOCALE_INFO, LOCALES } from "@/libs/i18n/locales";

/**
 * 이 블로그의 CMS 설정. 컬렉션 필드나 콘텐츠 언어를 더하거나 바꿀 때 여기를 고친다.
 * 공개 블로그에 새 필드를 보여 주려면 공개 템플릿 코드는 따로 고친다.
 *
 * CMS 코드는 `@cms-config` 별칭으로 이 파일을 읽는다(`next.config.ts`·`tsconfig.json`·`vitest.config.ts`).
 * 서버와 관리자 화면이 함께 읽으므로 비밀 값은 넣지 않는다.
 */

const title = fields.text({
	label: "제목",
	required: true,
	max: 200,
	placeholder: "제목 없는 글",
	localized: true,
});
const slug = fields.slug({
	label: "주소",
	from: "title",
	required: true,
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
 * 검색엔진·공유용 값(SEO 확장). 비우면 공개 화면이 제목·요약·자동 카드를 쓴다. 필드는 SEO 탭에 모인다.
 * 이미 저장한 값이 있어 필드 이름은 예전 이름 그대로 둔다. 숨기기(`seoRobots`가 `noindex`)는 sitemap에서도 빼고,
 * 원본 주소(`canonicalUrl`)를 넣으면 sitemap에서 빠진다(사이트 경로 /...와 http(s)만 받는다).
 */
const seoValues = seoFields({
	keys: {
		preview: "searchPreview",
		title: "seoTitle",
		description: "seoDescription",
		image: "ogImageId",
		noindex: "seoRobots",
		canonical: "canonicalUrl",
	},
});

export const post = defineCollection({
	label: "게시글",
	icon: "file-text",
	kind: "document",
	path: "/posts/:slug",
	fields: {
		title,
		slug: contentSlug,
		summary: fields.text({
			label: "요약",
			multiline: true,
			placeholder: "목록과 검색 결과에 보일 소개글",
			role: "summary",
			rows: 3,
			fillFromBody: true,
			localized: true,
		}),
		categoryId: fields.relation({ label: "카테고리", to: "category", required: true, createInline: true }),
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
		...seoValues,
	},
	layout: [
		{ fields: ["title", "slug", "summary"] },
		{ group: "분류", fields: ["categoryId", "tagIds", "series"] },
		{ group: "정책", fields: ["policy"] },
	],
});

export const memo = defineCollection({
	label: "메모",
	icon: "notebook-pen",
	kind: "document",
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
		...seoValues,
	},
	layout: [{ fields: ["title", "slug"] }, { group: "분류", fields: ["tagIds", "series"] }],
});

/** 이름만 언어별 값이고 주소와 연결 관계는 공통이다(v2 B4). */
const taxonomyFields = {
	title: fields.text({ label: "이름", required: true, max: 200, localized: true }),
	slug: fields.slug({ label: "주소", from: "title", required: true }),
} as const;

export const category = defineCollection({
	label: "카테고리",
	icon: "shapes",
	kind: "item",
	fields: taxonomyFields,
});

export const tag = defineCollection({
	label: "태그",
	icon: "tag",
	kind: "item",
	fields: taxonomyFields,
});

export const series = defineCollection({
	label: "모음집",
	icon: "layers",
	kind: "item",
	fields: {
		...taxonomyFields,
		summary: fields.text({ label: "설명", role: "summary", multiline: true, localized: true }),
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
});

export default defineConfig({
	collections: { post, memo, category, tag, collection: series },
	locales: LOCALES.map((code) => ({ code, name: LOCALE_INFO[code].nativeName, label: LOCALE_INFO[code].adminName })),
	defaultLocale: DEFAULT_LOCALE,
	// 본문에 전체 주소로 적은 링크도 내부 링크로 알아본다. 서버에서만 읽힌다(브라우저에서는 비어 있다).
	site: { url: process.env.HOST_URL || undefined, name: "bh2980.com", previewPath: "/preview" },
	timeZone: "Asia/Seoul",
	// 예전 브라우저 복구본 DB 이름(main에서 쓰던 이름). 남은 복구본을 읽고 지운다.
	admin: { legacyBackupNames: ["bh2980_cms_backup"] },
	plugins: [
		// 본문 블록 확장(콜아웃·접기·탭·단·Mermaid·차트·툴팁·코드 연결·글자색). 이미 쓴 글에 있는 블록이라 빼지 않는다.
		...blocks(),
		seo(),
		// AI 기능은 기본 기능과 블록·SEO 확장이 더한 기능이 저절로 켜진다. 기본 지시문은 언어 중립이라 말투·표기 같은 이 블로그의
		// 글쓰기 규칙은 문체 가이드가 맡는다(요약·주소·이미지 문구·번역·문체 다듬기·초안 쓰기의 지시문 끝에 들어간다).
		aiPlugin({
			siteDescription: "개인 기술 블로그",
			shared: {
				styleGuide: {
					label: "문체 가이드",
					text: [
						"- 글과 요약은 '~다'체(평서문)로 쓴다.",
						"- 번역할 때 기술 용어와 제품 이름은 그 언어권 개발자가 흔히 쓰는 표기를 따른다.",
						"- 주소(slug)의 기술 이름은 널리 쓰는 표기를 따른다 (nextjs, react-query, typescript).",
						"- 이미지 캡션은 명사형으로 짧게 끝낸다 (예: 'React Query 설정 화면').",
						"- 모르는 사실은 지어내지 않고, 확인이 필요한 곳은 [확인 필요]로 적는다.",
					].join("\n"),
				},
			},
		}),
		// 맞춤법·문장 검사(바른). 키는 서버 환경 변수 `BAREUN_API_KEY`. 쓴 만큼 요금이 들어 버튼으로만 검사한다.
		bareun(),
		// 저장된 관리자 목록 열 설정의 예전 이름(category·tags)을 `cms:db:migrate`가 옮긴다.
		legacyListColumns(),
	],
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
