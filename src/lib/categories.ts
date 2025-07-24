import categoriesConfig from "@/config/categories.json";

export type PostCategory = keyof typeof categoriesConfig.posts;
export type MemoCategory = keyof typeof categoriesConfig.memos;

export interface CategoryConfig {
  label: string;
  colors: {
    light: string;
    dark: string;
  };
}

// 포스트 카테고리 관련 함수들
export const getPostCategoryLabels = (): Record<PostCategory, string> => {
  const labels: Record<string, string> = {};
  Object.entries(categoriesConfig.posts).forEach(([key, config]) => {
    labels[key] = config.label;
  });
  return labels as Record<PostCategory, string>;
};

export const getPostCategoryColors = (
  category: PostCategory,
  mode: "light" | "dark" = "light"
): string => {
  return categoriesConfig.posts[category]?.colors[mode] || "";
};

export const getPostCategoryConfig = (
  category: PostCategory
): CategoryConfig => {
  return categoriesConfig.posts[category];
};

// 메모 카테고리 관련 함수들
export const getMemoCategoryLabels = (): Record<MemoCategory, string> => {
  const labels: Record<string, string> = {};
  Object.entries(categoriesConfig.memos).forEach(([key, config]) => {
    labels[key] = config.label;
  });
  return labels as Record<MemoCategory, string>;
};

export const getMemoCategoryColors = (
  category: MemoCategory,
  mode: "light" | "dark" = "light"
): string => {
  return categoriesConfig.memos[category]?.colors[mode] || "";
};

export const getMemoCategoryConfig = (
  category: MemoCategory
): CategoryConfig => {
  return categoriesConfig.memos[category];
};

// 통합 함수들
export const getAllPostCategories = (): PostCategory[] => {
  return Object.keys(categoriesConfig.posts) as PostCategory[];
};

export const getAllMemoCategories = (): MemoCategory[] => {
  return Object.keys(categoriesConfig.memos) as MemoCategory[];
};
