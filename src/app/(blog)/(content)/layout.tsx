import Footer from "@/components/footer";
import Navigation from "@/components/navigation.client";

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<>
			<Navigation className="sticky top-0 z-10 border-b bg-slate-50/50 backdrop-blur-lg dark:border-slate-700 dark:bg-slate-900/50" />
			<main className="flex-1">{children}</main>
			<Footer />
		</>
	);
}
