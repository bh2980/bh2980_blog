import { defineConfig, s } from "velite";

export default defineConfig({
  collections: {
    posts: {
      name: "Post",
      pattern: "posts/*.mdx",
      schema: s.object({
        title: s.string(),
        slug: s
          .slug("posts")
          .optional()
          .transform((_, context) => {
            return (context.meta.path as string)
              .split("/")
              .pop()
              ?.replace(".mdx", "");
          }),
        createdAt: s.isodate(),
        tags: s.array(s.string()),
        excerpt: s.excerpt({ length: 80 }),
      }),
    },
    series: {
      name: "Series",
      pattern: "series/*.mdx",
      schema: s.object({
        title: s.string(),
        slug: s
          .slug("series")
          .optional()
          .transform((_, context) => {
            return (context.meta.path as string)
              .split("/")
              .pop()
              ?.replace(".mdx", "");
          }),
        description: s.string(),
        postSlugs: s.array(s.string()),
        createdAt: s.isodate(),
      }),
    },
    memos: {
      name: "Memo",
      pattern: "memos/*.mdx",
      schema: s.object({
        title: s.string(),
        slug: s
          .slug("memos")
          .optional()
          .transform((_, context) => {
            return (context.meta.path as string)
              .split("/")
              .pop()
              ?.replace(".mdx", "");
          }),
        createdAt: s.isodate(),
        category: s.enum(["algorithm", "css-battle", "typescript", "etc"]),
        tags: s.array(s.string()),
        excerpt: s.excerpt({ length: 80 }),
      }),
    },
  },
});
