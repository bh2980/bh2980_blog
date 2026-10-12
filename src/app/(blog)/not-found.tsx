import type { Metadata } from "next";
import Navigation from "@/components/navigation.client";
import SiteFooter from "@/components/site-footer";
import { TornPage } from "@/components/torn-page";
import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";

export const metadata: Metadata = { title: translator(DEFAULT_LOCALE)("site.notFound"), robots: { index: false } };

/** 공개 화면 안에서 `notFound()`가 불릴 때. (blog) 레이아웃의 테마·글꼴 안에서 그려진다. */
export default function NotFound() {
	return (
		<>
			<Navigation />
			<main className="flex flex-1 flex-col">
				<TornPage />
			</main>
			<SiteFooter />
		</>
	);
}
