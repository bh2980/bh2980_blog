import { defineConfig, s } from "velite";
import { postSchema, seriesSchema, memoSchema } from "./velite/schemas";

export default defineConfig({
  output: {
    data: "content",
  },
  collections: {
    posts: {
      name: "Post",
      pattern: "posts/*.mdx",
      schema: postSchema,
    },
    series: {
      name: "Series",
      pattern: "series/*.mdx",
      schema: seriesSchema,
    },
    memos: {
      name: "Memo",
      pattern: "memos/*.mdx",
      schema: memoSchema,
    },
  },
});
