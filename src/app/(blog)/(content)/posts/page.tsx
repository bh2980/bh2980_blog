import type { Metadata } from "next";
import { getCategoryList } from "@/libs/contents/category";
import { getPostList } from "@/libs/contents/post";
import { PostList } from "./post-list";

export const metadata: Metadata = {
	title: "블로그",
	description: "개발하면서 배운 것들과 경험을 기록합니다.",
	alternates: { canonical: `/posts` },
	openGraph: {
		title: "블로그",
		description: "개발하면서 배운 것들과 경험을 기록합니다.",
	},
};

export default async function BlogPage() {
	const categories = await getCategoryList();
	const posts = await getPostList();

	return <PostList categories={categories} posts={posts} />;
}
