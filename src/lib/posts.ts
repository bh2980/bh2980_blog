import { posts, type Post } from "@/velite";
import { getPostCategoryLabels, type PostCategory } from "@/lib/categories";

export function getAllPosts(): Post[] {
  return (posts as Post[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getPostsByCategory(category: PostCategory): Post[] {
  return (posts as Post[]).filter((post) => post.category === category);
}

export const categoryLabels = getPostCategoryLabels();

export function getPostBySlug(slug: string): Post | null {
  return (posts as Post[]).find((post) => post.slug === slug) || null;
}

export function getPostsBySlugs(slugs: string[]): Post[] {
  if (!slugs || !Array.isArray(slugs)) {
    return [];
  }

  return slugs
    .map((slug) => getPostBySlug(slug))
    .filter((post): post is Post => post !== null);
}

export function getPreviousPost(slug: string): Post | null {
  const allPosts = getAllPosts();
  const currentIndex = allPosts.findIndex((post) => post.slug === slug);

  if (currentIndex === -1 || currentIndex === 0) {
    return null;
  }

  return allPosts[currentIndex - 1];
}

export function getNextPost(slug: string): Post | null {
  const allPosts = getAllPosts();
  const currentIndex = allPosts.findIndex((post) => post.slug === slug);

  if (currentIndex === -1 || currentIndex === allPosts.length - 1) {
    return null;
  }

  return allPosts[currentIndex + 1];
}
