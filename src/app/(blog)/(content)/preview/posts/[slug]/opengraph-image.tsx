import { getPreviewContentOptionsFromRequest } from "@/keystatic/libs/request-content-options";
import { createOgImageResponse, OG_ALTER_ALT, OG_CONTENT_TYPE, OG_SIZE } from "@/libs/contents/og";
import { getPost } from "@/libs/contents/post";

export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const contentOptions = await getPreviewContentOptionsFromRequest();
	const post = await getPost(slug, contentOptions);

	return [
		{
			id: "preview-post-og",
			alt: post?.title || OG_ALTER_ALT,
			contentType: OG_CONTENT_TYPE,
			size: OG_SIZE,
		},
	];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const contentOptions = await getPreviewContentOptionsFromRequest();
	const post = await getPost(slug, contentOptions);

	return createOgImageResponse(post?.title);
}
