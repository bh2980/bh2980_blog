import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMemo } from "@/libs/contents/services/memo";
import { MemoDetailPageContent } from "../../../memos/[slug]/memo-detail-page-content";

type PreviewMemoPageProps = {
	params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PreviewMemoPageProps): Promise<Metadata> {
	const { slug } = await params;
	const memo = await getMemo(slug);

	if (!memo) {
		return {
			title: "Not Found",
			robots: { index: false, follow: false },
		};
	}

	return {
		title: memo.title,
		robots: { index: false, follow: false },
		alternates: { canonical: `/memos/${memo.slug}` },
	};
}

export default async function PreviewMemoPage({ params }: PreviewMemoPageProps) {
	const { slug } = await params;
	const memo = await getMemo(slug);

	if (!memo) {
		return notFound();
	}

	return <MemoDetailPageContent memo={memo} listPathname="/memos" />;
}
