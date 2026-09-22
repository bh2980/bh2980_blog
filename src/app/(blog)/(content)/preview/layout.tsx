import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { canPreview } from "@/libs/admin/preview-access";

export const dynamic = "force-dynamic";

export default async function PreviewLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	// 세션 없이는 미리보기 셸을 렌더하지 않는다(M7-FE-1 / O1 A9).
	// 페이지 자체도 서비스 단계에서 한 번 더 막으므로 이 검사는 화면·배너 노출을 막는 층이다.
	if (!(await canPreview())) {
		notFound();
	}

	const { isEnabled } = await draftMode();

	return (
		<>
			{children}
			{isEnabled && (
				<div className="fixed inset-x-0 bottom-0 z-50">
					<div className="mx-auto mb-4 max-w-5xl rounded-lg border border-yellow-300 bg-yellow-50/90 px-4 py-3 text-yellow-900 shadow dark:border-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-100">
						<div className="flex items-center justify-between gap-3">
							<div className="text-sm">Draft mode on</div>
							<form method="POST" action="/preview/end">
								<button
									className="rounded-md bg-yellow-600 px-3 py-1.5 text-sm text-white hover:bg-yellow-700"
									type="submit"
								>
									End preview
								</button>
							</form>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
