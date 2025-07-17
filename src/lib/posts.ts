export interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  tags: string[];
}

// 임시 목업 데이터 (나중에 velite로 교체)
const mockPosts: Post[] = [
  {
    slug: "first-post",
    title: "첫 번째 블로그 포스트",
    date: "2024-01-15",
    excerpt: "블로그를 시작하면서 작성하는 첫 번째 포스트입니다. 앞으로 개발 관련 내용들을 공유해보겠습니다.",
    content: "# 첫 번째 블로그 포스트\n\n안녕하세요! 개발자 블로그를 시작합니다.\n\n## 앞으로의 계획\n\n- React/Next.js 관련 포스트\n- 개발 경험 공유\n- 문제 해결 과정 기록",
    tags: ["블로그", "시작", "개발일기"]
  },
  {
    slug: "nextjs-tutorial",
    title: "Next.js 시작하기",
    date: "2024-01-10",
    excerpt: "Next.js의 기본 개념과 설치 방법에 대해 알아보겠습니다. App Router를 중심으로 설명합니다.",
    content: "# Next.js 시작하기\n\nNext.js는 React 기반의 풀스택 프레임워크입니다.\n\n## 주요 특징\n\n- Server-side Rendering\n- Static Site Generation\n- App Router\n- API Routes",
    tags: ["Next.js", "React", "프레임워크", "튜토리얼"]
  },
  {
    slug: "tailwind-css-tips",
    title: "Tailwind CSS 유용한 팁들",
    date: "2024-01-05",
    excerpt: "Tailwind CSS를 사용하면서 알게 된 유용한 팁들을 정리해보았습니다.",
    content: "# Tailwind CSS 유용한 팁들\n\nTailwind CSS 사용 시 도움이 되는 팁들을 소개합니다.\n\n## 반응형 디자인\n\n- `sm:`, `md:`, `lg:` 접두사 활용\n- 모바일 퍼스트 접근법",
    tags: ["CSS", "Tailwind", "스타일링", "팁"]
  }
];

export function getAllPosts(): Post[] {
  return mockPosts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | null {
  return mockPosts.find(post => post.slug === slug) || null;
}
