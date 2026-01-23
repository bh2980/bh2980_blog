import type { Metadata } from "next";
import { getPostCategoryList, getPostList } from "@/libs/contents/post";
import { PostList } from "./post-list";

export const metadata: Metadata = {
	title: "블로그",
	description: "개발하면서 배운 것들과 경험을 기록합니다.",
	alternates: { canonical: `${process.env.HOST_URL}/posts` },
};

export default async function BlogPage() {
	const categories = await getPostCategoryList();
	const posts = await getPostList();

	return <PostList categories={categories} posts={posts} />;
}
