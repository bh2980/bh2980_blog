import { getPostCategoryList } from "@/libs/contents/category";
import { getPostList } from "@/libs/contents/post";
import { PostList } from "../post-list";

export default async function BlogCategoryPage({ params }: { params: Promise<{ category: string }> }) {
	const currentCategory = (await params).category;
	const categoryList = await getPostCategoryList();
	const postList = await getPostList({ category: currentCategory });

	return <PostList currentCategory={currentCategory} categoryList={categoryList} postList={postList} />;
}
