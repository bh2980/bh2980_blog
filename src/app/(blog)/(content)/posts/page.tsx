import { getPostCategoryList, getPostList } from "@/libs/contents/post";
import { PostList } from "./post-list";

export default async function BlogPage() {
	const categories = await getPostCategoryList();
	const posts = await getPostList();

	return <PostList categories={categories} posts={posts} />;
}
