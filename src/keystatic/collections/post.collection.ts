import { collection } from "@keystatic/core";
import { fields } from "../fields";
import { getCategoryTitleSlug } from "../libs/get-category-title-slug";

export const postCollection = collection({
	label: "게시글",
	slugField: "title",
	path: "src/contents/posts/**",
	entryLayout: "content",
	format: { contentField: "content" }, // 본문 분리 저장
	schema: {
		category: fields.relationship({
			collection: "postCategory",
			label: "카테고리",
			validation: { isRequired: true },
		}),
		title: fields.slug({
			name: { label: "제목", validation: { isRequired: true } },
			slug: { generate: getCategoryTitleSlug },
		}),
		publishedDate: fields.datetime({
			label: "발행일",
			defaultValue: { kind: "now" },
			validation: { isRequired: true },
		}),

		tags: fields.array(fields.relationship({ collection: "tag", label: "태그" }), {
			label: "태그",
			itemLabel: (props) => props.value ?? "태그 선택",
		}),

		content: fields.mdx({
			label: "내용",
			options: { image: { directory: "public/assets/images/posts", publicPath: "/assets/images/posts" } },
		}),
	},
	previewUrl: `/preview/start?branch={branch}&to=/posts/{slug}`,
});
