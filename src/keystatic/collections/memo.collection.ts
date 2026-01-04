import { collection } from "@keystatic/core";
import { fields } from "../fields";

export const memoCollection = collection({
	label: "메모",
	slugField: "title",
	path: "src/contents/memos/*",
	entryLayout: "content",
	format: { contentField: "content" },
	schema: {
		category: fields.relationship({ collection: "memoCategory", label: "카테고리" }),
		title: fields.slug({
			name: { label: "제목", validation: { isRequired: true } },
		}),
		publishedDateTimeISO: fields.datetime({
			label: "발행일",
			defaultValue: { kind: "now" },
			validation: { isRequired: true },
		}),
		tags: fields.array(fields.relationship({ collection: "tag", label: "태그" }), {
			label: "태그",
			itemLabel: (props) => props.value ?? "잘못된 태그",
		}),
		content: fields.mdx({
			label: "내용",
			options: { image: { directory: "public/assets/images/memos", publicPath: "/assets/images/memos" } },
		}),
	},
	previewUrl: `/preview/start?branch={branch}&to=/memos/{slug}`,
});
