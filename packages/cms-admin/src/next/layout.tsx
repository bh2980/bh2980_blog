import { SITE_NAME } from "@bh2980/cms/core/links";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { AiSlotProvider } from "../screens/ai/ai-slot-provider";
import { AdminQueryProvider } from "../screens/shared/query-provider";
import { Toaster } from "../ui/sonner";
import { TooltipProvider } from "../ui/tooltip";

/** 관리자 화면 메타데이터. 앱의 관리자 레이아웃에서 `export const metadata = cmsAdminMetadata;`로 쓴다. */
export const cmsAdminMetadata: Metadata = {
	title: SITE_NAME ? `CMS 관리자 | ${SITE_NAME}` : "CMS 관리자",
	robots: { index: false, follow: false },
};

/**
 * 관리자 화면 레이아웃. 앱의 `app/(admin)/admin/layout.tsx`가 그린다. 스타일(Tailwind·테마 색)은 앱의 전역 CSS가 준다.
 * 사이트와 같은 테마 설정(`next-themes`)을 쓰고 밝은·어두운 테마를 모두 지원한다(v1 §3.1).
 */
export function CmsAdminLayout({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider attribute="class" disableTransitionOnChange>
			<AdminQueryProvider>
				<AiSlotProvider>
					<TooltipProvider>
						<div className="cms-admin min-h-screen bg-background text-foreground">{children}</div>
						<Toaster richColors closeButton position="bottom-right" />
					</TooltipProvider>
				</AiSlotProvider>
			</AdminQueryProvider>
		</ThemeProvider>
	);
}
