/**
 * vitest 전용 `server-only` 스텁.
 *
 * 실제 패키지는 `next`의 의존성으로만 설치되어 프로젝트 루트에서 해석되지 않는다.
 * Next 빌드에서는 그대로 동작하고, 테스트에서는 이 빈 모듈로 대체한다(vitest.config.ts alias).
 */
export {};
