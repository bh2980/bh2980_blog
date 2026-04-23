import { collection, fields } from "@keystatic/core";

export const collectionCollection = collection({
	label: "모음집",
	slugField: "name",
	path: "src/contents/collections/*",
	schema: {
		name: fields.slug({
			name: { label: "제목", validation: { isRequired: true } },
		}),
		description: fields.text({ label: "설명", multiline: true }),
		items: fields.multiRelationship({ collection: "post", label: "게시글" }),
	},
});
