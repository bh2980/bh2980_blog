import { getMemoCategoryList, getMemoList } from "@/libs/contents/memo";
import { MemoList } from "./memo-list";

export default async function MemoPage() {
	const categories = await getMemoCategoryList();

	const memos = await getMemoList();

	return <MemoList categories={categories} memos={memos} />;
}
