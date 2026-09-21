/**
 * 공개 조회 저장소 선택 규칙 (M7-BE-1 / O1 A5).
 *
 * 부수 효과 없는 순수 모듈로 분리한다. `get-content-repository.ts`는 이 결과로 구현을 고르기만 하고,
 * 규칙 자체는 저장소 구현(Keystatic reader·pg)을 끌어오지 않고 단위 테스트한다.
 *
 * - `CMS_PUBLIC_REPOSITORY=postgres`이면 CMS DB의 공개본을 읽는다.
 * - 값이 없으면 사용자 전환 승인 전까지 기존 Keystatic 구현을 유지한다.
 * - 알 수 없는 값은 조용히 대체하지 않고 즉시 실패한다(잘못된 배포를 조용히 넘기지 않기 위함).
 */
export const CONTENT_REPOSITORY_SOURCES = ["keystatic", "postgres"] as const;

export type ContentRepositorySource = (typeof CONTENT_REPOSITORY_SOURCES)[number];

export function resolveContentRepositorySource(value: string | undefined): ContentRepositorySource {
	const normalized = value?.trim();

	if (!normalized) return "keystatic";
	if (normalized === "keystatic" || normalized === "postgres") return normalized;

	throw new Error(
		`CMS_PUBLIC_REPOSITORY 값이 올바르지 않습니다: ${normalized} (사용 가능: ${CONTENT_REPOSITORY_SOURCES.join(" | ")})`,
	);
}
