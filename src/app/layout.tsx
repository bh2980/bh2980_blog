import type { Metadata } from "next";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

const pretendardVariable = localFont({
	src: "../../public/PretendardVariable.woff2",
	variable: "--font-pretendard",
	weight: "100 900",
});

export async function generateMetadata(): Promise<Metadata> {
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	return {
		metadataBase: new URL(HOST_URL),
		title: "bh2980.dev",
		description: "bh2980의 개발 블로그",
		alternates: { canonical: "/" },
		openGraph: {
			title: "bh2980.dev",
			description: "bh2980의 개발 블로그",
			type: "website",
			siteName: "bh2980.dev",
			locale: "ko_KR",
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
