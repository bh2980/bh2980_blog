import { checkPreviewAccess } from "@/libs/admin/preview-access";

/**
 * 관리자 여부만 boolean으로 알려 준다. 권위는 CMS 관리자 세션(NextAuth)이다
 * (M9-BE-3에서 Keystatic GitHub 쿠키 인증을 제거했다).
 */
export async function GET() {
	const access = await checkPreviewAccess();

	return Response.json(access.granted, {
		headers: {
			"Cache-Control": "private, no-store, no-cache, max-age=0",
		},
	});
}
