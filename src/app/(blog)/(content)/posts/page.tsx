import { getPostCategoryList } from "@/libs/contents/category";
import { getPostList } from "@/libs/contents/post";
import { PostList } from "./post-list";

export default async function BlogPage() {
	const categoryList = await getPostCategoryList();
	const postList = await getPostList();

	return <PostList categoryList={categoryList} postList={postList} />;
}
