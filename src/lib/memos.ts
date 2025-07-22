// @ts-ignore - velite 생성 파일
import { memos } from "@/velite";

export interface Memo {
  slug: string;
  title: string;
  createdAt: string;
  category: "algorithm" | "css-battle" | "typescript" | "etc";
  tags: string[];
  excerpt: string;
}

export function getAllMemos(): Memo[] {
  return (memos as Memo[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getMemoBySlug(slug: string): Memo | null {
  return (memos as Memo[]).find((memo) => memo.slug === slug) || null;
}

export function getMemosByCategory(category: Memo["category"]): Memo[] {
  return (memos as Memo[]).filter((memo) => memo.category === category);
}

export const categoryLabels = {
  algorithm: "알고리즘",
  "css-battle": "CSS Battle",
  typescript: "TypeScript",
  etc: "기타",
} as const;
