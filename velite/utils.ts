import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// 파일명에서 slug를 추출하는 공통 함수
export const generateSlugFromFilename = (_: string, context: any) => {
  return (
    (context.meta.path as string).split("/").pop()?.replace(".mdx", "") || ""
  );
};

// 실제 존재하는 post slug들을 가져오는 함수
export const getAvailablePostSlugs = (): string[] => {
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

// categories.json에서 카테고리 목록을 가져오는 함수들
export const getCategoriesConfig = () => {
  try {
    const categoriesPath = join(process.cwd(), "src/config/categories.json");
    const categoriesContent = readFileSync(categoriesPath, "utf8");
    return JSON.parse(categoriesContent);
  } catch (error) {
    throw new Error(`categories.json 파일을 읽을 수 없습니다: ${error}`);
  }
};

// 유효성 검증 함수들
export const validatePostSlugs = (slugs: string[]): boolean => {
  const availableSlugs = getAvailablePostSlugs();
  const invalidSlugs = slugs.filter((slug) => !availableSlugs.includes(slug));

  if (invalidSlugs.length > 0) {
    throw new Error(
      `존재하지 않는 게시글 slug: ${invalidSlugs.join(
        ", "
      )}\n사용 가능한 slug: ${availableSlugs.join(", ")}`
    );
  }

  return true;
};
