import { ThemeProvider } from "next-themes";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ThemeProvider attribute={"class"} disableTransitionOnChange>
			{children}
		</ThemeProvider>
	);
}
