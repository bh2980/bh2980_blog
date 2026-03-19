import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPreviewContentOptionsFromRequest } from "@/keystatic/libs/request-content-options";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getAdminContext } from "@/libs/admin/context";
import { getPost, getPostList } from "@/libs/contents/post";
import { PostDetailPageContent } from "../../../posts/[slug]/post-detail-page-content";

type PreviewPostPageProps = {
	params: Promise<{ slug: string }>;
};

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
	const { canManage, keystaticMode } = await getAdminContext();

	return (
		<PostDetailPageContent
			post={post}
			postList={postList.list}
			canManage={canManage}
			keystaticMode={keystaticMode}
			detailPathnamePrefix="/preview/posts"
			listPathname="/posts"
		/>
	);
}
