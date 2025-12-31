import { Fragment } from "react";
import Footer from "@/components/footer";
import Navigation from "@/components/navigation";

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<Fragment>
			<Navigation className="sticky top-0 z-10 border border-b bg-slate-50 dark:bg-slate-900" />
			<main className="flex-1">{children}</main>
			<Footer />
		</Fragment>
	);
}
