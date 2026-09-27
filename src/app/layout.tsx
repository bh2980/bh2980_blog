import type { Metadata } from "next";
import { headers } from "next/headers";
import "katex/dist/katex.min.css";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { DEFAULT_LOCALE, isLocale, LOCALE_INFO } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
import { LOCALE_HEADER } from "@/proxy";
import "./globals.css";

const pretendardVariable = localFont({
	src: "../../public/PretendardVariable.woff2",
	variable: "--font-pretendard",
	weight: "45 920",
});

/** 요청 경로의 공개 화면 언어(v2 B4). `src/proxy.ts`가 헤더로 넘긴다. */
async function requestLocale() {
	const value = (await headers()).get(LOCALE_HEADER);
	return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function generateMetadata(): Promise<Metadata> {
	const locale = await requestLocale();
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	const GSC_VERIFICATION_TOKEN = process.env.GSC_VERIFICATION_TOKEN;
	if (!GSC_VERIFICATION_TOKEN) throw new Error("GSC_VERIFICATION_TOKEN is required");

	return {
		metadataBase: new URL(HOST_URL),
		title: "bh2980.dev",
		description: translator(locale)("site.description"),
		alternates: {
			canonical: "/",
			types: {
				"application/rss+xml": locale === DEFAULT_LOCALE ? "/rss.xml" : `/${locale}/rss.xml`,
			},
		},
		openGraph: {
			type: "website",
			siteName: "bh2980.dev",
			locale: LOCALE_INFO[locale].ogLocale,
		},
		verification: {
			google: GSC_VERIFICATION_TOKEN,
		},
	};
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang={await requestLocale()} suppressHydrationWarning>
			<body
				className={`${pretendardVariable.variable} flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100`}
			>
				<NuqsAdapter>{children}</NuqsAdapter>
			</body>
		</html>
	);
}
