import {
  postSchema,
  postCategorySchema,
  tagSchema,
  seriesSchema,
  memoSchema,
  memoCategorySchema,
  projectSchema,
} from "@/root/src/keystatic/schemas";
import { type Config, config } from "@keystatic/core";

const storage: Config["storage"] =
  process.env.NODE_ENV === "development"
    ? { kind: "local" }
    : { kind: "github", repo: { owner: "bh2980", name: "bh2980_blog" } };

export default config({
  storage,
  collections: {
    //공통
    tag: tagSchema,
    //게시글
    postCategory: postCategorySchema,
    post: postSchema,
    series: seriesSchema,
    project: projectSchema,
    //메모
    memoCategory: memoCategorySchema,
    memo: memoSchema,
  },
  ui: {
    navigation: {
      게시글: ["postCategory", "post", "series", "project", "tag"],
      메모: ["memoCategory", "memo", "tag"],
    },
  },
});
