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
        id: s.number(),
        createdAt: s.isodate(),
        tags: s.array(s.string()),
        excerpt: s.excerpt({ length: 80 }),
      }),
    },
    series: {
      name: "Series",
      pattern: "series/*.mdx",
      schema: s.object({
        id: s.number(),
        title: s.string(),
        slug: s.slug("series"),
        description: s.string(),
        postIds: s.array(s.number()),
        createdAt: s.isodate(),
      }),
    },
  },
});
