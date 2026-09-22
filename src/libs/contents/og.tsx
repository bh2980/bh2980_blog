// src/libs/og/og.tsx

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;
export const OG_ALTER_ALT = "bh2980의 개발 블로그";

/**
 * 공개 CMS 의존 OG(슬러그별)는 캐시하지 않는다(O1 A1).
 *
 * `@vercel/og`는 프로덕션에서 `public, immutable, no-transform, max-age=31536000`을 기본으로 심는다.
 * 라이브러리가 `...options.headers`를 기본값 **뒤에** 펼치므로 같은 소문자 키로 덮어쓴다.
 * 대소문자가 다른 키를 쓰면 `Headers`가 두 값을 합쳐 버린다.
 * 내용이 고정된 목록 OG 3종은 이 옵션을 쓰지 않고 기본(정적)을 유지한다.
 */
const NO_STORE_HEADERS = { "cache-control": "no-store" } as const;

async function loadPretendardBold(): Promise<ArrayBuffer> {
	return readFile(join(process.cwd(), "public/Pretendard-Bold.ttf")).then((buf) => Uint8Array.from(buf).buffer);
}

export function OgTemplate({ title }: { title: string }) {
	return (
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
				<div tw="leading-normal text-7xl">{title}</div>
			</div>
		</div>
	);
}

export async function createOgImageResponse(
	title: string = "bh2980.dev",
	options: { noStore?: boolean } = {},
) {
	const pretendardBold = await loadPretendardBold();
	return new ImageResponse(<OgTemplate title={title} />, {
		...OG_SIZE,
		...(options.noStore ? { headers: NO_STORE_HEADERS } : {}),
		fonts: [
			{
				name: "Pretendard",
				data: pretendardBold,
				weight: 700,
				style: "normal",
			},
		],
	});
}
