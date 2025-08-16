import { readdirSync } from "fs";
import { join } from "path";
import { ZodMeta } from "velite";
import { POST_CATEGORIES, MEMO_CATEGORIES } from "../content/categories";

interface VeliteContext {
  meta: ZodMeta;
}

/**
 * 파일명에서 slug를 추출하는 공통 함수
 * @param _ - Velite transform 함수에서 전달된 값 (사용되지 않음).
 * @param context - VeliteContext 객체로, 파일 메타데이터를 포함합니다.
 * @returns 파일명에서 추출된 slug 문자열을 반환합니다. (예: `"my-post-title"`)
 */
export const generateSlugFromFilename = (_: string, context: VeliteContext) => {
  return (context.meta.path as string).split("/").pop()?.replace(".mdx", "") || "";
};

/**
 * 한국 시간 ISO string을 return하는 함수
 * @returns string
 * @example `2023-09-17T19:51:00.000Z`
 */
export const getKoreaISOTimeText = () => new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString();

/**
 * content 파일 경로를 content 폴더부터 배열로 return 하는 함수
 * @param _ - Velite transform 함수에서 전달된 값 (사용되지 않음).
 * @param context - VeliteContext 객체로, 파일 메타데이터를 포함합니다.
 * @returns 파일 경로의 각 부분을 문자열 배열로 반환합니다. (예: `["content", "posts", "my-post"]`)
 */
export const getContentFilePathArray = (_: string[], context: VeliteContext) => {
  if (Array.isArray(context.meta.history) && context.meta.history.length > 0) {
    return (context.meta?.history[0] as string).replace(/^.*?\/content\//, "content/").split("/");
  }

  return [];
};

/**
 * 실제 존재하는 게시글(post) slug 목록을 가져오는 함수입니다.
 * 파일 시스템을 직접 읽어 `.mdx` 확장자를 가진 파일들의 이름을 기반으로 slug를 생성합니다.
 * @returns {string[]} 현재 프로젝트의 `content/posts` 디렉토리에 존재하는 게시글 slug 문자열 배열을 반환합니다.
 * @throws {Error} `content/posts` 디렉토리를 읽을 수 없는 경우 빈 배열을 반환합니다.
 */
export const getAvailablePostSlugs = (): string[] => {
  try {
    const postsDir = join(process.cwd(), "content/posts");
    const files = readdirSync(postsDir);
    return files.filter((file) => file.endsWith(".mdx")).map((file) => file.replace(".mdx", ""));
  } catch (error) {
    // posts 디렉토리가 없거나 빈 경우 빈 배열 반환
    return [];
  }
};

/**
 * `content/categories.ts` 파일에서 카테고리 목록을 가져오는 함수.
 * @returns {object} 카테고리 설정 객체.
 * @throws {Error} `categories.ts` 파일을 읽을 수 없는 경우.
 */
export const getCategoriesConfig = () => {
  // categories.ts에서 직접 상수를 가져와 사용합니다.
  return {
    POST_CATEGORIES,
    MEMO_CATEGORIES,
  };
};

/**
 * 제공된 slug 목록의 유효성을 검사하여, 실제 존재하는 게시글 slug만 포함하는지 확인합니다.
 * @param {string[]} slugs - 유효성을 검사할 게시글 slug 문자열 배열.
 * @returns {boolean} 모든 slug가 유효하면 `true`를 반환합니다.
 * @throws {Error} 유효하지 않은 slug가 발견되면 에러를 발생시킵니다.
 */
export const validatePostSlugs = (slugs: string[]): boolean => {
  const availableSlugs = getAvailablePostSlugs();
  const invalidSlugs = slugs.filter((slug) => !availableSlugs.includes(slug));

  if (invalidSlugs.length > 0) {
    throw new Error(
      `존재하지 않는 게시글 slug: ${invalidSlugs.join(", ")}\n사용 가능한 slug: ${availableSlugs.join(", ")}`
    );
  }

  return true;
};
