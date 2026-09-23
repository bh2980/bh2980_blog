import { sanitize } from "@/utils/sanitize";

/**
 * 조회 전 slug 정규화. 공개 조회와 관리자 미리보기가 같은 규칙을 써야 한다(R1 P2).
 *
 * - 맥·우분투에서 온 NFD 한글 주소를 NFC로 모아 같은 글로 이어지게 한다.
 * - 잘못된 퍼센트 인코딩은 예외를 던지지 않고 원문으로 돌려 404로 끝낸다(500으로 만들지 않는다).
 */
export function normalizeSlug(slug: string): string {
	const trimmed = slug.trim();
	if (!trimmed) return trimmed;

	// 퍼센트 인코딩이 없으면 디코딩은 무의미하다. 잘못된 인코딩의 예외·로그를 만들지 않는다.
	if (!trimmed.includes("%")) return trimmed.normalize("NFC");

	try {
		return sanitize(trimmed);
	} catch {
		return trimmed;
	}
}
