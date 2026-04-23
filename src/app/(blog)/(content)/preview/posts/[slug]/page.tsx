import { notFound } from "next/navigation";
import { getPreviewPost, listPreviewPosts } from "@/libs/contents/services/post";
import { PostDetailPageContent } from "../../../posts/[slug]/post-detail-page-content";

type PreviewPostPageProps = {
	params: Promise<{ slug: string }>;
};

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
