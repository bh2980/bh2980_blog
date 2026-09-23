import { notFound } from "next/navigation";
import { canPreview } from "@/libs/admin/preview-access";

export const dynamic = "force-dynamic";

export default async function PreviewLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	// 세션 없이는 미리보기 셸을 렌더하지 않는다(M7-FE-1 / O1 A9).
	// 페이지 자체도 서비스 단계에서 한 번 더 막으므로 이 검사는 화면 노출을 막는 층이다.
	if (!(await canPreview())) {
		notFound();
	}

	return <>{children}</>;
}
