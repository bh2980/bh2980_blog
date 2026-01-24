import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPost } from "@/libs/contents/post";

export const size = { width: 1200, height: 630 };

export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const post = await getPost(slug);
	return [
		{
			id: "post-og",
			alt: post?.title || "bh2980의 개발 블로그",
			contentType: "image/png",
			size,
		},
	];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
	const pretendard = await readFile(join(process.cwd(), "public/Pretendard-Bold.ttf"));
	const { slug } = await params;
	const post = await getPost(slug);

	return new ImageResponse(
		<div
			tw="relative flex h-full w-full items-center justify-center overflow-hidden"
			style={{
				background: "linear-gradient(135deg, #eff6ff 0%, #e0f2fe 45%, #dbeafe 100%)",
				fontFamily: "Pretendard",
			}}
		>
			<div
				tw="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full opacity-40"
				style={{
					background: "radial-gradient(circle at 30% 30%, #93c5fd 0%, rgba(147,197,253,0) 65%)",
				}}
			/>
			<div
				tw="absolute -bottom-48 -right-48 h-[620px] w-[620px] rounded-full opacity-35"
				style={{
					background: "radial-gradient(circle at 60% 60%, #7dd3fc 0%, rgba(125,211,252,0) 65%)",
				}}
			/>

			<div
				tw="relative flex items-center justify-center rounded-[48px] border border-white/70 px-24 py-20 max-w-4/5 text-center"
				style={{
					background: "rgba(255,255,255,0.55)",
					boxShadow: "0 30px 80px rgba(2, 132, 199, 0.18), 0 10px 24px rgba(30, 64, 175, 0.10)",
				}}
			>
				<div tw="leading-normal text-7xl">{post?.title || "bh2980.dev"}</div>
			</div>
		</div>,
		{
			...size,
			fonts: [
				{
					name: "Pretendard",
					data: pretendard,
					weight: 700,
					style: "normal",
				},
			],
		},
	);
}
