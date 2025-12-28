import { collection } from "@keystatic/core";
import { fields } from "../fields";

export const postCategoryCollection = collection({
	label: "카테고리",
	slugField: "name",
	path: "src/contents/post-category/*",
	schema: {
		name: fields.slug({
			name: { label: "카테고리 이름", validation: { isRequired: true } },
		}),
		description: fields.text({ label: "설명" }),
		color: fields.colorPicker({ label: "색상", defaultValue: "#000000" }),
	},
});
