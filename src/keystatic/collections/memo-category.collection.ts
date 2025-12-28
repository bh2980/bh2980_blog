import { collection } from "@keystatic/core";
import { fields } from "../fields";

export const memoCategoryCollection = collection({
	label: "카테고리",
	slugField: "name",
	path: "src/contents/memo-category/*",
	schema: {
		name: fields.slug({
			name: { label: "카테고리 이름", validation: { isRequired: true } },
		}),
		color: fields.colorPicker({ label: "색상", defaultValue: "#000000" }),
	},
});
