import { getAllPosts } from "./posts";
import { getAllSeries } from "./series";
import { getAllMemos } from "./memos";

import type { Post, Series, Memo } from "@/content";

export interface SearchResult {
  posts: Post[];
  series: Series[];
  memos: Memo[];
  totalCount: number;
}

export function searchContent(query: string): SearchResult {
  if (!query.trim()) {
    return {
      posts: [],
      series: [],
      memos: [],
      totalCount: 0,
    };
  }

  const searchTerm = query.toLowerCase().trim();

  // 게시글 검색
  const posts = getAllPosts().filter(
    (post) =>
      post.title.toLowerCase().includes(searchTerm) ||
      post.excerpt.toLowerCase().includes(searchTerm) ||
      post.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
  );

  // 시리즈 검색
  const series = getAllSeries().filter(
    (seriesItem) =>
      seriesItem.title.toLowerCase().includes(searchTerm) ||
      seriesItem.description.toLowerCase().includes(searchTerm)
  );

  // 메모 검색
  const memos = getAllMemos().filter(
    (memo) =>
      memo.title.toLowerCase().includes(searchTerm) ||
      memo.excerpt.toLowerCase().includes(searchTerm) ||
      memo.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
  );

  return {
    posts,
    series,
    memos,
    totalCount: posts.length + series.length + memos.length,
  };
}
