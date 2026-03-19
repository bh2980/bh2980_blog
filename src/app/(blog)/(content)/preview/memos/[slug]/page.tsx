import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPreviewContentOptionsFromRequest } from "@/keystatic/libs/request-content-options";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getAdminContext } from "@/libs/admin/context";
import { getMemo } from "@/libs/contents/memo";
import { MemoDetailPageContent } from "../../../memos/[slug]/memo-detail-page-content";

type PreviewMemoPageProps = {
	params: Promise<{ slug: string }>;
};

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
		openGraph: {
			title: memo.title,
		},
	};
}

export default async function PreviewMemoPage({ params }: PreviewMemoPageProps) {
	const { slug } = await params;
	const contentOptions = await getPreviewContentOptionsFromRequest();
	const memo = await getMemo(slug, contentOptions);

	if (!memo) {
		return notFound();
	}

	const { canManage, keystaticMode } = await getAdminContext();

	return (
		<MemoDetailPageContent memo={memo} canManage={canManage} keystaticMode={keystaticMode} listPathname="/memos" />
	);
}
