// @ts-ignore - velite 생성 파일
import { series } from "@/velite";

export interface Series {
  id: number;
  title: string;
  slug: string;
  description: string;
  postIds: number[];
  createdAt: string;
}

export function getAllSeries(): Series[] {
  return (series as Series[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getSeriesById(id: number): Series | null {
  return (series as Series[]).find((s) => s.id === id) || null;
}

export function getSeriesByPostId(postId: number): Series | null {
  return (series as Series[]).find((s) => s.postIds.includes(postId)) || null;
}
