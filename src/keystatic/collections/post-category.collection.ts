import { collection, fields } from "@keystatic/core";

export const postCategoryCollection = collection({
	label: "카테고리",
	slugField: "name",
	path: "src/contents/post-categories/*",
	schema: {
		name: fields.slug({
			name: { label: "제목", validation: { isRequired: true } },
		}),
	},
});
