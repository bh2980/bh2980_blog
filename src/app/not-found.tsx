import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import Navigation from "@/components/navigation.client";
import SiteFooter from "@/components/site-footer";
import { TornPage } from "@/components/torn-page";
import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";

export const metadata: Metadata = { title: translator(DEFAULT_LOCALE)("site.notFound"), robots: { index: false } };

/** 어떤 경로에도 맞지 않는 주소. (blog) 레이아웃 밖이라 테마와 `.blog` 래퍼를 직접 두른다. */
export default function NotFound() {
	return (
		<ThemeProvider attribute="class" disableTransitionOnChange>
			<div className="blog flex flex-1 flex-col">
				<Navigation />
				<main className="flex flex-1 flex-col">
					<TornPage />
				</main>
				<SiteFooter />
			</div>
		</ThemeProvider>
	);
}
