import { collection, fields } from "@keystatic/core";
import { getCategoryTitleSlug } from "../libs/get-category-title-slug";

export const collectionCollection = collection({
	label: "모음집",
	slugField: "name",
	path: "src/contents/collections/**",
	schema: {
		name: fields.slug({
			name: { label: "제목", validation: { isRequired: true } },
			slug: { generate: getCategoryTitleSlug },
		}),
		description: fields.text({ label: "설명", multiline: true }),
		meta: fields.conditional(
			fields.select({
				label: "카테고리",
				defaultValue: "none",
				options: [
					{ label: "선택해주세요", value: "none" },
					{ label: "시리즈", value: "series" },
					{ label: "프로젝트", value: "project" },
					{ label: "Index", value: "index" },
				],
			}),
			{
				none: fields.empty(),
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
				index: fields.object(
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
