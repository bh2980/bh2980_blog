import { notFound } from "next/navigation";
import { createOgImageResponse, OG_ALTER_ALT, OG_CONTENT_TYPE, OG_SIZE } from "@/libs/contents/og";
import { getPost } from "@/libs/contents/services/post";

// 공개 상태를 요청 시점에 확인한다(M7-BE-2). 비공개 slug는 OG 이미지도 생성하지 않는다.
export const dynamic = "force-dynamic";

export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const post = await getPost(slug);

	if (!post) {
		notFound();
	}

	return [
		{
			id: "post-og",
			alt: post.title || OG_ALTER_ALT,
			contentType: OG_CONTENT_TYPE,
			size: OG_SIZE,
		},
	];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const post = await getPost(slug);

	if (!post) {
		notFound();
	}

	return createOgImageResponse(post.title);
}
