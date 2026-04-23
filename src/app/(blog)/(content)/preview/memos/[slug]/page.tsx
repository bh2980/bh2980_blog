import { notFound } from "next/navigation";
import { getPreviewMemo } from "@/libs/contents/services/memo";
import { MemoDetailPageContent } from "../../../memos/[slug]/memo-detail-page-content";

type PreviewMemoPageProps = {
	params: Promise<{ slug: string }>;
};

export default async function PreviewMemoPage({ params }: PreviewMemoPageProps) {
	const { slug } = await params;
	const memo = await getPreviewMemo(slug);

	if (!memo) {
		return notFound();
	}

	return <MemoDetailPageContent memo={memo} listPathname="/memos" />;
}
