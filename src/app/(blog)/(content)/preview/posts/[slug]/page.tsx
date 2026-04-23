import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPreviewPost, listPreviewPosts } from "@/libs/contents/services/post";
import { PostDetailPageContent } from "../../../posts/[slug]/post-detail-page-content";

type PreviewPostPageProps = {
	params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PreviewPostPageProps): Promise<Metadata> {
	const { slug } = await params;
	const post = await getPreviewPost(slug);

	if (!post) {
		return {
			title: "Not Found",
			robots: { index: false, follow: false },
		};
	}

	return {
		title: post.title,
		robots: { index: false, follow: false },
		alternates: { canonical: `/posts/${post.slug}` },
	};
}

export default async function PreviewPostPage({ params }: PreviewPostPageProps) {
	const { slug } = await params;
	const post = await getPreviewPost(slug);

	if (!post) {
		return notFound();
	}

	const postList = await listPreviewPosts();

	return (
		<PostDetailPageContent
			post={post}
			postList={postList.list}
			detailPathnamePrefix="/preview/posts"
			listPathname="/posts"
		/>
	);
}
