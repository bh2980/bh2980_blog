import { collection } from "@keystatic/core";
import { slug } from "../fields";

export const memoCategorySchema = collection({
  label: "카테고리",
  slugField: "name",
  path: "src/contents/memo-category/*",
  schema: {
    name: slug("카테고리 이름"),
  },
});
