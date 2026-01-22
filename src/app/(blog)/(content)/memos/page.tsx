import { getMemoList, getMemoTagList } from "@/libs/contents/memo";
import { MemoList } from "./memo-list";

export default async function MemoPage() {
	const memos = await getMemoList();
	const memoTags = await getMemoTagList();

	return <MemoList memos={memos} tags={memoTags} />;
}
