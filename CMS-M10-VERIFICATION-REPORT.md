# CMS M10 검증 보고

- 범위: `feature/new-cms` 워킹트리의 M10 발행 검증·사용자 피드백·대화상자 전환. `main` 병합, 배포, 운영 DB 쓰기 없음.
- 서버: 발행 검증이 쓰기 트랜잭션에 포함되며 실패 시 공개 스냅샷/예약 쓰기를 롤백한다. 경고는 발행을 막지 않는다. 권한·동일 출처·`expectedVersion` 유지. HTTP 테스트는 성공+경고, 422, 409, 428, 401, 403을 확인한다.
- 클라이언트: 실제 new/edit 화면에 연결된 `EntryEditorShell`에 복구/충돌 Radix Dialog, Sonner 성공/경고, 입력별 오류 설명, MDX 위치 이동, 저장되지 않은 초안의 발행·예약 차단을 적용했다.
- 자동 검증: `TZ=UTC pnpm test:run` **116개 파일 / 767개 테스트 통과**, `pnpm typecheck` 통과, `CMS_PUBLIC_REPOSITORY=postgres pnpm build` 통과, 변경 소스 33개 Biome error 0건, `git diff --check` 통과. 테스트 파일의 시각·로케일은 UTC 기준이다. `pnpm build` 단독 실행은 이 로컬 환경에 `CMS_PUBLIC_REPOSITORY` 설정이 없어 실패하며, 위 빌드 명령으로 검증했다.
- 런타임 `alert/confirm/prompt` 호출: `src`에서 테스트 파일 제외 **0건**.
- 독립 리뷰: R10-C reviewer 재검수 2회 후 P0/P1 0건, 최종 판정 **OK with notes**. 초기 P1(실제 편집기의 복구·충돌 dialog 미노출, 발행 문제의 필드/toast 연결 부재)은 수정 후 재검수됐다.
- 브라우저: localhost 전용 임시 미리보기(검증 뒤 삭제)에 실제 `EntryEditorShell`을 마운트하고 API만 모의했다. Chromium 390px에서 가로 페이지 넘침 없음, 발행 오류에 따른 MDX textarea caret/`aria-invalid`, 닫힌 속성 패널을 열어 제목 입력으로 포커스 이동, 위치를 담은 Sonner 경고, PATCH 409 대화상자 포커스 진입·Esc/닫기 뒤 `#cms-publish` 포커스 복귀 확인. 임시 미리보기 파일과 서버는 제거했다.

## 남은 운영 확인

실제 `/admin`은 GitHub 관리자 인증이 필요하므로 인증된 브라우저/실제 API를 통한 end-to-end 발행, 모바일 기기(특히 iOS caret), 모달의 모든 키보드 동선은 검증하지 못했다. 좁은 화면에서 속성 패널은 에디터 위에 겹치지만 가려진 에디터는 `inert` 처리되지 않았다. 복구 fingerprint는 제목·슬러그·본문만 비교한다. 충돌 복사는 본문만 복사한다. 이 항목들은 브라우저 운영 검수와 후속 개선 대상으로 남긴다.

`CMS-M10-IMPROVEMENT-PLAN.md`의 착수 전 Oracle 및 단계별 R10-A/B 승인 이력은 이번 사후 검증으로 소급 생성하지 않았다. 마일스톤 문서의 승인 상태 변경, `main` 병합, 배포는 별도 판단이 필요하다.
