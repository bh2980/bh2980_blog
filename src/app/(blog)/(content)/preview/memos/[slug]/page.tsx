import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPreviewContentOptionsFromRequest } from "@/keystatic/libs/request-content-options";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getMemo } from "@/libs/contents/memo";
import { MemoDetailPageContent } from "../../../memos/[slug]/memo-detail-page-content";

type PreviewMemoPageProps = {
	params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PreviewMemoPageProps): Promise<Metadata> {
	const { slug } = await params;
	const contentOptions = await getPreviewContentOptionsFromRequest();
	const memo = await getMemo(slug, contentOptions);

	if (!memo) {
		return {
			title: "Not Found",
			robots: { index: false, follow: false },
		};
	}

	return {
		title: memo.title,
		robots: { index: false, follow: false },
		alternates: { canonical: `/memos/${sanitizeSlug(slug)}` },
	};
}

export default async function PreviewMemoPage({ params }: PreviewMemoPageProps) {
	const { slug } = await params;
	const contentOptions = await getPreviewContentOptionsFromRequest();
	const memo = await getMemo(slug, contentOptions);

	if (!memo) {
		return notFound();
	}

	return <MemoDetailPageContent memo={memo} listPathname="/memos" />;
}
