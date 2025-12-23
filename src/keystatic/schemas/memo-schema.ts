import { collection, fields } from "@keystatic/core";
import { slug, markdoc } from "@/root/src/keystatic/fields";

export const memoSchema = collection({
  label: "메모",
  slugField: "title",
  path: "src/contents/memos/*",
  entryLayout: "content",
  format: { contentField: "content" }, // 본문 분리 저장
  schema: {
    title: slug(),
    publishedDate: fields.datetime({ label: "발행일", defaultValue: { kind: "now" } }),

    category: fields.relationship({
      collection: "memo-category",
      label: "카테고리",
    }),

    tags: fields.array(fields.relationship({ collection: "tag", label: "태그" }), {
      label: "태그",
      itemLabel: (props) => props.value ?? "태그 선택",
    }),

    content: markdoc("내용"),
  },
});
