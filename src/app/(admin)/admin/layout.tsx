import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/app/globals.css";

export const metadata: Metadata = {
	title: "CMS 관리자 | bh2980",
	robots: { index: false, follow: false },
};

/** 관리자 화면은 블로그와 같은 테마 설정(`next-themes`)을 쓰고 밝은·어두운 테마를 모두 지원한다(v1 §3.1). */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider attribute="class" disableTransitionOnChange>
			<TooltipProvider>
				<div className="min-h-screen bg-background font-sans text-foreground antialiased">{children}</div>
				<Toaster richColors closeButton position="bottom-right" />
			</TooltipProvider>
		</ThemeProvider>
	);
}
