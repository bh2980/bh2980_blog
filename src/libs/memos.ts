import { memos, type Memo } from "@/content";

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
