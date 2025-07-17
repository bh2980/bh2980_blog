export interface Series {
  id: string;
  title: string;
  description: string;
  postSlugs: string[]; // 해당 묶음글에 포함된 포스트들의 slug 배열
  createdDate: string;
  thumbnail?: string;
}

// 임시 목업 데이터 (나중에 velite로 교체)
const mockSeries: Series[] = [
  {
    id: "nextjs-complete-guide",
    title: "Next.js 완벽 가이드",
    description:
      "Next.js를 처음 시작하는 개발자부터 고급 기능까지 다루는 완벽한 묶음글입니다. App Router, Server Components, 성능 최적화까지 모든 것을 다룹니다.",
    postSlugs: ["nextjs-tutorial"], // 현재는 하나의 포스트만 포함
    createdDate: "2024-01-10",
  },
  {
    id: "css-mastery",
    title: "CSS 마스터하기",
    description:
      "CSS의 기초부터 고급 기법까지, 실무에서 바로 사용할 수 있는 CSS 스킬을 단계별로 학습하는 묶음글입니다.",
    postSlugs: ["tailwind-css-tips"], // 현재는 하나의 포스트만 포함
    createdDate: "2024-01-05",
  },
  {
    id: "developer-journey",
    title: "개발자의 여정",
    description:
      "개발자로서의 성장 과정과 경험을 공유하는 묶음글입니다. 개발 일기부터 커리어 조언까지 다양한 이야기를 담고 있습니다.",
    postSlugs: ["first-post"], // 현재는 하나의 포스트만 포함
    createdDate: "2024-01-15",
  },
];

export function getAllSeries(): Series[] {
  return mockSeries.sort((a, b) => (a.createdDate < b.createdDate ? 1 : -1));
}

export function getSeriesById(id: string): Series | null {
  return mockSeries.find((series) => series.id === id) || null;
}

export function getSeriesByPostSlug(postSlug: string): Series | null {
  return (
    mockSeries.find((series) => series.postSlugs.includes(postSlug)) || null
  );
}
