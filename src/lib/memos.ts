export interface Memo {
  id: number;
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
    id: 1,
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
    id: 2,
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
    id: 3,
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
];

export function getAllMemos(): Memo[] {
  return mockMemos.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getMemoBySlug(slug: string): Memo | null {
  return mockMemos.find((memo) => memo.slug === slug) || null;
}

export function getMemoById(id: number): Memo | null {
  return mockMemos.find((memo) => memo.id === id) || null;
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
