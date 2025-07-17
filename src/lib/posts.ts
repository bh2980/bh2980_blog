export interface Post {
  id: number;
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
    id: 1,
    slug: "first-post",
    title: "첫 번째 블로그 포스트",
    date: "2024-01-15",
    excerpt:
      "블로그를 시작하면서 작성하는 첫 번째 포스트입니다. 앞으로 개발 관련 내용들을 공유해보겠습니다.",
    content:
      "# 첫 번째 블로그 포스트\n\n안녕하세요! 개발자 블로그를 시작합니다.\n\n## 앞으로의 계획\n\n- React/Next.js 관련 포스트\n- 개발 경험 공유\n- 문제 해결 과정 기록",
    tags: ["블로그", "시작", "개발일기"],
  },
  {
    id: 2,
    slug: "nextjs-tutorial",
    title: "Next.js 시작하기",
    date: "2024-01-10",
    excerpt:
      "Next.js의 기본 개념과 설치 방법에 대해 알아보겠습니다. App Router를 중심으로 설명합니다.",
    content:
      "# Next.js 시작하기\n\nNext.js는 React 기반의 풀스택 프레임워크입니다.\n\n## 주요 특징\n\n- Server-side Rendering\n- Static Site Generation\n- App Router\n- API Routes",
    tags: ["Next.js", "React", "프레임워크", "튜토리얼"],
  },
  {
    id: 3,
    slug: "tailwind-css-tips",
    title: "Tailwind CSS 유용한 팁들",
    date: "2024-01-05",
    excerpt:
      "Tailwind CSS를 사용하면서 알게 된 유용한 팁들을 정리해보았습니다.",
    content:
      "# Tailwind CSS 유용한 팁들\n\nTailwind CSS 사용 시 도움이 되는 팁들을 소개합니다.\n\n## 반응형 디자인\n\n- `sm:`, `md:`, `lg:` 접두사 활용\n- 모바일 퍼스트 접근법",
    tags: ["CSS", "Tailwind", "스타일링", "팁"],
  },
  {
    id: 4,
    slug: "css-grid-guide",
    title: "CSS Grid 완벽 가이드",
    date: "2024-01-22",
    excerpt:
      "CSS Grid의 기본 개념부터 고급 레이아웃까지 완벽하게 마스터하는 방법을 알아보겠습니다.",
    content:
      "# CSS Grid 완벽 가이드\n\nCSS Grid는 2차원 레이아웃을 위한 강력한 도구입니다.\n\n## 기본 개념\n\n- grid-container와 grid-item\n- grid-template-columns, grid-template-rows\n- gap 속성 활용",
    tags: ["CSS", "Grid", "레이아웃"],
  },
  {
    id: 5,
    slug: "css-flexbox-mastery",
    title: "Flexbox로 마스터하는 CSS 레이아웃",
    date: "2024-01-20",
    excerpt:
      "Flexbox의 모든 속성을 이해하고 실무에서 활용할 수 있는 레이아웃 기법들을 정리했습니다.",
    content:
      "# Flexbox로 마스터하는 CSS 레이아웃\n\nFlexbox는 1차원 레이아웃의 최고의 선택입니다.\n\n## 주요 속성\n\n- justify-content: 주축 정렬\n- align-items: 교차축 정렬\n- flex-grow, flex-shrink, flex-basis",
    tags: ["CSS", "Flexbox", "레이아웃", "정렬"],
  },
  {
    id: 6,
    slug: "css-animations-guide",
    title: "CSS 애니메이션과 트랜지션 활용법",
    date: "2024-01-18",
    excerpt:
      "CSS만으로 만드는 부드럽고 인상적인 애니메이션 효과들을 살펴보고 실무에 적용하는 방법을 알아봅니다.",
    content:
      "# CSS 애니메이션과 트랜지션 활용법\n\n부드러운 사용자 경험을 위한 CSS 애니메이션을 알아봅시다.\n\n## 기본 개념\n\n- transition: 상태 변화 애니메이션\n- animation: 키프레임 기반 애니메이션\n- transform: 변형 효과",
    tags: ["CSS", "애니메이션", "트랜지션", "UX"],
  },
  {
    id: 7,
    slug: "css-variables-tips",
    title: "CSS 변수로 효율적인 스타일 관리하기",
    date: "2024-01-16",
    excerpt:
      "CSS 커스텀 속성(변수)을 활용해서 유지보수하기 쉽고 일관성 있는 스타일시트를 작성하는 방법입니다.",
    content:
      "# CSS 변수로 효율적인 스타일 관리하기\n\nCSS 변수는 코드 재사용성과 유지보수성을 크게 향상시킵니다.\n\n## 활용 방법\n\n- :root에서 전역 변수 정의\n- 컴포넌트별 지역 변수\n- JavaScript와의 연동",
    tags: ["CSS", "변수", "유지보수", "효율성"],
  },
];

export function getAllPosts(): Post[] {
  return mockPosts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | null {
  return mockPosts.find((post) => post.slug === slug) || null;
}

export function getPostById(id: number): Post | null {
  return mockPosts.find((post) => post.id === id) || null;
}

export function getPostsByIds(ids: number[]): Post[] {
  return ids
    .map((id) => getPostById(id))
    .filter((post) => post !== null) as Post[];
}
