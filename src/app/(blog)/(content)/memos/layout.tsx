import type { ReactNode } from "react";
import { getMemoCategoryList, getMemoList } from "@/libs/contents/memo";
import { MemoList } from "./memo-list";

export default async function MemosLayout({ children }: { children: ReactNode }) {
	const categories = await getMemoCategoryList();
	const memos = await getMemoList();

	return (
		<div className="h-[calc(100dvh-66px)] min-h-0 w-full overflow-hidden md:grid md:grid-cols-[360px_1fr]">
			<MemoList categories={categories} memos={memos} />
			<section className="min-w-0 overflow-y-auto">{children}</section>
		</div>
	);
}
