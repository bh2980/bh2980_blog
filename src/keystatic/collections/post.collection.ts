import { collection } from "@keystatic/core";
import { fields } from "../fields";
import { getSlugWithLabel, mapLabelSlugToValueSlug } from "../libs/slug";

export const POST_CATEGORIES = [
	{ label: "구현", value: "implementation" },
	{ label: "탐구", value: "deep-dive" },
	{ label: "생각", value: "thought" },
	{ label: "리뷰", value: "review" },
	{ label: "참조", value: "reference" },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number];

export const postCollection = collection({
	label: "게시글",
	slugField: "title",
	path: "src/contents/posts/**",
	entryLayout: "content",
	format: { contentField: "content" },
	schema: {
		category: fields.select({
			label: "카테고리",
			defaultValue: "deep-dive",
			options: POST_CATEGORIES,
		}),
		title: fields.slug({
			name: { label: "제목", validation: { isRequired: true } },
			slug: { generate: (name) => mapLabelSlugToValueSlug(getSlugWithLabel("카테고리")(name), POST_CATEGORIES) },
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
