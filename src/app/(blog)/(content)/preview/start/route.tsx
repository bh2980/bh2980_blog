import { checkPreviewAccess } from "@/libs/admin/preview-access";

/**
 * Keystatic 원격 미리보기 진입점이었다. Keystatic을 제거했으므로(M9-BE-3) 더는
 * `draftMode`를 켜거나 branch 쿠키를 심지 않는다.
 *
 * 계약:
 * - 관리자 세션이 없으면 **401/403** (계획서 §13.4)
 * - 인증된 옛 URL은 **410 Gone** — 실제 초안 미리보기는 `/preview/posts/[slug]`·
 *   `/preview/memos/[slug]`가 담당한다.
 * - 쿼리와 무관하게 리다이렉트·draftMode 활성화·쿠키 설정을 하지 않는다.
 */
export async function GET() {
	const access = await checkPreviewAccess();
	if (!access.granted) {
		return new Response("Preview requires an admin session", { status: access.status });
	}

	return new Response("Preview start has been removed. Use /preview/posts/[slug] or /preview/memos/[slug].", {
		status: 410,
		headers: { "Cache-Control": "private, no-store" },
	});
}
