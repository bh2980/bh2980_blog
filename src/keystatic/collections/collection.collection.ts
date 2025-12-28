import { collection, fields } from "@keystatic/core";
import { getSlugWithLabel, mapLabelSlugToValueSlug } from "../libs/slug";

const COLLECTION_OPTIONS_LIST = [
	{ label: "시리즈", value: "series" },
	{ label: "프로젝트", value: "project" },
	{ label: "위키", value: "wiki" },
] as const;

export const collectionCollection = collection({
	label: "모음집",
	slugField: "name",
	path: "src/contents/collections/**",
	schema: {
		name: fields.slug({
			name: { label: "제목", validation: { isRequired: true } },
			slug: {
				generate: (name: string) =>
					mapLabelSlugToValueSlug(getSlugWithLabel("카테고리")(name), COLLECTION_OPTIONS_LIST),
			},
		}),
		description: fields.text({ label: "설명", multiline: true }),
		meta: fields.conditional(
			fields.select({
				label: "카테고리",
				defaultValue: "series",
				options: COLLECTION_OPTIONS_LIST,
			}),
			{
				series: fields.object(
					{
						post: fields.array(fields.relationship({ label: "게시글", collection: "post" }), {
							label: "게시글",
						}),
						memo: fields.array(fields.relationship({ label: "메모", collection: "memo" }), {
							label: "메모",
						}),
					},
					{ label: "컨텐츠" },
				),
				project: fields.object(
					{
						post: fields.array(fields.relationship({ label: "게시글", collection: "post" }), {
							label: "게시글",
						}),
						memo: fields.array(fields.relationship({ label: "메모", collection: "memo" }), {
							label: "메모",
						}),
					},
					{ label: "컨텐츠" },
				),
				wiki: fields.object(
					{
						memo: fields.array(fields.relationship({ label: "메모", collection: "memo" }), {
							label: "메모",
						}),
					},
					{ label: "컨텐츠" },
				),
			},
		),
	},
});
