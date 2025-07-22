import { defineConfig, s } from "velite";

// 파일명에서 slug를 추출하는 공통 함수
const generateSlugFromFilename = (_: string, context: any) => {
  return (
    (context.meta.path as string).split("/").pop()?.replace(".mdx", "") || ""
  );
};

export default defineConfig({
  collections: {
    posts: {
      name: "Post",
      pattern: "posts/*.mdx",
      schema: s.object({
        title: s.string(),
        slug: s.string().default("").transform(generateSlugFromFilename),
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
        slug: s.string().default("").transform(generateSlugFromFilename),
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
        slug: s.string().default("").transform(generateSlugFromFilename),
        createdAt: s.isodate(),
        category: s.enum(["algorithm", "css-battle", "typescript", "etc"]),
        tags: s.array(s.string()),
        excerpt: s.excerpt({ length: 80 }),
      }),
    },
  },
});
