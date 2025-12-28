import { getMemoCategoryList, getMemoList } from "@/libs/contents/memo";
import { MemoList } from "../memo-list";

export default async function MemoCategoryPage({ params }: { params: Promise<{ category: string }> }) {
	const { category } = await params;

	const categoryList = await getMemoCategoryList();

	const memoList = await getMemoList({ category });

	return <MemoList currentCategory={category} categoryList={categoryList} memoList={memoList} />;
}
