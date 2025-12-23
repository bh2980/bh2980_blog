import { postSchema } from "@/root/src/keystatic/schemas";
import { config } from "@keystatic/core";

export default config({
  storage: {
    kind: "github",
    repo: {
      owner: "bh2980",
      name: "bh2980_blog",
    },
  },
  collections: {
    posts: postSchema,
  },
});
