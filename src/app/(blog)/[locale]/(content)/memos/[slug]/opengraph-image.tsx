import { notFound } from "next/navigation";
import { createEntryOgImage } from "@/libs/contents/entry-og";
import { OG_ALTER_ALT, OG_CONTENT_TYPE, OG_SIZE } from "@/libs/contents/og";
import { getMemo } from "@/libs/contents/services/memo";
import { isLocale } from "@/libs/i18n/locales";

type Props = { params: Promise<{ locale: string; slug: string }> };

// 언어별 글 OG 이미지(v2 B4). 기본 언어 주소의 OG와 같은 규칙이다(요청 시점, 비공개는 404).
export const dynamic = "force-dynamic";

async function load(params: Props["params"]) {
	const { locale, slug } = await params;
	return isLocale(locale) ? getMemo(slug, locale) : null;
}

export async function generateImageMetadata({ params }: Props) {
	const entry = await load(params);
	return [{ id: "memo-og", alt: entry?.title || OG_ALTER_ALT, contentType: OG_CONTENT_TYPE, size: OG_SIZE }];
}

export default async function Image({ params }: Props) {
	const entry = await load(params);
	if (!entry) notFound();
	return createEntryOgImage(entry);
}
