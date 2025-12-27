import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendardVariable = localFont({
	src: "../../public/PretendardVariable.woff2",
	variable: "--font-pretendard",
	weight: "100 900",
});

export const metadata: Metadata = {
	title: "bh2980.dev",
	description: "bh2980.dev",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ko">
			<body
				className={`${pretendardVariable.variable} flex min-h-screen flex-col bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100`}
			>
				{children}
			</body>
		</html>
	);
}
