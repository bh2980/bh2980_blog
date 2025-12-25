import { collection } from "@keystatic/core";
import { fields } from "../fields";

export const postCategorySchema = collection({
  label: "카테고리",
  slugField: "name",
  path: "src/contents/post-category/*",
  schema: {
    name: fields.slug({ name: { label: "카테고리 이름" } }),
  },
});
