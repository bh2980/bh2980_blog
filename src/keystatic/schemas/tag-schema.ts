import { collection } from "@keystatic/core";
import { fields } from "../fields";

export const tagSchema = collection({
	label: "태그",
	slugField: "name",
	path: "src/contents/tags/*",
	schema: {
		name: fields.slug({
			name: { label: "태그명", validation: { isRequired: true } },
		}),
	},
});
