import { collection, fields } from "@keystatic/core";
import { slug } from "@/keystatic/fields";

export const projectSchema = collection({
  label: "프로젝트",
  slugField: "title",
  path: "src/contents/project/*",
  schema: {
    title: slug(),
    description: fields.text({ label: "프로젝트 설명", multiline: true }),
  },
});
