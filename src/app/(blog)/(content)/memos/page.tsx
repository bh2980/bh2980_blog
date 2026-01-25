import type { Metadata } from "next";
import { getMemoList, getMemoTagList } from "@/libs/contents/memo";
import { MemoList } from "./memo-list";

export const metadata: Metadata = {
	title: "메모장",
	description: "개발 중에 자주 쓰는 팁, 문제 해결 기록, 코드 스니펫을 모아둡니다.",
	alternates: { canonical: `/memos` },
	openGraph: {
		title: "메모장",
		description: "개발 중에 자주 쓰는 팁, 문제 해결 기록, 코드 스니펫을 모아둡니다.",
		images: [{ url: "/opengraph-image" }],
	},
};

export default async function MemoPage() {
	const memos = await getMemoList();
	const memoTags = await getMemoTagList();

	return <MemoList memos={memos} tags={memoTags} />;
}
