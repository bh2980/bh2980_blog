import { collection } from "@keystatic/core";
import { fields } from "../fields";

export const seriesSchema = collection({
	label: "시리즈",
	slugField: "title",
	path: "src/contents/series/*",
	schema: {
		title: fields.slug({
			name: { label: "이름", validation: { isRequired: true } },
		}),
		description: fields.text({ label: "시리즈 설명", multiline: true }),
	},
});
