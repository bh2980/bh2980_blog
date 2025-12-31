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
			<Navigation className="sticky top-0 z-10 border-slate-200 border-b bg-white dark:border-slate-800 dark:bg-slate-950" />
			<main className="flex-1">{children}</main>
			<Footer />
		</Fragment>
	);
}
