import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPreviewContentOptionsFromRequest } from "@/keystatic/libs/request-content-options";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getPost, getPostList } from "@/libs/contents/services/post";
import { PostDetailPageContent } from "../../../posts/[slug]/post-detail-page-content";

type PreviewPostPageProps = {
	params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PreviewPostPageProps): Promise<Metadata> {
	const { slug } = await params;
	const contentOptions = await getPreviewContentOptionsFromRequest();
	const post = await getPost(slug, contentOptions);

	if (!post) {
		return {
			title: "Not Found",
			robots: { index: false, follow: false },
		};
	}

	return {
		title: post.title,
		robots: { index: false, follow: false },
		alternates: { canonical: `/posts/${sanitizeSlug(slug)}` },
	};
}

export default async function PreviewPostPage({ params }: PreviewPostPageProps) {
	const { slug } = await params;
	const contentOptions = await getPreviewContentOptionsFromRequest();
	const post = await getPost(slug, contentOptions);

	if (!post) {
		return notFound();
	}

	const postList = await getPostList(undefined, contentOptions);

	return (
		<PostDetailPageContent
			post={post}
			postList={postList.list}
			detailPathnamePrefix="/preview/posts"
			listPathname="/posts"
		/>
	);
}
