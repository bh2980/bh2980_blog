import { headers } from "next/headers";
import { listMemos } from "@/libs/contents/services/memo";
import { listPosts } from "@/libs/contents/services/post";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/libs/i18n/locales";
import { LOCALE_HEADER } from "@/proxy";
import { formatPublishedAtShort } from "@/utils/format-published-at";
import Footer from "./footer";

/** 이 언어로 공개된 글·메모 중 가장 최근에 올리거나 고친 날. 하나도 없으면 `null`이다. */
async function latestUpdate(locale: Locale): Promise<string | null> {
	const [posts, memos] = await Promise.all([listPosts({}, locale), listMemos({}, locale)]);
	const times = [...posts.list, ...memos.list].map((entry) => entry.updatedAt ?? entry.publishedAt);
	if (times.length === 0) return null;

	return times.reduce((latest, time) => (new Date(time) > new Date(latest) ? time : latest));
}

/** 꼬리말에 판권면의 "고친 날"을 채워 넘긴다. 언어는 요청 경로에서 읽는다(`src/proxy.ts`). */
export default async function SiteFooter() {
	const value = (await headers()).get(LOCALE_HEADER);
	const locale = isLocale(value) ? value : DEFAULT_LOCALE;
	const updated = await latestUpdate(locale);

	return <Footer lastUpdated={updated ? { iso: updated, label: formatPublishedAtShort(updated) } : undefined} />;
}
