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

// 시리즈 내에서 특정 게시글의 이전 게시글 찾기
export function getPreviousPostInSeries(
  postSlug: string,
  seriesSlug: string
): string | null {
  const targetSeries = getSeriesBySlug(seriesSlug);
  if (!targetSeries) return null;

  const currentIndex = targetSeries.postSlugs.indexOf(postSlug);
  if (currentIndex <= 0) return null;

  return targetSeries.postSlugs[currentIndex - 1];
}

// 시리즈 내에서 특정 게시글의 다음 게시글 찾기
export function getNextPostInSeries(
  postSlug: string,
  seriesSlug: string
): string | null {
  const targetSeries = getSeriesBySlug(seriesSlug);
  if (!targetSeries) return null;

  const currentIndex = targetSeries.postSlugs.indexOf(postSlug);
  if (currentIndex === -1 || currentIndex === targetSeries.postSlugs.length - 1)
    return null;

  return targetSeries.postSlugs[currentIndex + 1];
}
