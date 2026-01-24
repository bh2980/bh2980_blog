import { getMemo } from "@/libs/contents/memo";
import { createOgImageResponse, OG_ALTER_ALT, OG_CONTENT_TYPE, OG_SIZE } from "@/libs/contents/og";

export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const memo = await getMemo(slug);

	return [
		{
			id: "memo-og",
			alt: memo?.title || OG_ALTER_ALT,
			contentType: OG_CONTENT_TYPE,
			size: OG_SIZE,
		},
	];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const memo = await getMemo(slug);

	return createOgImageResponse(memo?.title);
}
