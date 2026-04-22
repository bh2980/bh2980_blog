import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getMemo, listMemoSlugs } from "@/libs/contents/services/memo";
import { MemoDetailPageContent } from "./memo-detail-page-content";

type MemoPageProps = {
	params: Promise<{ slug: string }>;
};

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateMetadata({ params }: MemoPageProps): Promise<Metadata> {
	const { slug } = await params;
	const memo = await getMemo(slug);

	if (!memo) {
		return {
			title: "Not Found",
			robots: { index: false, follow: true },
		};
	}

	const url = `/memos/${sanitizeSlug(slug)}`;

	return {
		title: memo.title,
		alternates: { canonical: url },
		openGraph: {
			title: memo.title,
			url,
		},
	};
}

export async function generateStaticParams() {
	const slugs = await listMemoSlugs();

	return slugs.map((slug) => ({ slug }));
}

export default async function MemoPage({ params }: MemoPageProps) {
	const { slug } = await params;

	const memo = await getMemo(slug);

	if (!memo) {
		return notFound();
	}

	return <MemoDetailPageContent memo={memo} />;
}
