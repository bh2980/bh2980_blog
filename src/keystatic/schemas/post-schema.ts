import { collection } from "@keystatic/core";
import { fields } from "../fields";

export const postSchema = collection({
  label: "게시글",
  slugField: "title",
  path: "src/contents/posts/*",
  entryLayout: "content",
  format: { contentField: "content" }, // 본문 분리 저장
  schema: {
    title: fields.slug({ name: { label: "제목" } }),
    publishedDate: fields.datetime({ label: "발행일", defaultValue: { kind: "now" } }),

    category: fields.relationship({
      collection: "post-category",
      label: "카테고리",
    }),

    project: fields.relationship({
      collection: "project",
      label: "프로젝트 (선택)",
    }),

    series: fields.relationship({
      collection: "series",
      label: "시리즈 (선택)",
    }),

    tags: fields.array(fields.relationship({ collection: "tag", label: "태그" }), {
      label: "태그",
      itemLabel: (props) => props.value ?? "태그 선택",
    }),

    content: fields.markdoc({ label: "내용" }),
  },
});
