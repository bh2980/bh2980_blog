import Navigation from "@/components/navigation.client";

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<>
			<Navigation className="sticky top-0 z-10 border border-b bg-slate-50/50 backdrop-blur-lg dark:bg-slate-900" />
			<div className="flex flex-1 flex-col">{children}</div>
		</>
	);
}
