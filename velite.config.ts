import { defineConfig, s } from "velite";
import { readdirSync } from "fs";
import { join } from "path";

// 파일명에서 slug를 추출하는 공통 함수
const generateSlugFromFilename = (_: string, context: any) => {
  return (
    (context.meta.path as string).split("/").pop()?.replace(".mdx", "") || ""
  );
};

// 실제 존재하는 post slug들을 가져오는 함수
const getAvailablePostSlugs = (): string[] => {
  try {
    const postsDir = join(process.cwd(), "content/posts");
    const files = readdirSync(postsDir);
    return files
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => file.replace(".mdx", ""));
  } catch (error) {
    // posts 디렉토리가 없거나 빈 경우 빈 배열 반환
    return [];
  }
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
        category: s.enum(["css", "nextjs", "javascript", "typescript", "general"]).default("general"),
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
        postSlugs: s.array(s.string()).refine((slugs) => {
          const availableSlugs = getAvailablePostSlugs();
          const invalidSlugs = slugs.filter(
            (slug) => !availableSlugs.includes(slug)
          );

          if (invalidSlugs.length > 0) {
            throw new Error(
              `존재하지 않는 포스트 slug: ${invalidSlugs.join(
                ", "
              )}\n사용 가능한 slug: ${availableSlugs.join(", ")}`
            );
          }

          return true;
        }),
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
