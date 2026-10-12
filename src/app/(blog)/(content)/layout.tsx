import Navigation from "@/components/navigation.client";
import SiteFooter from "@/components/site-footer";

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<>
			<Navigation />
			<main className="flex flex-1 flex-col">{children}</main>
			<SiteFooter />
		</>
	);
}
