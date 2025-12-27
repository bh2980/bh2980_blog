import { getPostCategoryList } from "@/libs/contents/category";
import { getPostList } from "@/libs/contents/post";
import { PostList } from "../post-list";

export default async function BlogCategoryPage({ params }: { params: { category: string } }) {
	const currentCategory = params.category;
	const categoryList = await getPostCategoryList();
	const postList = await getPostList({ category: currentCategory });

	return <PostList currentCategory={currentCategory} categoryList={categoryList} postList={postList} />;
}
