import type { Metadata } from "next";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

const pretendardVariable = localFont({
	src: "../../public/PretendardVariable.woff2",
	variable: "--font-pretendard",
	weight: "45 920",
});

export async function generateMetadata(): Promise<Metadata> {
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	const GSC_VERIFICATION_TOKEN = process.env.GSC_VERIFICATION_TOKEN;
	if (!GSC_VERIFICATION_TOKEN) throw new Error("GSC_VERIFICATION_TOKEN is required");

	return {
		metadataBase: new URL(HOST_URL),
		title: "bh2980.dev",
		description: "bh2980의 개발 블로그",
		alternates: {
			canonical: "/",
			types: {
				"application/rss+xml": "/rss.xml",
			},
		},
		openGraph: {
			title: "bh2980.dev",
			description: "bh2980의 개발 블로그",
			type: "website",
			siteName: "bh2980.dev",
			locale: "ko_KR",
		},
		verification: {
			google: GSC_VERIFICATION_TOKEN,
		},
	};
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ko" suppressHydrationWarning>
			<body
				className={`${pretendardVariable.variable} flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100`}
			>
				<NuqsAdapter>{children}</NuqsAdapter>
			</body>
		</html>
	);
}
