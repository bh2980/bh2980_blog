import type { Metadata } from "next";
import { listCategories } from "@/libs/contents/services/category";
import { listPosts } from "@/libs/contents/services/post";
import { PostList } from "./post-list";

// 공개 목록을 요청 시점에 조회한다(M7-BE-2).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "블로그",
	description: "개발하면서 배운 것들과 경험을 기록합니다.",
	alternates: { canonical: `/posts` },
};

export default async function BlogPage() {
	const [categories, posts] = await Promise.all([listCategories(), listPosts()]);

	const categoriesWithCount = categories.list.map((category) => ({
		...category,
		count: posts.list.filter((post) => post.category.slug === category.slug).length,
	}));

	return <PostList categories={categoriesWithCount} posts={posts} />;
}
