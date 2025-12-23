import { collection, fields } from "@keystatic/core";
import { slug } from "@/keystatic/fields";

export const seriesSchema = collection({
  label: "시리즈",
  slugField: "title",
  path: "src/content/series/*",
  schema: {
    title: slug(),
    description: fields.text({ label: "시리즈 설명", multiline: true }),
  },
});
