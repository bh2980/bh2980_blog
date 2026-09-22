import "server-only";
import { AuthError, authGateway } from "@/cms/adapters/auth";

/**
 * M7-FE-1: 미리보기 접근 판정.
 *
 * 권위는 CMS 관리자 세션(NextAuth)이다. Keystatic GitHub 토큰(`keystatic-gh-access-token`)은
 * 미리보기 판정에 쓰지 않는다(O1 A9). `draftMode`는 “미리보기 의도 표시”로만 남는다.
 *
 * 개발 모드에서도 `CMS_DEV_AUTH_BYPASS=1`을 명시하지 않으면 세션을 요구한다(비로그인 미리보기 금지).
 * 세션 없음·권한 없음은 `granted: false`이고, 그 밖의 오류는 그대로 올려 장애를 권한 문제로 감추지 않는다.
 */
export type PreviewAccess = { granted: true } | { granted: false; status: 401 | 403 };

export async function checkPreviewAccess(): Promise<PreviewAccess> {
	try {
		await authGateway.verifyAdmin();

		return { granted: true };
	} catch (error) {
		if (error instanceof AuthError) {
			return { granted: false, status: error.code === "unauthorized" ? 401 : 403 };
		}

		throw error;
	}
}

export async function canPreview(): Promise<boolean> {
	return (await checkPreviewAccess()).granted;
}
