import { AdminContextProvider } from "@/components/admin/admin-context.client";
import Navigation from "@/components/navigation.client";

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<AdminContextProvider>
			<Navigation className="absolute top-0 z-10 w-full bg-transparent" />
			<main className="flex flex-1 flex-col">{children}</main>
		</AdminContextProvider>
	);
}
