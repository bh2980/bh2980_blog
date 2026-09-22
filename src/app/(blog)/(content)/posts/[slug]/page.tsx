import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getPost, listPosts } from "@/libs/contents/services/post";
import { PostDetailPageContent } from "./post-detail-page-content";

type BlogPageProps = {
	params: Promise<{ slug: string }>;
};

// 공개 조회를 빌드 시점이 아니라 요청 시점에 수행한다(M7-BE-2).
// 발행·보관·slug 변경이 재배포 없이 다음 요청에 반영된다.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
	const { slug } = await params;
	const post = await getPost(slug);

	if (!post) {
		return {
			title: "Not Found",
			robots: { index: false, follow: true },
		};
	}

	const url = `/posts/${post.slug}`;
	const title = post.seo?.title ?? post.title;
	const description = post.seo?.description ?? post.excerpt;

	return {
		title,
		description,
		// 관리자가 canonical을 지정하면 canonical만 바꾸고, OG 주소는 이 페이지의 실제 주소를 유지한다(M7-FE-2).
		alternates: { canonical: post.seo?.canonicalUrl ?? url },
		openGraph: {
			type: "article",
			title,
			description,
			url,
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
	};
}

export default async function BlogPost({ params }: BlogPageProps) {
	const { slug } = await params;

	const post = await getPost(slug);

	if (!post) {
		return notFound();
	}

	// 과거 주소(alias)로 들어온 요청은 정규 주소로 308 이동한다(M7 A8).
	// 조회 결과의 slug는 정규 current slug다.
	if (post.slug !== slug) {
		permanentRedirect(`/posts/${post.slug}`);
	}

	const postList = await listPosts();

	return <PostDetailPageContent post={post} postList={postList.list} />;
}
