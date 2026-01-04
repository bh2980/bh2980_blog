import type { ReactNode } from "react";
import Footer from "@/components/footer";

export default async function PostsLayout({ children }: { children: ReactNode }) {
	return (
		<>
			<main className="flex-1">{children}</main>
			<Footer />
		</>
	);
}
