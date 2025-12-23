import { collection } from "@keystatic/core";
import { slug } from "@/keystatic/fields";

export const tagSchema = collection({
  label: "태그",
  slugField: "name",
  path: "src/content/tags/*",
  schema: {
    name: slug(),
  },
});
