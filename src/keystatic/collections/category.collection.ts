import { collection, fields } from "@keystatic/core";

export const categoryCollection = collection({
	label: "카테고리",
	slugField: "name",
	path: "src/contents/categories/*",
	schema: {
		name: fields.slug({
			name: { label: "제목", validation: { isRequired: true } },
		}),
	},
});
