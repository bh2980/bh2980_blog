/**
 * 공개 조회 저장소 선택 규칙 (M7-BE-1 / O1 A5, M9-BE-3에서 Keystatic 제거).
 *
 * Keystatic 파일 저장소를 제거했으므로 **`CMS_PUBLIC_REPOSITORY=postgres`가 필수**다.
 * 부수 효과 없는 순수 모듈로 분리한다. `get-content-repository.ts`는 이 결과로 구현을 고르기만 하고,
 * 규칙 자체는 저장소 구현(pg)을 끌어오지 않고 단위 테스트한다.
 *
 * - 값이 없거나 `postgres`가 아니면 조용히 대체하지 않고 즉시 실패한다.
 *   잘못된 배포를 조용히 넘기지 않기 위함이다.
 * - **플래그 없이 배포하면 공개 경로가 오류가 난다.** 의도된 fail-closed이며,
 *   배포 전에 `CMS_PUBLIC_REPOSITORY=postgres`를 설정하는 것이 필수 선행조건이다.
 */
export const CONTENT_REPOSITORY_SOURCES = ["postgres"] as const;

export type ContentRepositorySource = (typeof CONTENT_REPOSITORY_SOURCES)[number];

export function resolveContentRepositorySource(value: string | undefined): ContentRepositorySource {
	const normalized = value?.trim();

	if (normalized === "postgres") return "postgres";

	throw new Error(
		`CMS_PUBLIC_REPOSITORY 값이 올바르지 않습니다: ${normalized ? normalized : "(미설정)"} (필수: postgres)`,
	);
}
