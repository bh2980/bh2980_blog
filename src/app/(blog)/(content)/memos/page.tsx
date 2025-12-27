import { getMemoCategoryList } from "@/libs/contents/category";
import { getMemoList } from "@/libs/contents/memo";
import { MemoList } from "./memo-list";

export default async function MemoPage() {
	const categoryList = await getMemoCategoryList();

	const memoList = await getMemoList();

	return <MemoList categoryList={categoryList} memoList={memoList} />;
}
