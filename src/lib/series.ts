// @ts-ignore - velite 생성 파일
import { series, type Series } from "@/velite";

export function getAllSeries(): Series[] {
  return (series as Series[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getSeriesBySlug(slug: string): Series | null {
  return (series as Series[]).find((s) => s.slug === slug) || null;
}

export function getSeriesByPostSlug(postSlug: string): Series | null {
  return (
    (series as Series[]).find((s) => s.postSlugs.includes(postSlug)) || null
  );
}
