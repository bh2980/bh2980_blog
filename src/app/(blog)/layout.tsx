import { ThemeProvider } from "next-themes";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ThemeProvider attribute={"class"} disableTransitionOnChange>
			{/* 공개 화면의 종이·먹 색과 명조 글꼴(`.blog`, globals.css). 관리자 화면에는 번지지 않게 여기서만 건다. */}
			<div className="blog flex flex-1 flex-col">{children}</div>
		</ThemeProvider>
	);
}
