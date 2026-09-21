import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getMemo } from "@/libs/contents/services/memo";
import { MemoDetailPageContent } from "./memo-detail-page-content";

type MemoPageProps = {
	params: Promise<{ slug: string }>;
};

// 공개 조회를 요청 시점에 수행한다(M7-BE-2).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: MemoPageProps): Promise<Metadata> {
	const { slug } = await params;
	const memo = await getMemo(slug);

	if (!memo) {
		return {
			title: "Not Found",
			robots: { index: false, follow: true },
		};
	}

	const url = `/memos/${memo.slug}`;

	return {
		title: memo.title,
		alternates: { canonical: url },
		openGraph: {
			title: memo.title,
			url,
		},
	};
}

export default async function MemoPage({ params }: MemoPageProps) {
	const { slug } = await params;

	const memo = await getMemo(slug);

	if (!memo) {
		return notFound();
	}

	// 과거 주소(alias)로 들어온 요청은 정규 주소로 308 이동한다(M7 A8).
	if (memo.slug !== slug) {
		permanentRedirect(`/memos/${memo.slug}`);
	}

	return <MemoDetailPageContent memo={memo} />;
}
