import type { Metadata } from "next";
import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { PostDetailView, postDetailMetadata } from "../../../_views/details";

type BlogPageProps = {
	params: Promise<{ slug: string }>;
};

// 공개 조회를 빌드 시점이 아니라 요청 시점에 수행한다(M7-BE-2).
// 발행·보관·slug 변경이 재배포 없이 다음 요청에 반영된다.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
	return postDetailMetadata(DEFAULT_LOCALE, (await params).slug);
}

export default async function BlogPost({ params }: BlogPageProps) {
	return PostDetailView({ locale: DEFAULT_LOCALE, slug: (await params).slug });
}
