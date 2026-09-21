import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/app/globals.css";

export const metadata: Metadata = {
	title: "CMS 관리자 | bh2980",
	robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased font-sans">
			{children}
		</div>
	);
}
