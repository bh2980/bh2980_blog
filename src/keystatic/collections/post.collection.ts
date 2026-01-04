import { collection } from "@keystatic/core";
import { fields } from "../fields";

export const postCollection = collection({
	label: "게시글",
	slugField: "title",
	path: "src/contents/posts/*",
	entryLayout: "content",
	format: { contentField: "content" },
	schema: {
		status: fields.select({
			label: "상태",
			defaultValue: "draft",
			options: [
				{ label: "임시저장", value: "draft" },
				{ label: "발행", value: "published" },
			],
		}),

		category: fields.relationship({ collection: "postCategory", label: "카테고리" }),
		title: fields.slug({
			name: { label: "제목", validation: { isRequired: true } },
		}),
		excerpt: fields.text({ label: "요약", description: "입력하지 않을 경우 자동 생성" }),
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
			options: { image: { directory: "public/assets/images/posts", publicPath: "/assets/images/posts" } },
		}),
		policy: fields.conditional(
			fields.select({
				label: "정책",
				defaultValue: "normal",
				options: [
					{ label: "일반", value: "normal" },
					{ label: "항상 최신 글", value: "evergreen" },
					{ label: "지원 중단", value: "deprecated" },
				],
			}),
			{
				normal: fields.empty(),
				evergreen: fields.empty(),
				deprecated: fields.object({ replacementPost: fields.relationship({ label: "최신 글", collection: "post" }) }),
			},
		),
	},
	previewUrl: `/preview/start?branch={branch}&to=/posts/{slug}`,
});
