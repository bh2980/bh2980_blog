import { collection, fields } from "@keystatic/core";
import { slug, markdoc } from "@/root/src/keystatic/fields";

export const postSchema = collection({
  label: "Posts",
  slugField: "title",
  path: "src/content/posts/*",
  format: { contentField: "content" }, // 본문 분리 저장
  schema: {
    title: slug("제목", "슬러그"),
    publishedDate: fields.datetime({ label: "발행일", defaultValue: { kind: "now" } }),

    // // 1단계에서 정의한 관계들 추가
    // category: fields.relationship({
    //   collection: "postCategories",
    //   label: "카테고리",
    // }),
    // tags: fields.array(fields.relationship({ collection: "tags", label: "태그" }), {
    //   label: "태그",
    //   itemLabel: (props) => props.value ?? "태그 선택",
    // }),
    // series: fields.relationship({
    //   collection: "series",
    //   label: "시리즈 (선택)",
    // }),

    content: markdoc("내용"),
  },
});
