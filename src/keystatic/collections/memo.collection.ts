import { collection } from "@keystatic/core";
import { fields } from "../fields";

export const MEMO_CATEGORY_LIST = [
	{ label: "학습 노트", value: "study-notes" },
	{ label: "문제 풀이", value: "problem-solving" },
	{ label: "스니펫", value: "snippets" },
	{ label: "트러블슈팅", value: "troubleshooting" },
] as const;

export type MemoCategory = (typeof MEMO_CATEGORY_LIST)[number];

export const memoCollection = collection({
	label: "메모",
	slugField: "title",
	path: "src/contents/memos/*/",
	entryLayout: "content",
	format: { contentField: "content" },
	schema: {
		category: fields.select({
			label: "카테고리",
			defaultValue: "study-notes",
			options: MEMO_CATEGORY_LIST,
		}),
		title: fields.slug({
			name: { label: "제목", validation: { isRequired: true } },
		}),
		publishedDate: fields.datetime({
			label: "발행일",
			defaultValue: { kind: "now" },
			validation: { isRequired: true },
		}),
		tags: fields.array(fields.relationship({ collection: "tag", label: "태그" }), {
			label: "태그",
			itemLabel: (props) => props.value ?? "태그 선택",
		}),
		content: fields.mdx({
			label: "내용",
			options: { image: { directory: "public/assets/images/memos", publicPath: "/assets/images/memos" } },
		}),
	},
	previewUrl: `/preview/start?branch={branch}&to=/memos/{slug}`,
});
