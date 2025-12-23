import { collection, fields } from "@keystatic/core";
import { slug, markdoc } from "@/root/src/keystatic/fields";

export const postSchema = collection({
  label: "게시글",
  slugField: "title",
  path: "src/contents/posts/*",
  entryLayout: "content",
  format: { contentField: "content" }, // 본문 분리 저장
  schema: {
    title: slug(),
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

    content: markdoc("내용"),
  },
});
