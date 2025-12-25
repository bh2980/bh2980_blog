import { collection } from "@keystatic/core";
import { fields } from "../fields";

export const projectSchema = collection({
	label: "프로젝트",
	slugField: "title",
	path: "src/contents/project/*",
	schema: {
		title: fields.slug({
			name: { label: "이름", validation: { isRequired: true } },
		}),
		description: fields.text({ label: "프로젝트 설명", multiline: true }),
	},
});
