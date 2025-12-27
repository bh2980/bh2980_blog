import { getMemoCategoryList } from "@/libs/contents/category";
import { getMemoList } from "@/libs/contents/memo";
import { MemoList } from "../memo-list";

export default async function MemoCategoryPage({ params }: { params: Promise<{ category: string }> }) {
	const category = (await params).category;

	const categoryList = await getMemoCategoryList();

	const memoList = await getMemoList();

	return <MemoList currentCategory={category} categoryList={categoryList} memoList={memoList} />;
}
