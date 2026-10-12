import type { Metadata } from "next";
import { headers } from "next/headers";
import "katex/dist/katex.min.css";
import { Gowun_Batang, IBM_Plex_Mono, Literata, Shippori_Mincho } from "next/font/google";
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

/*
 * 공개 블로그 글꼴(관리자 화면은 Pretendard 그대로). 영문은 Literata가, 한글은 고운바탕이, 일본어는 Shippori Mincho가
 * 그린다. 영문 글꼴에는 한글·가나가 없어서 `font-family`에 앞에 두면 글자마다 알맞은 글꼴로 넘어간다.
 * 한글·일본어 글꼴은 글자 조각으로 나뉘어 필요한 조각만 받으므로 미리 받지 않는다.
 */
/*
 * Literata는 같은 굵기에서 고운바탕보다 획이 두꺼워 한글 사이에서 튄다. 300·600만 실으면 보통 글은 300, 굵은 글은
 * 600으로 그려져(가장 가까운 굵기를 고르는 규칙) 고운바탕 400·700과 무게가 맞는다.
 */
const literata = Literata({ weight: ["300", "600"], subsets: ["latin"], variable: "--font-literata", display: "swap" });
const gowunBatang = Gowun_Batang({
	weight: ["400", "700"],
	subsets: ["latin"],
	variable: "--font-gowun-batang",
	display: "swap",
	preload: false,
});
const shipporiMincho = Shippori_Mincho({
	weight: ["400", "600"],
	subsets: ["latin"],
	variable: "--font-shippori-mincho",
	display: "swap",
	preload: false,
});
const plexMono = IBM_Plex_Mono({
	weight: ["400", "500"],
	subsets: ["latin"],
	variable: "--font-plex-mono",
	display: "swap",
});

const fontVariables = [pretendardVariable, literata, gowunBatang, shipporiMincho, plexMono]
	.map((font) => font.variable)
	.join(" ");

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
		title: "bh2980.com",
		description: translator(locale)("site.description"),
		alternates: {
			canonical: "/",
			types: {
				"application/rss+xml": locale === DEFAULT_LOCALE ? "/rss.xml" : `/${locale}/rss.xml`,
			},
		},
		openGraph: {
			type: "website",
			siteName: "bh2980.com",
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
				className={`${fontVariables} flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100`}
			>
				<NuqsAdapter>{children}</NuqsAdapter>
			</body>
		</html>
	);
}
