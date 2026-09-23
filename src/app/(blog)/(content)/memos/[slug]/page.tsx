import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getMemo } from "@/libs/contents/services/memo";
import { normalizeSlug } from "@/libs/contents/slug";
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
	const title = memo.seo?.title ?? memo.title;
	const description = memo.seo?.description;

	return {
		title,
		...(description ? { description } : {}),
		alternates: { canonical: memo.seo?.canonicalUrl ?? url },
		openGraph: {
			type: "article",
			title,
			url,
			...(description ? { description } : {}),
		},
		twitter: {
			card: "summary_large_image",
			title,
			...(description ? { description } : {}),
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
	// Next는 동적 세그먼트를 퍼센트 인코딩된 채로 넘기므로 조회와 같은 규칙으로 정규화해 비교한다.
	// (자세한 배경은 `posts/[slug]/page.tsx` 참고: 한글 slug가 500이 되던 원인이다.)
	const normalizedSlug = normalizeSlug(slug);
	if (memo.slug !== normalizedSlug) {
		permanentRedirect(`/memos/${encodeURIComponent(memo.slug)}`);
	}

	return <MemoDetailPageContent memo={memo} />;
}
