// @ts-ignore - velite 생성 파일
import { posts } from "@/velite";

export interface Post {
  id: number;
  slug: string;
  title: string;
  createdAt: string;
  excerpt: string;
  tags: string[];
}

export function getAllPosts(): Post[] {
  return (posts as Post[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getPostBySlug(slug: string): Post | null {
  return (posts as Post[]).find((post) => post.slug === slug) || null;
}

export function getPostById(id: number): Post | null {
  return (posts as Post[]).find((post) => post.id === id) || null;
}

export function getPostsByIds(ids: number[]): Post[] {
  return ids
    .map((id) => getPostById(id))
    .filter((post) => post !== null) as Post[];
}
