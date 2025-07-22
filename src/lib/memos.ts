export interface Memo {
  slug: string;
  title: string;
  date: string;
  category: "algorithm" | "css-battle" | "typescript" | "etc";
  tags: string[];
  excerpt: string;
  content: string;
}

// 임시 목업 데이터 (나중에 Notion API로 교체 예정)
const mockMemos: Memo[] = [
  {
    slug: "two-sum-solution",
    title: "Two Sum 문제 풀이",
    date: "2024-01-20",
    category: "algorithm",
    tags: ["leetcode", "hash-map", "array"],
    excerpt:
      "LeetCode Two Sum 문제를 HashMap을 사용해서 O(n) 시간복잡도로 해결하는 방법",
    content: `# Two Sum 문제 풀이

## 문제
정수 배열에서 두 수를 더해서 target이 되는 인덱스를 찾는 문제

## 해결 방법
\`\`\`typescript
function twoSum(nums: number[], target: number): number[] {
    const map = new Map<number, number>();
    
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement)!, i];
        }
        map.set(nums[i], i);
    }
    
    return [];
}
\`\`\`

## 시간복잡도
- O(n): 배열을 한 번만 순회
- 공간복잡도: O(n): HashMap 사용`,
  },
  {
    slug: "css-battle-01",
    title: "CSS Battle #1 - Simply Square",
    date: "2024-01-18",
    category: "css-battle",
    tags: ["css", "challenge"],
    excerpt:
      "CSS Battle 첫 번째 문제 Simply Square 풀이. 가장 짧은 코드로 해결하기",
    content: `# CSS Battle #1 - Simply Square

## 문제
200x200 오렌지색 정사각형을 화면 중앙에 배치

## 내 풀이 (60 characters)
\`\`\`html
<div></div>
<style>
div{
  width:200px;
  height:200px;
  background:#b5e0ba;
  margin:50px 100px
}
</style>
\`\`\`

## 더 짧은 풀이 (45 characters)
\`\`\`html
<style>*{margin:50px 100px;background:#b5e0ba;width:200px;height:200px}</style>
\`\`\`

## 배운 점
- margin을 사용한 중앙 정렬
- CSS 단축 속성 활용`,
  },
  {
    slug: "typescript-utility-types",
    title: "TypeScript Utility Types 정리",
    date: "2024-01-15",
    category: "typescript",
    tags: ["typescript", "utility-types"],
    excerpt:
      "자주 사용하는 TypeScript Utility Types들 정리 - Pick, Omit, Partial 등",
    content: `# TypeScript Utility Types 정리

## Pick<T, K>
특정 속성만 선택
\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

type UserProfile = Pick<User, 'name' | 'email'>;
// { name: string; email: string; }
\`\`\`

## Omit<T, K>
특정 속성 제외
\`\`\`typescript
type CreateUser = Omit<User, 'id'>;
// { name: string; email: string; age: number; }
\`\`\`

## Partial<T>
모든 속성을 optional로
\`\`\`typescript
type UpdateUser = Partial<User>;
// { id?: number; name?: string; email?: string; age?: number; }
\`\`\``,
  },
  {
    slug: "css-battle-02",
    title: "CSS Battle #2 - Carrom",
    date: "2024-01-25",
    category: "css-battle",
    tags: ["css", "challenge", "circle"],
    excerpt: "CSS Battle 두 번째 문제 Carrom 풀이. 원형 요소들의 배치 최적화",
    content: `# CSS Battle #2 - Carrom

## 문제
4개의 원형 요소를 사각형 모서리에 배치

## 내 풀이
\`\`\`html
<div class="container">
  <div class="circle"></div>
  <div class="circle"></div>
  <div class="circle"></div>
  <div class="circle"></div>
</div>
\`\`\`

## 핵심 CSS
- border-radius: 50% (원형)
- position: absolute (정확한 위치)
- 계산된 좌표값 활용`,
  },
  {
    slug: "css-centering-techniques",
    title: "CSS 중앙 정렬 모든 방법",
    date: "2024-01-23",
    category: "etc",
    tags: ["css", "centering", "layout"],
    excerpt:
      "CSS로 요소를 중앙에 정렬하는 다양한 방법들 정리 - Flexbox, Grid, 전통적 방법까지",
    content: `# CSS 중앙 정렬 모든 방법

## 1. Flexbox 방법
\`\`\`css
.container {
  display: flex;
  justify-content: center;
  align-items: center;
}
\`\`\`

## 2. CSS Grid 방법
\`\`\`css
.container {
  display: grid;
  place-items: center;
}
\`\`\`

## 3. 전통적 방법
\`\`\`css
.container {
  position: relative;
}
.child {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
\`\`\``,
  },
  {
    slug: "css-battle-03",
    title: "CSS Battle #3 - Push Button",
    date: "2024-01-21",
    category: "css-battle",
    tags: ["css", "challenge", "button"],
    excerpt:
      "CSS Battle 세 번째 문제 Push Button 풀이. 그라데이션과 그림자 효과",
    content: `# CSS Battle #3 - Push Button

## 문제
입체적인 버튼 효과 만들기

## 핵심 기법
- linear-gradient로 그라데이션
- box-shadow로 입체감
- border-radius로 둥근 모서리

## 최적화 팁
- 단일 div로 해결
- 최소한의 CSS 속성 사용`,
  },
  {
    slug: "css-pseudo-elements",
    title: "CSS 가상 요소 활용법",
    date: "2024-01-19",
    category: "etc",
    tags: ["css", "pseudo-elements", "before", "after"],
    excerpt: "::before와 ::after 가상 요소를 활용한 창의적인 CSS 기법들",
    content: `# CSS 가상 요소 활용법

## 기본 문법
\`\`\`css
.element::before {
  content: "";
  display: block;
  /* 스타일 */
}
\`\`\`

## 활용 예시
1. 아이콘 추가
2. 장식 요소 생성
3. 레이아웃 보조
4. 호버 효과

## 주의사항
- content 속성 필수
- display 속성 설정 권장`,
  },
  {
    slug: "css-battle-04",
    title: "CSS Battle #4 - Ups n Downs",
    date: "2024-01-17",
    category: "css-battle",
    tags: ["css", "challenge", "zigzag"],
    excerpt:
      "CSS Battle 네 번째 문제 지그재그 패턴 만들기. 복잡한 모양을 간단하게",
    content: `# CSS Battle #4 - Ups n Downs

## 문제 분석
지그재그 패턴의 요소들 배치

## 해결 전략
1. 기본 도형들의 조합
2. transform rotate 활용
3. 정확한 positioning

## 코드 최적화
- 불필요한 HTML 제거
- CSS 단축 속성 활용
- 공백 최소화`,
  },
];

export function getAllMemos(): Memo[] {
  return mockMemos.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getMemoBySlug(slug: string): Memo | null {
  return mockMemos.find((memo) => memo.slug === slug) || null;
}

export function getMemosByCategory(category: Memo["category"]): Memo[] {
  return mockMemos.filter((memo) => memo.category === category);
}

export const categoryLabels = {
  algorithm: "알고리즘",
  "css-battle": "CSS Battle",
  typescript: "TypeScript",
  etc: "기타",
} as const;
