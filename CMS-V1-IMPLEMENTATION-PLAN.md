# CMS v1 구현 계획

작성: 2026-09-16 · Lead · 갱신: 2026-09-21 (Milestone 2 oracle/reviewer 피드백 반영 완료로 전 작업 DONE 갱신)
대상 저장소: `/Users/bh2980/Desktop/bh2980_blog`  
명세: `CMS-SPEC.md` (v1 완료 = 기능 추적표 F01–F11, F13–F19 + 이전 + Keystatic 제거 + 권한/공개)  
통합 브랜치: `feature/new-cms`  
Worktree 루트: `/Users/bh2980/Desktop/bh2980_blog-worktrees` (배치마다 생성·병합·삭제)

이 문서는 실행 계획이다. 명세(`CMS-SPEC.md`)를 대체하지 않는다. 에이전트는 아래 진행표로 현재 위치를 확인하고, Task 본문은 착수하는 ID만 읽는다. 명세에 없는 기능, 이력 저장소(F12), 공동 편집, 예약 실행기 운영, 모바일 관리자 UX, 플러그인 마켓은 계획에 넣지 않는다.

담당 약어: TW = Test Writer, ED = Editor, DA = Data, BE = Backend, FE = Frontend, JR = Junior, INF = Infra, RV = Reviewer.

## 진행 상태

상태: `TODO` 선행 미충족 · `READY` 착수 가능 · `IN_PROGRESS` 배정됨 · `BLOCKED` 외부 대기 · `DONE` 통합 브랜치에 병합·검증됨 · `CANCELLED` 계획 변경으로 하지 않음.

Lead가 배정·차단·병합할 때마다 이 표만 고친다. 빈 칸은 `—`. worktree는 슬롯 경로, commit은 통합 브랜치 SHA, 검증은 실행한 명령과 결과 한 줄.

| ID | 상태 | 담당 | worktree | commit | 검증 |
| --- | --- | --- | --- | --- | --- |
| M0-INV-1 | CANCELLED | DA | — | — | `src/cms` 폐기. 스키마 드리프트 대상 없음 |
| M0-INV-2 | DONE | INF | 통합 브랜치 | `48a502d` | `pg` 8.23.0 runtime + `@types/pg` 8.23.1 dev 설치; `@tiptap/*`는 M3-FE-1까지 유예 |
| M0-INV-3 | DONE | JR | 병합 후 삭제 | `43e77e7` | MDX 49=post 7+memo 42, `find`와 일치. JSX 요약은 표에 맞춰 Tooltip 8/Callout 6 |
| M0-BASE-1 | DONE | Lead | 통합 브랜치 | `24aa89e` | spec·plan·`env.d.ts`만. `.env.local` 제외 |
| M1-TW-1 | DONE | TW | 병합 후 삭제 | `499fd96` | `pnpm test:run src/cms/mdx/__test__/roundtrip.test.ts` → 1 failed suite, 0 pass/skip. `@/cms/mdx` 미구현 |
| M1-TW-2 | DONE | TW | 통합 브랜치 | `f0746a6` | 실 PostgreSQL 13 passing, 0 skip; `CMS_TEST_DATABASE_URL`만 사용 |
| M1-ED-1 | DONE | ED | 병합 후 삭제 | `3380550` | `pnpm test:run src/cms/mdx/__test__/roundtrip.test.ts` → 38 passed, 0 skip |
| M1-ED-1a | DONE | ED | 병합 후 삭제 | `3380550` | `toDocument` + `index.ts` |
| M1-ED-1b | DONE | ED | 병합 후 삭제 | `3380550` | serialize. 합성 픽스처 통과 |
| M1-ED-1c | DONE | ED | 병합 후 삭제 | `3380550` | 표본 9파일 firstDoc===secondDoc |
| M1-ED-2 | DONE | ED | 통합 브랜치 | `53b1495` | 실제 SourceConverter/에디터 토글 테스트 10개 통과; 보기 전용 토글 시 원문 바이트 정확히 보존; 편집된 문서는 의미 보존 왕복; 유효하지 않거나 허용되지 않은 원문은 오류와 함께 보존; Codex Sol medium 최종 리뷰 이슈 없음 |
| M1-DA-1 | DONE | DA | 통합 브랜치 | `9d19f9f` | 실DB 13 passing; Codex Sol medium 최종 리뷰 이슈 없음 |
| M1-RV-1 | DONE | RV | 통합 브랜치 | `53b1495` | 전체 명령 `node --env-file=.env.local node_modules/vitest/vitest.mjs run` => 56 files/299 tests passed; `pnpm typecheck` passed; M1-ED-2 변경 5개 파일 Biome 통과; Codex 최종 판정 OK |
| M2-INV-1 | DONE | INF | 통합 브랜치 | — | next-auth@5.0.0-beta.32 공식 조사 확인 |
| M2-BE-1 | DONE | BE | 통합 브랜치 | `778a1a8` | CSRF 가드(validateSameOrigin fail-closed), GitHub ID BigInt canonical 검증, 비인가 403 루프 방지; auth-gateway 테스트 통과 |
| M2-BE-2 | DONE | BE | 통합 브랜치 | `6d05f43` | `src/cms/services/__test__/content-service.test.ts` 71 passing |
| M2-TW-1 | DONE | TW | 통합 브랜치 | `0d8529a` | `src/cms/services/__test__/content-service.test.ts` 순수 서비스 계약 고정 |
| M2-TW-3 | DONE | TW | 통합 브랜치 | `ef390fe` | `src/cms/adapters/postgres/__test__/references.test.ts` 작업 참조/충돌 계약 고정 |
| M2-DA-1 | DONE | DA | 통합 브랜치 | `190d8ae` | 실 PostgreSQL 참조 무결성 및 references 16 passing |
| M2-BE-3 | DONE | BE | 통합 브랜치 | `778a1a8` | 엔트리 생성/수정+폴더 배정 단일 트랜잭션, `{code,message,issues?,serverVersion?}` 오류 규격; entries API 테스트 통과 |
| M2-TW-2 | DONE | TW | 통합 브랜치 | `fbd27db` | folders.test.ts (8), list-entries.test.ts (9) 계약 고정 |
| M2-DA-2 | DONE | DA | 통합 브랜치 | `f9aacab` | folders.version 컬럼 + expectedVersion 428/409 낙관적 락, version 직렬화 복원; folders.test.ts 실DB 통과 |
| M2-BE-4 | DONE | BE | 통합 브랜치 | `778a1a8` | relations 역참조 API; relations.test.ts 통과 |
| M2-BE-5 | DONE | JR | 통합 브랜치 | `778a1a8` | preferences API 규격; preferences.test.ts 통과 |
| M2-FE-1 | DONE | FE | 통합 브랜치 | `56b8675` | URL 쿼리 양방향 동기화, 오류/재시도 UI, AbortController 경합 방지, 검색 300ms 디바운스; 빌드 통과 |
| M2-FE-2 | DONE | FE | 통합 브랜치 | `778a1a8` | 폴더 계층 트리/이름변경/삭제, preferences mount-once 자동 연동; 빌드 통과 |
| M2-RV-1 | DONE | RV | 통합 브랜치 | `56b8675` | 오라클 감사(H1–H4) 반영 `778a1a8`, reviewer 재리뷰 P0/P1 반영 `f9aacab`, 최종 리뷰 "중대한 위험 없음"; 65 files/422 tests, typecheck, build 통과 |
| M3-TW-1 | DONE | TW | 통합 브랜치 | `a225241` | 발행·상태·예약·날짜·공개참조 롤백 계약 테스트 11개; lifecycle.test.ts |
| M3-BE-1 | DONE | BE | 통합 브랜치 | `963bf77` | publish/archive/restore/schedule API + executeSchedulePublish 슬러그/참조 원자적 승격; reviewer 통과 |
| M3-FE-1 | DONE | FE | 통합 브랜치 | `665a0f9` | /admin/entries/[id]/edit 셸, Tiptap 에디터 마운트, M1 EditorToggle 연동; 빌드 통과 |
| M3-FE-2 | DONE | FE | 통합 브랜치 | `6d83eef` | 2초 idle/10초 max 자동저장, IndexedDB 백업, IME 지연, 409 충돌 비교/복사 UI; reviewer 통과 |
| M3-ED-1 | DONE | ED | 통합 브랜치 | `8fb382b` | 슬래시 메뉴(/) 및 블록 핸들(위/아래 이동, 복제, 삭제) 오버레이; reviewer 통과 |
| M3-ED-2 | DONE | ED | 통합 브랜치 | `05a1e44` | 내부 링크([[]) 및 Tiptap 커스텀 Image 노드(크기/정렬/alt/caption) + MDX 컴포넌트 변환; reviewer 통과 |
| M3-INF-1 | DONE | INF | 통합 브랜치 | `1573d3c` | R2 MediaStore 어댑터(S3 호환 presigned PUT, promoteFile, head/delete/publicUrl); reviewer 통과 |
| M3-BE-2 | DONE | BE | 통합 브랜치 | `1573d3c` | 미디어 업로드 준비/완료 API(/media/uploads, /media/:id/complete), 10MiB/MIME 매직바이트 검증; reviewer 통과 |
| M3-FE-3 | DONE | FE | 통합 브랜치 | `05a1e44` | 에디터 내 이미지 드래그앤드롭/클립보드 붙여넣기/슬래시/툴바 삽입 및 프로그레스 UI; reviewer 통과 |
| M3-FE-4 | DONE | FE | 통합 브랜치 | `dc74ab4` | 발행·예약·보관·삭제 상태 액션 UI 및 예약 다이얼로그; 빌드 통과 |
| M3-RV-1 | DONE | RV | 통합 브랜치 | `05a1e44` | M3 전 작업(TW-1, BE-1, BE-2, FE-1~4, ED-1, ED-2, INF-1) 완료 및 reviewer 전 배치 무결함 승인 |
| M4-BE-MEDIA-1 | DONE | BE | 통합 브랜치 | `ed44c2d` | 미디어 목록 조회(검색/필터/사용처 조인) 및 안전 삭제 API; reviewer 통과 |
| M4-FE-1 | DONE | FE | 통합 브랜치 | `1b83ced` | 미디어 라이브러리(/admin/media) 썸네일 그리드, 상세 인스펙터, 안전 삭제 UX; reviewer 통과 |
| M4-TW-1 | TODO | TW | — | — | — |
| M4-BE-1 | TODO | BE | — | — | — |
| M4-BE-2 | TODO | BE | — | — | — |
| M4-FE-2 | TODO | FE | — | — | — |
| M4-ED-1 | TODO | ED | — | — | — |
| M4-BE-3 | TODO | BE | — | — | — |
| M4-BE-4 | TODO | BE | — | — | — |
| M4-ED-2 | TODO | ED | — | — | — |
| M4-RV-1 | TODO | RV | — | — | — |
| M5-INV-1 | TODO | BE | — | — | — |
| M5-BE-1 | TODO | BE | — | — | — |
| M5-BE-2 | TODO | BE | — | — | — |
| M5-FE-1 | TODO | FE | — | — | — |
| M5-BE-3 | TODO | JR | — | — | — |
| M5-BE-4 | TODO | BE | — | — | — |
| M5-SEC-1 | TODO | Security QA | — | — | — |
| M5-TW-1 | TODO | TW | — | — | — |
| M5-LEAD-1 | TODO | Lead | — | — | — |
| M5-BE-5 | TODO | BE | — | — | — |
| M5-RV-1 | TODO | RV | — | — | — |

## 계획 변경

이 문서는 작업 순서와 파일 소유권의 기준이지만 절대 명세가 아니다. 제품 동작의 권위는 `CMS-SPEC.md`다.

숨은 의존성, 잘못된 선행, 파일 소유권 충돌, 층이 어긋난 테스트가 보이면 **임의로 우회 구현하지 않는다.** 작업을 멈추고 Lead가 이 문서를 고친 뒤에 계속한다. 예상 밖의 파일을 건드려야 할 때도 같다. 담당자가 소유 목록 밖의 파일을 먼저 수정하지 않고, Lead가 소유권을 옮기거나 선행 Task를 나눈 다음 재배정한다.

- 2026-09-16: 사용자 요청으로 미커밋 `src/cms/**`, `docs/cms/**`, 게시글 폴더 스크린샷을 폐기했다. 기준 커밋은 `CMS-SPEC.md`, `CMS-V1-IMPLEMENTATION-PLAN.md`, `env.d.ts`만. CMS 구현은 이 문서와 명세에서 다시 시작한다. M0-INV-1은 대상 파일이 없어 CANCELLED.
- 2026-09-16: M0-INV-3 병합(`43e77e7`). 목록은 `CMS-CONTENT-INVENTORY.md`. 날짜 없음 0, status 없음 1, 빈 tags 1, 빈 alt 22장/상대 이미지 5파일, 표 4, 수식 2. 요약 JSX 숫자는 파일별 표와 달랐던 Tooltip/Callout만 Lead가 고침. M0-INV-2는 첫 CMS 코드와 같이 둔다. 다음 배치는 M1-TW-1(실패 테스트만).
- 2026-09-16: M1-TW-1 병합(`499fd96`). 구현 파일 없음. 공개 API는 테스트가 `analyze`/`toDocument`/`serialize`를 `@/cms/mdx`에서 import하는 형태로 고정. Lead가 표 단언 `x | 1` 연속 문자열을 셀 `x`/`1`로 바꿈(파싱된 표를 막지 않기 위함). 코드 펜스 안 `$$`는 블록 수식이 아님 — 실제 블록 수식은 `memos/js의-비동기-처리-메커니즘` 1파일. M1-ED-1 검증은 폐기된 `corpus.test.ts`/`source-toggle.test.ts`가 아니라 `roundtrip.test.ts`만. M0-INV-2(`pg`/`@tiptap`)는 serialize가 기존 remark/mdast로 가능하므로 Data·에디터 UI 전까지 미룸.
- 2026-09-16: M1-ED-1 1차 배정이 30분 한도로 실패했다. 슬롯은 유지. 남은 파일: `analyze.ts` `parse.ts` `expressions.ts` `frontmatter.ts`(이미 `serializeFrontmatter`) `jsx.ts` `registry.ts` `types.ts`. 없는 것: `toDocument`, `serialize`, `src/cms/mdx/index.ts`. `__probe.ts`는 디버그 스크립트라 삭제. 구현은 재작성하지 말고 이어서 완성한다.
- 2026-09-16: 사용자 요청으로 OpenMausBot 30분 핸드오프에 맞춰 M1-ED-1을 슬라이스한다. 한 배정에 한 슬라이스만. 같은 Editor 슬롯에 병렬 배정하지 않는다. 루틴도 다음 미완 슬라이스만 부여. 이미 나간 serialize 재배정은 취소하지 않는다.
- 2026-09-20: 승인된 의존성 결정을 반영해 `pg`는 M0-INV-2에서 선설치했다. 모든 `@tiptap` 패키지는 M1-ED-2 또는 첫 실제 에디터 구현이 사용할 때까지 지연해 미사용 의존성을 추가하지 않는다. M1-TW-2(`f0746a6`)와 M1-DA-1(`9d19f9f`)은 실 PostgreSQL 계약 13개 통과(0 skip, `CMS_TEST_DATABASE_URL`만)로 DONE; M1-ED-2와 M1-RV-1은 TODO.
- 2026-09-20: M1-ED-2(커밋 `53b1495`)와 M1-RV-1이 DONE되어 Milestone 1이 완료되었다. 전체 56 files/299 tests 및 typecheck 통과, Codex 최종 판정 OK. M1-ED-2는 프레임워크 독립적 변환기/토글 경계이므로 Tiptap이 필요하지 않았으며, 따라서 Tiptap은 첫 실제 시각 에디터 작업인 M3-FE-1로 유예한다.
- 2026-09-20: 사용자 승인으로 M2 계약과 소유권을 수정했다. M2-INV-1 완료(next-auth@5.0.0-beta.32), M2-BE-1은 READY(INV-1 후 독립 진행 가능). M2-TW-1이 READY 상태인 동안 M2-BE-2는 TODO 상태를 유지한다. M2-BE-2는 PostgreSQL을 수정하지 않는 순수 서비스/발행 준비로 고정하고, M2-TW-3(참조 계약 및 slug_conflict 실패 테스트)와 M2-DA-1(이를 통과하는 참조 DB 구현)을 새로 추가하여 실행 순서(TW-1 → BE-2; TW-1 → TW-3 → DA-1; TW-2 → DA-2; BE-1은 INV-1 이후 독립 진행 가능; BE-3은 BE-1, BE-2, DA-1 대기)를 바로잡았다. M2-TW-3은 TW-1 이후 TODO, M2-DA-1은 TW-3 이후 TODO, M2-DA-2는 TW-2 이후 TODO이다. M2-BE-3의 선행 조건으로 BE-1, BE-2, DA-1을 명시하고 API DTO 소유권을 배정했다. 이 실행을 위한 현재 그린 엔드포인트(green endpoint)는 M2-INV-1 DONE; TW-1/BE-2 green; TW-3/DA-1 real-DB green; TW-2/DA-2 real-DB green 이다. M2-INV-1 외의 향후 구현 태스크들은 아직 완료 처리하지 않는다.
- 2026-09-21: M2 코어 서비스 및 데이터베이스 계약(M2-TW-1, M2-BE-2, M2-TW-3, M2-DA-1, M2-TW-2, M2-DA-2)이 통합 브랜치에 병합·검증 완료되어 DONE으로 최신화했다. `src/cms` 테스트 스위트 전체(7 suites / 165 tests)가 PostgreSQL 실환경에서 0 skip으로 통과하며 `pnpm typecheck` 및 `pnpm build` 통과를 확인했다. M2-BE-3은 DA-1, BE-2 선행 충족으로 착수 가능(READY), M2-BE-1도 READY 상태다.
- 2026-09-21: Milestone 2의 전 작업(M2-BE-1, M2-BE-3, M2-BE-4, M2-BE-5, M2-FE-1, M2-FE-2, M2-RV-1) 1차 구현 후 oracle 독립 감사를 진행했다. 감사 결과 동일 출처/CSRF 검사 누락(H1), 엔트리 생성/수정과 폴더 이동의 비원자성으로 인한 버전 불일치(H2), 프론트엔드 URL 쿼리/에러 피드백/계층트리 미흡(H3), 폴더 낙관적 잠금 부재(H4) 등이 지적되어 M2를 IN_PROGRESS로 재오픈하고 피드백 반영 작업을 시작한다.
- 2026-09-21: oracle 감사 피드백을 반영했다(`778a1a8`). `validateSameOrigin` 동일 출처/CSRF 가드, 엔트리 생성/수정+폴더 배정 단일 트랜잭션, 폴더 `version` 컬럼과 `expectedVersion` 기반 428/409 낙관적 잠금, GitHub ID BigInt canonical 검증과 비인가 403 루프 방지, URL 쿼리 양방향 동기화와 AbortController 경합 방지, 계층형 폴더 트리를 구현했다. 이어서 reviewer 독립 재리뷰에서 폴더 이동 시 `entries.updated_at`에 정수(version)가 주입되는 P0 결함, `folder.version` 비열거 프로퍼티로 인한 직렬화 누락 P1, CSRF fail-closed 미흡 P1, preferences useEffect 중복 실행 P1이 지적되어 모두 반영했다(`f9aacab`). reviewer에 "중대한 위험 존재 여부"를 재문의해 "위험 없음" 판정을 받았고, 비차단 P2(검색 입력 시 매 키입력 API 호출)를 디바운스로 해소했다(`56b8675`). 최종 검증: 65 files/422 tests passed, `pnpm typecheck`, `pnpm build` 통과. M2 전 작업을 DONE으로 갱신한다.
- 2026-09-21: Milestone 3 핵심(옵션 2: M3-TW-1, M3-BE-1, M3-FE-1, M3-FE-2, M3-FE-4)을 구현·검증 완료했다. 
  1) 착수 전 oracle 자문을 통해 트랜잭션 및 Tiptap/IndexedDB 설계 고정.
  2) M3-TW-1: 11개 상태기계/예약/참조 롤백 계약 테스트 작성(`lifecycle.test.ts`).
  3) M3-BE-1: publish/archive/restore/schedule API 구현(`a225241`) → reviewer 지적(executeSchedulePublish의 슬러그 승격 및 참조 재검사 누락 P0) 반영(`963bf77`) → reviewer 재리뷰 "위험 없음" 승인.
  4) M3-FE-1 / M3-FE-2: Tiptap 3.31.3 설치, /admin/entries/[id]/edit 셸 마운트, 2초 idle/10초 max 자동저장, IndexedDB 백업, 409 충돌 비교/복사 UI 구현(`665a0f9`) → reviewer 지적(자동저장 stale closure P1) 반영(`6d83eef`) → reviewer 재리뷰 "위험 없음" 승인.
  5) M3-FE-4: 발행·예약·보관·삭제 UI 및 예약 모달 구현(`dc74ab4`).
  6) 최종 검증: 66 files/433 tests 100% 통과, typecheck 통과, build(71 routes) 통과. M3 해당 태스크들을 DONE으로 최신화한다.
- 2026-09-21: CMS 에디터 UI 전면 개편 및 작성 기능 통합(M3-ED-1, M3-ED-2)을 완료했다.
  1) 신규 작성 워크플로우: 팝업 모달 완전 폐기, `/admin/entries/new` 즉시 진입, 첫 입력 전까지 DB 레코드 미생성(Lazy Draft) 및 첫 입력 2초 idle 후 조용히 생성 후 `window.history.replaceState`로 URL 승격.
  2) Keystatic 스타일 3단 레이아웃: 좌측 네비 + 중앙 도화지형 캔버스 + 고정 Tiptap 서식 툴바(H1~H3, B, I, S, Code, List, Quote, CodeBlock, Divider) + 우측 shadcn 메타데이터 인스펙터 패널(Title, Slug 자동생성/수동수정 잠금/Regenerate, PublishDate, Description, Tags) 분리.
  3) M3-ED-1: 슬래시 메뉴(`/`) 및 블록 조작 핸들(위/아래 이동, 복제, 삭제)을 React Portal 오버레이로 구현. 한글 IME 조합 중 키 이벤트 가드 적용.
  4) M3-ED-2: 내부 링크(`[[`) 스마트 자동완성 연동. `/api/cms/v1/entries` 검색 및 키보드(ArrowDown/Up, Enter, ESC) 선택 지원.
  5) reviewer 전 단계 검수 및 P0 지적(stale closure, Enter 키 swallow) 반영 후 "위험 없음" 최종 승인.
  6) 최종 검증: 69 files/441 tests 100% 통과, `pnpm typecheck`, `pnpm build` 통과. M3-ED-1, M3-ED-2를 DONE으로 갱신한다.
- 2026-09-21: Milestone 3 미디어 업로드 파이프라인 및 에디터 이미지 연동(M3-INF-1, M3-BE-2, M3-ED-2, M3-FE-3)을 완료했다.
  1) 사전 oracle 자문: Cloudflare R2 presigned PUT 구조, SVG XSS 보안 차단, staging key -> Magic Byte 검증 -> final key 승격(`promoteFile`) 및 DB 무결성 설계 고정.
  2) M3-INF-1 / M3-BE-2: AWS SDK v3 기반 `R2MediaStore` 어댑터 구현 및 `/media/uploads`, `/media/:id/complete` API 구현. 10MiB 상한 및 실제 파일 헤더 검증(PNG/GIF/JPEG/WebP/AVIF 허용, SVG 거부). reviewer 1차 검수 "위험 없음" 승인 (`1573d3c`).
  3) M3-ED-2 / M3-FE-3: Tiptap 커스텀 `CmsImageNode` 및 React NodeView(`CmsImageNodeView`) 구현(너비, 정렬, Alt, Caption 인라인 조작). 에디터 내 클립보드 이미지 붙여넣기(Ctrl+V), 파일 드래그앤드롭, 슬래시 메뉴 및 툴바 이미지 삽입 버튼 연동, 업로드 진행률 프로그레스 바 구현.
  4) MDX `<Image mediaId="..." src="..." width="..." align="..." caption="..." />` 직렬화 및 역직렬화 왕복 테스트 통과.
  5) reviewer 2차 검수 지적(직렬화 시 `src` 누락 위험 P0, figure 블록 핸들 셀렉터 누락) 반영(`05a1e44`) 후 재리뷰 "위험 없음" 최종 승인.
  6) 최종 검증: 72 files/454 tests 100% 통과, `pnpm typecheck`, `pnpm build`(73 routes) 통과. Milestone 3 전 작업을 DONE으로 갱신한다.
- 2026-09-21: Milestone 4 미디어 라이브러리(M4-BE-MEDIA-1, M4-FE-1)를 구현·검증 완료했다.
  1) 백엔드 태스크 분리: 계획표에 M4-BE-MEDIA-1(미디어 목록 및 안전 삭제 API)을 정식 추가하고 M4-FE-1과의 선행 관계를 명시.
  2) M4-BE-MEDIA-1: `content-store.ts`에 `listMediaAssets` 및 `deleteMediaAsset` 구현. `GET /api/cms/v1/media`(파일명 검색, MIME 필터, 사용 여부 필터, 사용된 글 `entry_references` 조인 집계) 및 `DELETE /api/cms/v1/media/:id`(사용 중인 미디어 409 차단, 미사용 미디어 R2 storageKey/stagingKey 삭제 후 DB 레코드 삭제) 구현. 계약 테스트 작성 및 reviewer 1차 검수 "위험 없음" 승인 (`ed44c2d`).
  3) M4-FE-1: 사이드바에 미디어 메뉴 연동, `/admin/media` 미디어 라이브러리 화면 구현. 썸네일 그리드 뷰, 파일명 검색, 사용 여부(전체/사용 중/미사용) 필터링, 우측 미디어 상세 인스펙터 패널(공개 URL 복사, 해상도/크기, 사용처 글 목록 링크), 사용 중 미디어 삭제 버튼 비활성화 가드 및 미사용 고아 미디어 영구 삭제 UX 구현. reviewer 2차 검수 "위험 없음" 승인 (`1b83ced`).
  4) 최종 검증: 72 files/457 tests 100% 통과, `pnpm typecheck`, `pnpm build`(75 routes) 통과. M4-BE-MEDIA-1, M4-FE-1을 DONE으로 갱신한다.

---

## 0. 현재 코드베이스 조사 결과

### 0.1 이미 있고 재사용할 것

| 영역 | 위치 | 상태 |
| --- | --- | --- |
| 명세·계획 | `CMS-SPEC.md`, `CMS-V1-IMPLEMENTATION-PLAN.md` | 기준 문서 |
| env 타입 | `env.d.ts` | CMS DB/Auth/R2 키 이름만. 비밀값은 `.env.local`(gitignore) |
| 공개 렌더 | `src/components/mdx/**`, `src/libs/{annotation,chart,mermaid,shiki}` | 기존 블로그 경로 |
| 공개 조회 계약 | `src/libs/contents/contracts/repository.ts` | Keystatic 구현만 있음 |
| 관리자 UI 키트 | `src/components/ui/**`, cmdk, Radix, Tailwind, next-themes | `/admin`이 재사용 |
| 기존 콘텐츠 | `src/contents/**` | Keystatic MDX·YAML. 아직 DB가 원본이 아님 |

`src/cms/**`와 `docs/cms/**`는 없다. 2026-09-16에 미커밋 골격을 폐기했다.

### 0.2 없거나 미연결

- MDX 변환, 프레임워크 독립적 에디터 토글, PostgreSQL ContentStore는 구현됨; HTTP API, `/admin`, 실제 Tiptap 시각 UI는 없음
- `@tiptap/*`(M3-FE-1까지 미설치), Auth.js, S3/R2 클라이언트, IndexedDB 헬퍼
- `pg`는 설치됨; 공개 `ContentRepository`의 DB 구현은 없음. post/memo는 `dynamic = "force-static"`
- 이전 도구, OpenAPI, Keystatic 제거

### 0.3 구현 전에 확인해야 하는 불일치

1. 기존 관리자 인증은 Keystatic GitHub 로그인명(`NEXT_PUBLIC_KEYSTATIC_OWNER`)이다. CMS는 GitHub **숫자 ID**(`CMS_ADMIN_GITHUB_ID`)다.
2. `package.json`에 `pg`는 설치됐고 `@tiptap/*`는 없다. Tiptap은 M3-FE-1 또는 첫 실제 에디터 구현 배치에서만 추가한다.

### 0.4 재사용하고 다시 만들지 말 것

- 공개 MDX 컴포넌트·Shiki 주석·Chart DSL·Mermaid 파이프라인
- 코드 fence 주석 변환 (`src/libs/annotation/code-block`)
- 기존 `ContentRepository` 메서드 시그니처. 페이지가 기대하는 Post/Memo 타입은 호환 계층에서 맞춘다
- 컬렉션·필드·템플릿의 **명세 내용**(§6.3, §6.4). 코드는 다시 작성한다

---

## 1. Milestone 개요

명세 §12.1과 맞추되, 코드 현황 때문에 **M0(기준 고정)** 을 앞에 둔다.

| ID | 이름 | 명세 단계 | 종료 조건 |
| --- | --- | --- | --- |
| M0 | 기준 고정 | (선행) | spec·plan·`env.d.ts`가 통합 브랜치에 있고, 기존 콘텐츠 목록이 있으며, 워킹 트리에 폐기된 CMS 골격이 없다 |
| M1 | 핵심 검증 | §12.1-1 | 대표 MDX가 analyze→document→serialize→analyze로 의미를 보존하고, 실DB에서 초안/공개본 분리·충돌·롤백이 검증된다. 보기만 토글하면 원문 바이트가 유지된다 |
| M2 | 관리 기반 | §12.1-2 | GitHub 숫자 ID 1명만 `/admin`과 `/api/cms/v1`에 들어가고, 목록/폴더/관계/record 저장이 API로 동작한다 |
| M3 | 작성과 발행 | §12.1-3 | 편집 화면에서 자동 저장·충돌·원문 오류·발행·예약·이미지 업로드가 내용을 잃지 않는다 |
| M4 | 운영 기능 | §12.1-4 | 미디어 라이브러리, 일괄 작업, 복제/템플릿, 내보내기/시험 이전이 사용처·삭제 규칙을 지킨다 |
| M5 | 블로그 연결 | §12.1-5 | 공개 조회가 DB 공개본만 쓰고, 기존 49편 검수 보고서가 있으며, Keystatic 제거 준비와 전환 승인을 사용자에게 맡긴다 |

각 Milestone 병합 후 Reviewer가 통합 브랜치를 검수한다. 운영 데이터 이전과 공개 전환은 M5 보고서 이후 **사용자 승인**이 따로 필요하다.

---

## M0. 기준 고정

종료 조건: `feature/new-cms`에 spec·plan·`env.d.ts`가 있고, 기존 콘텐츠 목록(M0-INV-3)이 있다. `pg`는 M0-INV-2에서 고정했으며, `@tiptap/*`는 M3-FE-1 또는 첫 실제 시각 에디터 구현 배치에서만 추가한다.

### M0-INV-1 스키마 테스트와 마이그레이션 드리프트 확인

- **상태:** CANCELLED. 대상이던 `src/cms/adapters/postgres`를 폐기했다. 스키마와 제약은 M1-DA-1에서 명세 §9 기준으로 새로 작성하고, 그때 실DB 테스트를 붙인다.

### M0-INV-2 선언되지 않은 런타임 의존성

- **목적:** 실DB 테스트가 패키지 설치만으로 재현되게 하고, 에디터 의존성은 실제 사용 시점까지 지연한다.
- **주요 내용:** `pg` 8.23.0(runtime)과 `@types/pg` 8.23.1(dev)을 기존 Next 16 / React 19와 맞춰 설치·lockfile에 고정했다. 승인된 결정에 따라 모든 `@tiptap` 패키지는 M3-FE-1(첫 실제 시각 에디터) 구현 시점까지 추가하지 않는다. Auth.js·R2 SDK도 해당 Task에서 넣는다. 유료 Tiptap 패키지 금지.
- **선행:** M1-TW-2와 같은 배치(첫 실DB 테스트/코드)
- **영향 파일:** `package.json`, `pnpm-lock.yaml`
- **담당:** INF
- **완료 조건:** `pg` runtime/dev 타입이 설치됐고 postgres 하네스의 `import("pg")`가 성공한다. Tiptap 설치는 이 Task의 완료 조건이 아니다.
- **검증:** `pg` 8.23.0, `@types/pg` 8.23.1 설치 확인; postgres 실DB 계약 테스트 통과

### M0-INV-3 기존 콘텐츠 목록 재집계 (읽기 전용)

- **목적:** 이전 검수의 분모를 추측하지 않는다. 명세 §11.2는 구현 시 다시 세라고 했다.
- **주요 내용:** post/memo MDX 수, 이미지 경로(상대/외부), 표·수식·JSX 컴포넌트, slug, 카테고리/태그/모음집 관계, `publishedDateTimeISO` 유무를 표로 만든다. DB에 쓰지 않는다.
- **선행:** 없음
- **영향 파일:** `/Users/bh2980/Desktop/bh2980_blog/CMS-CONTENT-INVENTORY.md` (신규). `src/contents`는 읽기만
- **담당:** JR
- **완료 조건:** 파일 경로별 목록과 이슈 후보(빈 alt, 날짜 없음, 상대 이미지)가 있다.
- **검증:** 보고서 숫자가 `src/contents` 파일 수와 일치한다.

### M0-BASE-1 기준 문서 커밋

- **목적:** worktree가 명세·계획·env 타입을 공유하게 한다.
- **주요 내용:** `CMS-SPEC.md`, `CMS-V1-IMPLEMENTATION-PLAN.md`, `env.d.ts`만 `feature/new-cms`에 커밋. `.env.local`·비밀값·`src/cms`·`docs/cms`·스크린샷은 넣지 않는다.
- **선행:** 사용자 승인 (2026-09-16: spec·plan·env만, 나머지 폐기)
- **영향 파일:** 위 세 파일
- **담당:** Lead (작은 통합)
- **완료 조건:** 세 파일이 추적되고, 폐기한 경로는 워킹 트리에 없다.
- **검증:**
  - `git ls-files CMS-SPEC.md CMS-V1-IMPLEMENTATION-PLAN.md env.d.ts`가 세 파일을 나열한다
  - `git status --short`에 `src/cms`, `docs/cms`가 없다
  - `test ! -e src/cms && test ! -e docs/cms`

---

## M1. 핵심 검증

종료 조건: F10(공개 분리의 저장 측면)·F19(원문 토글)·이전 항의 “본문 의미 보존” 표본이 자동 테스트로 막힌다. 관리자 UI는 아직 없다.

파일 소유권: TW = `__test__`와 시험 하네스만. ED = `src/cms/mdx/**` (에디터 UI 제외). DA = `src/cms/adapters/postgres/**` 구현·마이그레이션 (`__test__` 제외).

### M1-TW-1 MDX 왕복 실패 테스트

- **목적:** serialize가 없을 때 실패하는 완료 조건을 먼저 고정한다.
- **주요 내용:** `analyze → document → serialize → analyze`. 코드 fence 주석 메타데이터, 중첩 Callout/Tabs/Columns, 표, 블록 수식, `src/contents` 기존 MDX 표본. 보기만 토글하면 원문 바이트 유지(§4.4).
- **선행:** M0-BASE-1
- **영향 파일:** `src/cms/mdx/__test__/roundtrip.test.ts` (신규). `src/contents`는 읽기만
- **담당:** TW
- **완료 조건:** serialize 미구현 시 테스트가 실패한다. 구현을 넣지 않는다.
- **검증:** `vitest run src/cms/mdx/__test__/roundtrip.test.ts`

### M1-TW-2 ContentStore 저장/공개 실패 테스트

- **목적:** 초안/공개본·버전·롤백의 **도메인** 동작을 구현 전에 고정한다. HTTP 상태 코드는 이 테스트에 넣지 않는다.
- **주요 내용:** 시험 하네스 `__test__/test-database.ts`는 테스트 전용으로 이 Task에서 새로 쓴다(`CMS_TEST_DATABASE_URL`만 읽음). `createEntry`, `saveWorking`(동일 내용이면 `updatedAt` 미변경), `publishEntry`(초안과 공개본 분리, `expectedVersion` 불일치 시 `CmsError` code `conflict` + `serverVersion`, 같은 해시 재발행은 공개본 미교체, 트랜잭션 실패 시 공개본 유지). Store 입력은 `expectedVersion`이 필수라 **버전 누락은 여기서 다루지 않는다**(M2-BE-3). skip되면 안 된다. 연결 문자열을 로그하지 않는다. `CMS_DATABASE_URL`을 읽지 않는다. `409`/`428`을 단언하지 않는다. **구현(`content-store.ts`, migrations)은 쓰지 않는다.**
- **선행:** M0-BASE-1, M0-INV-2
- **영향 파일:** `src/cms/adapters/postgres/__test__/content-store.test.ts`, `__test__/test-database.ts` (신규)
- **담당:** TW
- **완료 조건:** 실 PostgreSQL 계약 13개 테스트가 모두 통과하고 skip이 0이다. 초기 계약 커밋은 `b88a129`, `1b1900a`, 최종 테스트 커밋은 `f0746a6`이다.
- **검증:** `node --env-file=.env.local node_modules/vitest/vitest.mjs run src/cms/adapters/postgres/__test__/content-store.test.ts` → 13 passed, 0 skip; `CMS_TEST_DATABASE_URL`만 읽고 `CMS_DATABASE_URL`은 읽지 않음

### M1-ED-1 MDX serialize

- **목적:** DB에 저장할 원본 문자열을 문서 JSON에서 만든다. 30분 핸드오프 때문에 **한 배정에 아래 슬라이스 하나만** 준다.
- **주요 내용:** 일반 Markdown + 등록 JSX 컴포넌트 이름 유지. 코드/Mermaid/chart는 기존 언어 펜스. 주석 공백·범위 보존은 `src/libs/annotation/code-block` 재사용. 미지원 문법은 추측 변환하지 않는다. `TextAlign`/`Image`/`ContentLink` 계약(§4.4).
- **선행:** M1-TW-1
- **영향 파일:** `src/cms/mdx/` (슬라이스별 파일은 1a/1b/1c)
- **담당:** ED
- **완료 조건:** 1a·1b·1c가 모두 DONE. `roundtrip.test.ts` 전체 skip 없이 통과. 보기만 토글하면 `analyze.source`가 원문 바이트와 같고 serialize를 호출하지 않는다.
- **검증:** `pnpm test:run src/cms/mdx/__test__/roundtrip.test.ts`

#### M1-ED-1a toDocument + barrel (30분)

- **선행:** M1-TW-1. analyze 헬퍼가 슬롯에 있음.
- **영향 파일:** `src/cms/mdx/to-document.ts`, `src/cms/mdx/index.ts`. 기존 analyze 헬퍼는 재작성하지 않음.
- **완료 조건:** `import { analyze, toDocument, serialize } from "@/cms/mdx"`가 해석된다. `toDocument(analyze(mdx))`가 JSON 직렬화 가능한 `CmsNode` 문서를 반환한다. serialize는 1b에서 채워도 된다(스텁 허용). `__probe.ts` 삭제.
- **검증:** 모듈 resolve + `toDocument`가 object. 전체 roundtrip 통과는 요구하지 않음.

#### M1-ED-1b serialize (합성 픽스처, 30분)

- **선행:** M1-ED-1a (`index.ts`와 `toDocument` 존재)
- **영향 파일:** `src/cms/mdx/serialize.ts` (필요 시 to-document 보강만)
- **완료 조건:** `roundtrip.test.ts`에서 **「실제 src/contents 표본」 describe를 제외한** 코드 펜스·중첩 JSX·표·블록 수식·원문 토글·미지원·메타데이터 블록이 skip 없이 통과.
- **검증:** `pnpm test:run src/cms/mdx/__test__/roundtrip.test.ts -t "코드 펜스|중첩 JSX|표|블록 수식|원문 토글|미지원|메타데이터"`

#### M1-ED-1c 표본 9파일 왕복 (30분)

- **선행:** M1-ED-1b
- **영향 파일:** serialize/to-document 보강만. 테스트·콘텐츠 원문 수정 금지.
- **완료 조건:** 표본 9파일 `firstDoc`===`secondDoc`, analyze 오류 0.
- **검증:** `pnpm test:run src/cms/mdx/__test__/roundtrip.test.ts -t "실제 src/contents"`

### M1-ED-2 변환기를 에디터 토글에 연결

- **목적:** G1 토글이 mock이 아니라 실제 analyze/serialize를 쓰게 한다.
- **주요 내용:** `SourceConverter` 구현체를 `src/cms/mdx`에서 export. 에디터 패키지가 MDX 내부를 우회 import하지 않게 한 파일만 공개.
- **선행:** M1-ED-1
- **영향 파일:** `src/cms/mdx` public export, `src/cms/editor`는 얇은 연결만
- **담당:** ED
- **완료 조건:** 실제 변환기로 보기만 토글하면 원문 바이트가 같다. 시각 편집 후에는 의미 보존 정규화를 허용한다.
- **검증:** 에디터 테스트에 실제 converter fixture 추가

### M1-DA-1 ContentStore create/save/publish 실DB 검증

- **목적:** PostgreSQL ContentStore를 명세 §9대로 **새로** 작성한다. 범용 repository를 만들지 않는다.
- **주요 내용:** M1-TW-2를 통과하도록 `createEntry`/`saveWorking`/`publishEntry`, 마이그레이션, 트랜잭션·버전 처리. 버전 불일치는 `CmsError` code `conflict` + `serverVersion`. HTTP 409/428 매핑은 하지 않는다.
- **선행:** M1-TW-2
- **영향 파일:** `src/cms/adapters/postgres/content-store.ts` (및 이 파일이 import하는 같은 폴더 헬퍼). 마이그레이션 변경이 필요하면 사용자에게 보고
- **담당:** DA
- **완료 조건:** M1-TW-2의 실DB 13개 테스트가 통과한다. working/published 분리, conflict, concurrency, rollback, slug alias/non-reuse, timestamps, JSON boundary를 커버하며 Codex Sol medium 최종 리뷰에서 이슈가 보고되지 않았다.
- **검증:** `node --env-file=.env.local node_modules/vitest/vitest.mjs run src/cms/adapters/postgres/__test__/content-store.test.ts` → 13 passed, 0 skip; `CMS_TEST_DATABASE_URL`만 사용

### M1-RV-1 Milestone 1 검수

- **목적:** 왕복·공개 분리만 승인한다.
- **선행:** M1-ED-2, M1-DA-1
- **담당:** RV
- **완료 조건:** 구체적 파일·재현으로 승인 또는 수정 요청.
- **검증:** 통합 브랜치에서 해당 vitest + 타입검사

---

## M2. 관리 기반

종료 조건: 로그인하지 않은 사용자와 다른 GitHub 계정은 관리자 API/화면에 못 들어간다. 컬렉션 목록·폴더·record 저장·관계 ID가 API로 동작한다. F01의 서버 목록/검색/필터, F02 폴더, F04의 Auth 경계, F08의 저장 측 참조.

### M2-BE-1 Auth.js GitHub 게이트웨이

- **목적:** Keystatic 로그인과 분리된 관리자 세션.
- **주요 내용:** Auth.js JWT 세션(8시간). `CMS_ADMIN_GITHUB_ID`만 허용. `AuthGateway` 구현. 콜백 `/api/auth/callback/github`. CSRF·동일 출처. DB 어댑터는 사용하지 않으며, JWT maxAge 28_800 롤링 세션과 불변의 GitHub 숫자 `profile.id`(10진수 문자열로 정규화)를 CMS 서버 경계마다 `CMS_ADMIN_GITHUB_ID`와 재검증한다. 프록시/미들웨어에만 권한 검사를 의존하지 않는다. 실행기 토큰은 이 Task에서 스텁만 (`authorizeExecutor`는 토큰 없으면 false).
- **선행:** M1-RV-1, M2-INV-1 (BE-1은 INV-1 이후 독립 진행 가능)
- **영향 파일:** `src/cms/adapters/auth/**` (신규), `src/app/api/auth/**`, Auth.js 설정. `src/libs/admin/verify-access.ts`는 Keystatic용이므로 아직 삭제하지 않음
- **담당:** BE
- **완료 조건:** 비로그인 401, 다른 GitHub ID 403, 허용 ID만 통과. 사용자명을 권한에 쓰지 않는다.
- **검증:** 게이트웨이 단위 테스트 + 라우트 테스트. 브라우저 로그인은 M2-FE-1에서

### M2-INV-1 Auth.js와 Next 16 호환

- **목적:** 패키지 메이저를 추측으로 고르지 않는다.
- **주요 내용:** 공식 App Router 패키지 후보로 `next-auth@5.0.0-beta.32`(Next 16/React 19 메타데이터 지원)를 조사·선정했다. 패키지는 사전에 설치하지 않고 실제 사용 시점인 M2-BE-1에서 의도적으로 설치하며, M2-BE-1 착수 직전에 최신 베타 버전 및 권고 사항을 다시 확인한다.
- **선행:** 없음 (M2-BE-1과 같은 배치에서 먼저)
- **담당:** INF
- **완료 조건:** M2-BE-1이 READY 상태가 되도록 증거와 결정을 남긴다.
- **검증:** 공식 문서 및 npm 메타데이터 조사:
  - 설치 안내: `https://authjs.dev/getting-started/installation?framework=Next.js`
  - 레퍼런스: `https://authjs.dev/reference/nextjs`
  - npm beta.32 메타데이터: `https://registry.npmjs.org/next-auth/5.0.0-beta.32`

### M2-BE-2 업무 서비스 — 초안 저장과 발행 준비

- **목적:** HTTP와 ContentStore 사이에 MDX 분석·컬렉션 검증·slug·참조 인덱스를 둔다. 완료 기준은 가짜(fake) Store 포트가 주입되었을 때 동작하는 실제 `ContentService` 구현과 순수(pure) 발행 검증/준비 로직이다. 이 단계에서는 PostgreSQL을 수정하지 않는다. (생산용 PostgreSQL 포트는 M2-DA-1에서 나중에 제공한다.)
- **주요 내용:** PreparedSnapshot 생성(analyze + hash + refs). 초안은 빈 제목/오류 MDX 허용, stale 참조 유지. frontmatter 규칙 구현: `analysis.frontmatter !== null`일 때 구조화된 발행 검증 오류(structured publish-validation issue)를 생성하여 발행 준비(publication readiness)를 거부한다. 단, `analyze()` 자체를 변경하지 않으며, frontmatter가 포함된 초안의 영속화(draft persistence)를 거부하지 않고 바이트 단위로 보존하여 저장한다. 발행 검증은 이 단계에 함수로만 두고 발행 API는 M3. slug NFC·금지문자(명세 §6.2). DB CHECK보다 넓은 거부는 서비스가 한다.
- **선행:** M2-TW-1 (TW-1 → BE-2)
- **영향 파일:** `src/cms/services/**` (신규). Store/에디터 파일 금지
- **담당:** BE
- **완료 조건:** 초안 저장 입력이 가짜 Store에 `PreparedSnapshot`으로 제대로 변환 전달된다. 허용 목록 밖 필드 거부. frontmatter 포함 초안 저장 보존 및 발행 검증 거부 통과.
- **검증:** 서비스 단위 테스트 (mock store 가능)

### M2-TW-1 순수 서비스/발행 검증 테스트

- **목적:** slug 예약/중복, 미발행 대상 링크의 발행 차단, frontmatter 발행 거부 규칙을 구현 전에 고정. 이 테스트는 M2-BE-2의 순수 서비스 동작만 다루며 skip/todo 없이 유지한다. 실제 발행 돌연변이(mutation)와 HTTP 422 상태 코드는 M3에서 다룬다.
- **주요 내용:** frontmatter가 포함된 초안은 바이트 단위로 보존(preserved byte-for-byte)되어 준비 및 저장(`prepare`/`save`)될 수 있으나, 구조화된 발행 검증 오류(structured publish-validation issue)를 발생시켜 발행 준비 상태(publication readiness)에서 거부됨을 테스트로 증명한다. 초안 영속화는 거부되지 않아야 한다.
- **선행:** M1-RV-1
- **영향 파일:** `src/cms/services/__test__/**`
- **담당:** TW
- **완료 조건:** 실패하는 테스트. 구현 없음.
- **검증:** vitest

### M2-TW-3 실DB 참조 계약 및 충돌 테스트

- **목적:** Store 수준의 작업 참조(working references) 처리, `slug_conflict` 에러 정규화, 작업 스냅샷과 참조 인덱스의 원자적 교체, 'stale' 참조 유지 기능을 실제 PostgreSQL에서 검증한다.
- **선행:** M2-TW-1 (TW-1 → TW-3)
- **영향 파일:** `src/cms/adapters/postgres/__test__/references.test.ts` (신규)
- **담당:** TW
- **완료 조건:** 실제 PostgreSQL 환경에서 0 skip으로 실행되며, 초기에는 구현이 없어 테스트가 RED(실패) 상태여야 한다. 오직 `CMS_TEST_DATABASE_URL`만 사용하며 `CMS_DATABASE_URL`은 절대 사용하지 않는다.
- **검증:** 실DB vitest 실행 후 실패 확인 (`CMS_TEST_DATABASE_URL`만 사용, 0 skip)

### M2-DA-1 참조 데이터베이스 및 Store API 구현

- **목적:** 최소한의 참조 테이블과 Store API를 구현하여 M2-TW-3 테스트를 통과시킨다. (이 포트가 M2-BE-3에서 엮인다.)
- **선행:** M2-TW-3 (TW-3 → DA-1)
- **영향 파일:** `src/cms/adapters/postgres/content-store.ts` 및 같은 폴더 헬퍼만 해당 (현재 마이그레이션은 임베디드 방식이며, 스키마 변경 시 보고 및 리뷰 필요)
- **담당:** DA
- **완료 조건:** M2-TW-3 테스트 통과 및 기존 ContentStore 회귀 테스트(13 passing)를 포함한 모든 실DB 테스트 통과.
- **검증:** M2-TW-3 및 기존 `content-store.test.ts` 전체 통과 (0 skip, `CMS_TEST_DATABASE_URL`만 사용)

### M2-BE-3 HTTP API 골격과 엔트리 CRUD

- **목적:** `/api/cms/v1`가 관리자 UI의 유일한 HTTP 계약이 되게 한다.
- **주요 내용:** `GET /meta`, `GET/POST /entries`, `GET/PATCH /entries/:id`. `src/cms/core/api.ts`에 누락된 DTO를 이 Task에서 생성하고 소유권을 갖는다. Store/서비스 `CmsError`를 HTTP로 옮긴다. OpenAPI는 이 Milestone에서 초안만, 완성은 M5. 공개 블로그는 이 라우트를 호출하지 않고 서비스를 직접 호출한다.
- **선행:** M2-BE-1, M2-BE-2, M2-DA-1 (BE-3은 BE-1, BE-2, DA-1 대기)
- **영향 파일:** `src/app/api/cms/v1/**`, 얇은 라우트 헬퍼, `src/cms/core/api.ts`
- **담당:** BE
- **완료 조건:** 인증된 클라이언트가 글을 만들고 초안을 저장한다. version 없이 PATCH하면 428 `version_required`, 낙관적 잠금 충돌(Store `conflict` + `serverVersion`) 시 409, `slug_conflict` 시 409.
- **검증:** Route Handler 테스트에서 missing version => 428 `version_required`, optimistic Store conflict with `serverVersion` => 409, `slug_conflict` => 409 HTTP 매핑을 단언한다. Store 테스트에 상태 숫자를 넣지 않는다.

### M2-DA-2 폴더·목록 쿼리 실DB 보강

- **목적:** F01 서버 검색/필터/정렬과 F02 폴더 제약을 Store에서 막는다.
- **주요 내용:** `listEntries` 검색(제목·slug·선택적 본문 ILIKE), 필터 AND/OR, 페이지, 폴더 CRUD·순환 거부·삭제 시 글/자식 이동. `updatedAt`은 폴더 이동에 안 바뀐다.
- **선행:** M2-TW-2 (TW-2 → DA-2)
- **영향 파일:** `content-store.ts` 및 관련 파일
- **담당:** DA 구현, TW 테스트 선행 (`M2-TW-2`)
- **완료 조건:** 형제 이름 중복 거부, 폴더 삭제가 글을 지우지 않음, 목록 페이지에 누락/중복 없음. M2-TW-2 통과 및 기존 모든 ContentStore 회귀 테스트 통과.
- **검증:** 실DB vitest (`CMS_TEST_DATABASE_URL`만 사용, 0 skip)

### M2-TW-2 폴더·목록 실패 테스트

- **목적:** 리스트 항목과 폴더 제약 실패 테스트를 분리해서 구현 전에 고정한다.
- **선행:** M1-DA-1
- **영향 파일:** `src/cms/adapters/postgres/__test__/list-entries.test.ts`, `src/cms/adapters/postgres/__test__/folders.test.ts` (TW가 테스트 파일 소유, schema.test.ts 수정 금지)
- **담당:** TW
- **완료 조건:** 실제 PostgreSQL 대상, 0 skip, `CMS_TEST_DATABASE_URL`만 사용하며 구현 부재 상태에서 초기에 RED(실패) 상태 유지. `schema.test.ts` 수정 금지. 글로벌 DB 리소스를 닫지 않도록 스위트 로컬(suite-local) 풀/정리(cleanup) 요구사항을 포함해야 한다. (동시 실행 시 리소스 충돌 방지)

### M2-BE-4 record 컬렉션과 관계 API

- **목적:** 태그/카테고리/모음집은 저장 즉시 반영. 관계 필드는 ID.
- **주요 내용:** record workflow 저장, 사용처 조회 `GET /entries/:id/relations`, 사용 중 휴지통 이동 거부. 모음집 메타데이터 통신 키는 정규 `itemIds`를 사용하며 게시글(post) 대상 순서를 유지한다(ordered post-only target semantics).
- **선행:** M2-BE-3, M2-DA-2
- **영향 파일:** services + `/entries/:id/relations`, record save 경로
- **담당:** BE
- **완료 조건:** 태그 slug를 바꿔도 글의 관계 ID가 유지된다. 사용 중 태그는 삭제 거부.
- **검증:** API/서비스 테스트

### M2-FE-1 `/admin` 셸과 컬렉션 목록

- **목적:** F01 목록 화면의 첫 사용 가능한 형태.
- **주요 내용:** `/admin` 레이아웃, GitHub 로그인 화면, 왼쪽 컬렉션/폴더 트리, 오른쪽 테이블(기본 컬럼, 검색, 상태 필터, 수정일 정렬, 25/50/100). URL에 폴더·검색·필터·정렬·페이지. 컬럼 설정은 preferences API가 생기면 연결 (preferences는 M2-FE-2). 한국어 UI, 기존 토큰, 1280px 기준, 1024px에서 패널 접기.
- **선행:** M2-BE-3, M2-DA-2
- **영향 파일:** `src/app/(admin)/admin/**` (Keystatic 라우트는 아직 유지)
- **담당:** FE
- **완료 조건:** 로그인 후 post/memo 목록이 DB에서 온다. 빈/로딩/오류 구분. 색상만으로 상태를 전달하지 않음.
- **검증:** 컴포넌트 테스트 + 브라우저에서 목록/필터/페이지

### M2-FE-2 폴더 트리와 목록 설정 저장

- **목적:** F02 UX + 컬럼/페이지 크기 기억.
- **선행:** M2-FE-1, folders API, `GET/PUT /preferences`
- **영향 파일:** admin 사이드바·폴더 메뉴. preferences 라우트는 BE 작은 Task `M2-BE-5`
- **담당:** FE
- **완료 조건:** 하위 폴더 생성/이름/이동, 글 드래그 이동이 수정일을 바꾸지 않음. 새로고침 후 컬럼 설정 유지.
- **검증:** 브라우저 + API

### M2-BE-5 preferences API

- **선행:** M2-BE-1
- **담당:** JR (기존 DTO `preferencesBodySchema` 그대로)
- **영향 파일:** `/api/cms/v1/preferences`, ContentStore get/savePreferences 연결
- **완료 조건:** 관리자 ID별로 분리. 크기 제한.
- **검증:** 라우트 테스트

### M2-RV-1 Milestone 2 검수

- **선행:** M2-FE-2, M2-BE-4
- **담당:** RV

---

## M3. 작성과 발행

종료 조건: F03 날짜, F05 업로드 계약, F06/F17 블록 조작, F10 상태/예약, F11 자동 저장, F15 발행 검증, F16 내부 링크, F18 정렬/이미지 크기, F19 원문. 저장 실패·충돌·원문 오류에서 본문이 사라지지 않는다.

### M3-TW-1 발행·상태·예약·날짜 테스트

- **목적:** 상태기계와 날짜 표, 공개 참조(published-reference) 계약을 구현 전에 고정.
- **주요 내용:** §5.3 전환, §5.5 날짜, 예약 잠금/중복 실행/이른 호출, 같은 해시 재발행. HTTP 428/409/422. 공개 참조 소유권 테스트 추가: 작업 참조와 공개 참조의 분리(working/published reference separation), 발행 시 트랜잭션 내 대상 재검사 및 공개 참조 복사(transactional target recheck and copy during publish), 트랜잭션 실패 시 이전 발행 본문(prior published body)과 이전 발행 참조(published references)를 온전히 보존하는 롤백(rollback preserving prior published body and published references on failure)을 검증한다.
- **선행:** M2-RV-1
- **영향 파일:** services 및 postgres `__test__` (TW 소유 테스트 파일)
- **담당:** TW
- **완료 조건:** 실패하는 테스트. 구현 없음.

### M3-BE-1 발행·보관·휴지통·예약 API

- **목적:** 명시적 발행으로만 공개본을 교체한다.
- **주요 내용:** validate/publish/archive/unarchive/trash/restore/DELETE, schedule CRUD, `GET /schedules/due`, `POST /schedules/:id/publish` (실행기 토큰). 실행기 미연결 시 관리자 표시용 플래그. `CMS_SCHEDULER_TOKEN` 없으면 실행 API 403 + UI “외부 실행기 연결 필요”. 공개 참조 소유권 구현: 단일 발행 트랜잭션 내에서 대상 재검사, 작업 참조를 공개 참조로 복사, 그리고 실패 시 이전 발행 본문과 이전 발행 참조를 그대로 보존하는 원자적 롤백을 소유하고 구현한다.
- **선행:** M3-TW-1, M2-BE-2
- **영향 파일:** services + `/api/cms/v1/entries/**`, `/schedules/**`
- **담당:** BE
- **완료 조건:** M3-TW-1 통과. 보관 글은 공개 조회에서 빠진다. 트랜잭션 실패 시 이전 공개 본문 및 공개 참조 보존.
- **검증:** 실DB + 라우트 테스트

### M3-FE-1 편집 화면 셸 (필드 + 에디터 마운트)

- **목적:** 본문 집중 편집 레이아웃.
- **주요 내용:** 제목, 접는 탐색/속성, 시각·MDX 토글, 저장/발행 버튼, 저장 상태 자리. Tiptap G1 + M1 변환기. 슬래시 메뉴는 M3-ED-1 이후.
- **선행:** M2-FE-1, M1-ED-2, M2-BE-3
- **영향 파일:** `src/app/(admin)/admin/**/edit/**`, 에디터 래퍼. `src/cms/editor` 코어는 ED만
- **담당:** FE
- **완료 조건:** 글 열기, 원문 토글, 속성 필드 표시. 자동 저장은 다음 Task.
- **검증:** 브라우저 1280/1024

### M3-FE-2 자동 저장과 IndexedDB 복구

- **목적:** F11.
- **주요 내용:** 2초 idle / 10초 상한, IME 중 지연, 문서당 1 inflight, changeSeq, 상태 문구 6종, 이탈 경고, 충돌 화면(덮어쓰기 금지, 양쪽 복사). IndexedDB 키 = 관리자ID+콘텐츠ID.
- **선행:** M3-FE-1
- **영향 파일:** admin 편집 클라이언트 상태. 에디터 스키마 파일 금지
- **담당:** FE
- **완료 조건:** 새로고침 후 미저장 복구 안내. 서버가 바뀌면 충돌 UI. 동일 내용 저장은 요청 생략(서버 규칙과 맞춤).
- **검증:** 브라우저: 입력, 새로고침, 오프라인, 두 탭 충돌

### M3-ED-1 슬래시 메뉴·명령 검색·블록 핸들

- **목적:** F06, F17.
- **주요 내용:** 빈 문단 `/`, 한글/영문 검색, 핸들 위·아래·복제·삭제, 키보드만으로 가능. 복제 시 블록 ID 갱신, 미디어/글 ID 유지. 기존 Keystatic PM 플러그인을 이식하지 말고 Tiptap 확장으로 구현. 재사용 가능한 동작만 `src/keystatic/plugins/pm`에서 읽어서 참고.
- **선행:** M1-ED-2
- **영향 파일:** `src/cms/editor/**` (FE 편집 페이지는 메뉴 컴포넌트만)
- **담당:** ED
- **완료 조건:** 중첩 블록이 부모가 허용하는 구조 안에서만 이동. 코드 영역에서 본문 단축키가 입력과 싸우지 않음.
- **검증:** 에디터 단위/jsdom + 브라우저 IME

### M3-ED-2 내부 링크와 이미지 노드 UX

- **목적:** F16, F18의 에디터 쪽.
- **주요 내용:** `[[` 및 링크 메뉴 → ContentLink(ID). 이미지 너비 px/%, 정렬, alt/caption은 삽입 위치 속성. 라이브러리 재사용은 M4 미디어와 맞출 인터페이스만.
- **선행:** M3-ED-1, 엔트리 검색 API (목록 search)
- **영향 파일:** `src/cms/editor/**`
- **담당:** ED
- **완료 조건:** 링크 문구는 삽입 시점 제목, 이후 대상 제목 변경에 자동 치환되지 않음.
- **검증:** 에디터 테스트

### M3-INF-1 R2 MediaStore

- **목적:** F05 업로드 계약의 파일 쪽.
- **주요 내용:** `prepareUpload` 서명 URL, `headFile`, `publicUrl`, `deleteFile`. 브라우저에 비밀키 없음. CORS는 사용자/INF가 버킷에 이미 넣었는지 확인만.
- **선행:** M2-BE-1 (인증된 업로드 API가 필요하므로 M3-BE-2와 함께)
- **영향 파일:** `src/cms/adapters/r2/**` (신규). ContentStore 미디어 메타는 DA가 이미 구현
- **담당:** INF 또는 BE. 파일 저장 모듈이라 INF, API 연결은 BE `M3-BE-2`
- **완료 조건:** 자격 증명 없이 head/put/delete 단위 테스트(mock). 실제 버킷 확인은 수동 1회.
- **검증:** mock + 선택적 실버킷 smoke (비밀값 로그 금지)

### M3-BE-2 미디어 업로드 API

- **목적:** 준비 → 클라이언트 직접 PUT → complete → ready.
- **주요 내용:** `/media/uploads`, `/media/:id/complete`, MIME/크기 서버 재검증. 실패 시 ready 아님. 본문 중계 금지.
- **선행:** M3-INF-1, M2-BE-1
- **영향 파일:** `/api/cms/v1/media/**`, services
- **담당:** BE
- **완료 조건:** 위조 MIME·10MiB 초과 415/413. 완료 전 발행 차단은 M3-BE-1 발행 검증과 연결.
- **검증:** API 테스트

### M3-FE-3 편집기 이미지 삽입과 업로드 진행 UI

- **선행:** M3-BE-2, M3-ED-2, M3-FE-1
- **담당:** FE
- **영향 파일:** admin 편집 화면만
- **완료 조건:** 드롭/붙여넣기/파일 선택 시 자리 유지, 실패 상태로 발행 버튼 차단.
- **검증:** 브라우저

### M3-FE-4 발행·예약·상태 UI

- **선행:** M3-BE-1, M3-FE-2
- **담당:** FE
- **완료 조건:** 발행 검증 오류가 필드/본문 위치로 연결. 예약 중 본문 잠금, 해제 후 편집. 실행기 없으면 “연결 필요”/지난 예약은 “실행 대기”.
- **검증:** 브라우저

### M3-RV-1 Milestone 3 검수

- **담당:** RV
- **선행:** M3-FE-2, M3-FE-4, M3-ED-1, M3-BE-2

---

## M4. 운영 기능

종료 조건: F07 확장 예제, F09 일괄, F13 복제/템플릿, F14 라이브러리, §11.3 1–6의 **시험** 이전 도구. 운영 전환은 하지 않는다.

### M4-BE-MEDIA-1 미디어 목록 및 안전 삭제 API

- **목적:** F14 미디어 라이브러리 백엔드 지원.
- **주요 내용:**
  - `GET /api/cms/v1/media`: 썸네일, 파일명 검색, MIME 형식 필터, 사용 여부 필터, 사용된 글(`entry_references`) 개수 및 참조 중인 글 상세 정보(`references: { entryId, title, collection, state }[]`) 조인 반환.
  - `DELETE /api/cms/v1/media/:id`: 미디어 삭제 API. `entry_references`에 사용 중인 미디어(초안/공개본)는 409 Conflict 에러로 안전하게 삭제 차단. 미사용 미디어는 R2 스토리지 파일 삭제(`deleteFile`) 후 DB `media_assets` 레코드 삭제.
- **선행:** M3-BE-2
- **영향 파일:** `/api/cms/v1/media/**`, `src/cms/adapters/postgres/content-store.ts`
- **담당:** BE
- **완료 조건:** 사용 중인 미디어 삭제 시 409 및 참조 글 목록 반환. 미사용 미디어 삭제 시 R2+DB 동시 정리. 계약 테스트 통과.
- **검증:** API 계약 테스트

### M4-FE-1 미디어 라이브러리

- **목적:** F14.
- **주요 내용:** 썸네일, 검색, 형식/날짜/사용 여부, 상세(원본/공개 용량, 사용처 초안/공개본), 기본 alt/caption 수정이 기존 본문을 바꾸지 않음, 사용 중 삭제 거부, deleting 재시도.
- **선행:** M4-BE-MEDIA-1
- **영향 파일:** `/admin` 미디어 컬렉션 화면
- **담당:** FE
- **완료 조건:** 사용 중 삭제 시도가 사용처로 안내. 미분석 초안이 있으면 삭제 보류 메시지.
- **검증:** 브라우저 + API

### M4-BE-1 일괄 작업 API

- **목적:** F09.
- **주요 내용:** `POST /bulk`, 최대 100, 항목별 version, 항목 단위 원자성, 예약 중은 거부. 태그/카테고리는 초안에만, 공개본은 발행 통해.
- **선행:** M3-BE-1, M2-TW 일괄 테스트 (`M4-TW-1`)
- **영향 파일:** services + `/api/cms/v1/bulk`
- **담당:** BE
- **완료 조건:** 일부 실패가 전체 성공으로 안 보인다. 실패 항목만 재실행 가능.
- **검증:** API 테스트

### M4-TW-1 일괄·복제 실패 테스트

- **선행:** M3-BE-1
- **담당:** TW
- **영향 파일:** services `__test__`

### M4-BE-2 복제와 템플릿 생성

- **목적:** F13.
- **주요 내용:** `POST /entries/:id/duplicate`, `POST /entries`의 `templateId`. 새 ID, slug 빈 값, 상태/일정/공개본/날짜 비복사, 같은 폴더, 미디어 재업로드 없음. 템플릿은 코드 정의만.
- **선행:** M4-TW-1
- **담당:** BE
- **완료 조건:** 복제 글이 초안이고 원본 공개본과 무관.
- **검증:** API 테스트

### M4-FE-2 목록 일괄 메뉴와 새 글 템플릿

- **선행:** M4-BE-1, M4-BE-2, M2-FE-1
- **담당:** FE
- **완료 조건:** 현재 페이지 선택만. 새 글에서 빈 글/템플릿 3종.
- **검증:** 브라우저

### M4-ED-1 필드·블록 확장 예제 (F07)

- **목적:** 코어를 수정하지 않고 필드/블록을 붙이는 경로를 문서와 최소 예제로 닫는다.
- **주요 내용:** 색상 필드, slug 보조 버튼(`renderDefault`), 링크 object 필드, 코드 fence `defineBlock` 연결. 기존 `fields.ts`/`blocks.ts` API 사용. 마켓/로더 없음.
- **선행:** M3-FE-1, M1-ED-1
- **영향 파일:** `src/cms/core` 예제 등록, `docs/cms/extensions.md` (신규 문서만)
- **담당:** ED + FE (입력 컴포넌트)
- **완료 조건:** 예제 필드가 저장·재열기된다. React 함수가 `/meta` JSON에 안 실림 (기존 contracts.test).
- **검증:** 계약 테스트 + 수동 저장/재열기

### M4-BE-3 내보내기 API

- **목적:** §11.4 관리자 내보내기.
- **주요 내용:** manifest + 초안/공개본 MDX/JSON + ID/관계/폴더/미디어 목록. 바이너리는 목록만.
- **선행:** M3-BE-1
- **담당:** BE
- **완료 조건:** 인증된 GET/POST `/export`. 초안이 공개 스키마로 안 나감.
- **검증:** 픽스처 export 스냅샷

### M4-BE-4 기존 콘텐츠 시험 가져오기 (쓰기 전 검사 포함)

- **목적:** §11.3 단계 1–4를 시험 DB에서 수행.
- **주요 내용:** 읽기 전용 보고서(M0-INV-3 갱신), 안정 ID 매핑, 재실행 시 중복 생성 없음, 공개 글은 working+published, 날짜 없으면 null, `importedAt`. 운영 DB 금지.
- **선행:** M0-INV-3, M1-DA-1, M1-ED-1
- **영향 파일:** `src/cms/migrate-from-files/**` (신규 스크립트)
- **담당:** BE + DA (Store imported 경로 이미 있음)
- **완료 조건:** 시험 스키마에 기존 post/memo/tag/category/collection이 올라가고 공개 slug가 유지된다. 원본 파일은 그대로.
- **검증:** 시험 DB 카운트 vs 파일 목록, slug 집합 비교

### M4-ED-2 이전 본문 왕복 검수 러너

- **목적:** §11.3 단계 5. 표본이 아니라 전편.
- **주요 내용:** 모든 MDX analyze→serialize→analyze→공개 렌더 안전 검사. 정규화 vs 손실을 구분한 보고서.
- **선행:** M1-ED-1, M4-BE-4
- **영향 파일:** `src/cms/mdx/__test__/corpus-roundtrip.test.ts` 또는 스크립트
- **담당:** ED
- **완료 조건:** 실패 목록이 비거나, 남은 항목이 전환 차단 이슈로 분류된다.
- **검증:** CI에서 러너 실행

### M4-RV-1 Milestone 4 검수

- **담당:** RV

---

## M5. 블로그 연결과 전환 준비

종료 조건: 공개 페이지가 DB 공개본만 보여주고, 보관/휴지통/초안이 RSS·sitemap·OG·목록에 없다. 전환 보고서가 있다. Keystatic **제거는 사용자 전환 승인 후** 별 Task. 이 Milestone에서 제거 준비와 플래그만 한다.

### M5-INV-1 공개 페이지 캐시/동적 렌더 조사

- **목적:** Next 16에서 `force-static` + `generateStaticParams`를 요청 시 DB 조회로 바꿀 때 캐시가 초안/보관을 남기지 않는지 확인.
- **주요 내용:** post/memo/sitemap/rss/og 경로의 캐시 경계를 읽고, `force-dynamic` 또는 동등한 “공개 여부 항상 재확인” 안을 적는다. Vercel 전용 ISR을 필수로 두지 않는다.
- **선행:** 없음
- **담당:** BE
- **완료 조건:** 적용할 페이지 파일 목록과 캐시 설정이 명시된다.
- **검증:** 문서. 구현은 M5-BE-1

### M5-BE-1 Postgres ContentRepository

- **목적:** 기존 `ContentRepository`를 DB 공개본으로 구현. 페이지 타입은 유지.
- **주요 내용:** `getContentRepository()`가 CMS 공개 조회 서비스를 쓰게. 초안 없음. 별칭은 308에 해당하는 정규 slug 정보. DB 장애는 5xx/일시 오류, 404로 위장 금지.
- **선행:** M5-INV-1, M3-BE-1, M4-BE-4
- **영향 파일:** `src/libs/contents/repositories/postgres.ts` (신규), `get-content-repository.ts`. 기존 keystatic repo는 전환 전까지 유지
- **담당:** BE
- **완료 조건:** 플래그 또는 명시적 교체로 시험 요청이 DB를 읽는다. 페이지 컴포넌트는 repository만 본다.
- **검증:** repository 테스트 + 페이지가 초안 slug에 404

### M5-BE-2 공개 라우트 동적화 (RSS, sitemap, 목록, 상세)

- **선행:** M5-BE-1, M5-INV-1
- **담당:** BE
- **영향 파일:** `src/app/(blog)/**`, `rss.xml/route.ts`, `sitemap.ts`
- **완료 조건:** 새 발행이 재배포 없이 다음 요청에 보인다. 보관 글은 목록·RSS·sitemap에서 제외, 주소 404.
- **검증:** 시험 DB에서 발행/보관 후 요청

### M5-FE-1 인증된 미리보기

- **목적:** 공개 상태를 바꾸지 않는 미리보기.
- **선행:** M2-BE-1, M5-BE-1
- **담당:** FE
- **영향 파일:** 기존 `src/app/(blog)/(content)/preview/**`를 CMS 세션에 연결하거나 교체
- **완료 조건:** 비로그인은 미리보기 불가. 미리보기가 발행하지 않음.
- **검증:** 브라우저

### M5-BE-3 공개 HTTP `/public/entries`

- **목적:** 제공자 독립 공개 계약. 외부용.
- **선행:** M5-BE-1
- **담당:** JR (서비스 재사용, 새 규칙 없음)
- **영향 파일:** `/api/cms/v1/public/**`
- **완료 조건:** 공개 스키마만. 관리자 필드·초안 없음.
- **검증:** 계약 테스트 (`toPublicEntry`와 동일 규칙)

### M5-BE-4 OpenAPI와 확장 문서

- **선행:** M2–M4 API가 안정된 뒤
- **담당:** BE
- **영향 파일:** `docs/cms/openapi.yaml` 또는 동등, `docs/cms/extensions.md` 보강
- **완료 조건:** §10.1 표의 경로가 문서에 있고 예제가 있다.
- **검증:** 문서 ↔ 라우트 목록 대조

### M5-SEC-1 권한·MDX 실행 경로 검수

- **목적:** 권한/공개 완료 기준 + §4.4 서버 허용 규칙.
- **선행:** M2-BE-1, M5-BE-1
- **담당:** Security QA
- **완료 조건:** 비로그인 쓰기 불가, 실행기 토큰으로 콘텐츠 쓰기 불가, 검증 안 된 MDX가 실행 컴파일러로 안 감.
- **검증:** 독립 보고서. Lead가 수정 배정

### M5-TW-1 전환 차단 회귀 테스트

- **목적:** 파서 왕복, 원자적 발행, 참조/주소, 인증, 예약 중복, 저장 충돌.
- **선행:** M4-ED-2, M3-BE-1, M2-BE-1
- **담당:** TW
- **완료 조건:** 핵심 경계 회귀가 CI에 남는다. 스타일 스냅샷 양산 없음.
- **검증:** `pnpm test:run` 해당 경로

### M5-LEAD-1 전환 보고서와 사용자 승인 게이트

- **목적:** 운영 이전·Keystatic 제거를 구현 완료와 혼동하지 않는다.
- **주요 내용:** 미해결 오류, 주소 비교, 이미지 체크섬, 남은 Keystatic 의존. 승인 전까지 기존 읽기 경로 유지.
- **선행:** M5-BE-2, M4-ED-2, M5-SEC-1
- **담당:** Lead
- **완료 조건:** 사용자가 전환을 승인하거나 보류한다. 승인 없이 Keystatic을 제거하지 않는다.

### M5-BE-5 Keystatic 제거 (전환 승인 후)

- **목적:** 명세 교체 완료.
- **주요 내용:** 패키지·lockfile·`src/app/(admin)/keystatic`·`src/app/api/keystatic`·`src/keystatic/**`·patches·전용 env. 공개 렌더에 필요한 범용 MDX는 `src/components/mdx`, `src/libs`에 남긴다. 콘텐츠 원본 파일은 백업으로 유지할지 사용자 확인.
- **선행:** M5-LEAD-1 사용자 승인
- **담당:** BE + INF
- **완료 조건:** 검색·설치·빌드·테스트에 Keystatic이 없다. 공개 주소와 본문 의미가 유지된다.
- **검증:** `pnpm typecheck`, `pnpm test:run`, `pnpm build`, 저장소 검색

### M5-RV-1 최종 검수

- **담당:** RV
- **선행:** M5-BE-2, 전환 후에는 M5-BE-5

---

## 2. 전체 Milestone 순서

```text
M0 기준 고정
 → M1 핵심 검증 (MDX serialize + ContentStore 실DB)
 → M2 관리 기반 (Auth + API + 목록/폴더)
 → M3 작성과 발행 (에디터 화면 + 자동저장 + 발행/예약 + 업로드)
 → M4 운영 (라이브러리, 일괄, 복제, 시험 이전)
 → M5 공개 조회 전환 → 보고서 → (사용자 승인) → Keystatic 제거
```

한 단계를 “v1 완료”로 부르지 않는다.

---

## 3. Critical Path

다음이 막히면 전체가 멈춘다.

1. M0-BASE-1 기준 문서 커밋  
2. M0-INV-2 `pg` (실DB 테스트 전)  
3. M1-TW-1 → M1-ED-1 serialize  
4. M1-TW-2 → M1-DA-1 실DB 저장/공개  
5. M2 기반 흐름: TW-1 → BE-2; TW-1 → TW-3 → DA-1; TW-2 → DA-2; BE-1은 INV-1 이후 독립 진행 가능
6. M2-BE-3 HTTP (BE-3은 BE-1, BE-2, DA-1 대기)
7. M3-FE-2 자동 저장 (내용 유실 방지)  
8. M3-BE-1 발행/예약  
9. M4-BE-4 시험 이전 + M4-ED-2 전편 왕복  
10. M5-BE-1/2 공개 조회 전환  
11. M5-LEAD-1 사용자 전환 승인  
12. M5-BE-5 Keystatic 제거  

Auth·serialize·실DB 공개 분리·이전 왕복·공개 조회 교체 중 하나라도 실패하면 다음 Milestone으로 가지 않는다.

---

## 4. 병렬 가능한 Task

파일 소유권이 겹치지 않을 때만 같은 worktree 배치로 돌린다.

| 배치 | 병렬 | 금지 |
| --- | --- | --- |
| M0 | INV-3(JR) 완료. INV-2는 `pg`만 설치해 DONE; Tiptap은 M3-FE-1까지 지연 | INV-1 CANCELLED |
| M1 | TW-1과 TW-2는 테스트 파일만 병렬. 구현은 테스트 병합 후 ED-1 ∥ DA-1 | ED와 DA가 같은 파일 |
| M2 | BE-1은 INV-1 이후 독립 진행 가능 ∥ TW-1 → BE-2 ∥ TW-1 → TW-3 → DA-1 ∥ TW-2 → DA-2. BE-3은 BE-1, BE-2, DA-1 대기. BE-5(preferences) ∥ FE는 API 이후 | FE가 API 전에 화면만 그려도 되나 완료는 API 연결 후. TW 테스트 완료 전에 구현 착수 금지 |
| M3 | ED-1(에디터) ∥ BE-1(발행 API) ∥ INF-1(R2). FE-1은 API+에디터 마운트 후 | FE와 ED가 `src/cms/editor` 동시 수정 |
| M4 | FE-1 라이브러리 ∥ BE-1 일괄 ∥ BE-2 복제 (테스트 병합 후) . BE-4 이전은 serialize 이후 | 이전 스크립트가 editor 코어를 수정 |
| M5 | INV-1 ∥ SEC는 공개 조회 구현과 일부 겹침 → 조회 병합 후 SEC | Keystatic 제거와 공개 조회를 동시에 |

Senior는 코딩 슬롯 없음. Reviewer는 통합 브랜치만.

---

## 5. 초기에 검증해야 하는 기술 위험

| 위험 | 왜 지금 | 담당 Task |
| --- | --- | --- |
| `@tiptap/*`의 조기 설치 | 실제 에디터 구현 전에는 쓰이지 않아 미사용 의존성만 증가 | M3-FE-1 |
| MDX serialize 의미 손실 (코드 주석, 중첩 JSX) | 저장 원본이 MDX라 왕복이 안 되면 에디터/이전 전부 중단 | M1-TW-1, M1-ED-1 |
| 초안 저장이 공개본을 덮음 | F10 핵심. Store를 처음부터 실DB로 검증 | M1-TW-2, M1-DA-1 |
| Auth.js × Next 16 | 패키지 선택이 틀리면 M2 전체 재작업 | M2-INV-1 |
| 기존 정적 생성 + 신규 글 무재배포 | 명세 §11.1. 캐시가 보관 글을 남기면 전환 실패 | M5-INV-1 |
| 기존 상대 경로 이미지 vs R2 mediaId | 자동 다운로드 금지. 주소 유지가 우선 | M0-INV-3, M4-BE-4 |

---

## 6. 가장 먼저 수행할 Task 묶음 (배치 0–1)

구현 코딩은 기준 문서 커밋 후에만 시작한다.

**배치 0**  
1. M0-BASE-1 완료: spec·plan·`env.d.ts`만 커밋. `src/cms` 폐기.  
2. M0-INV-3 콘텐츠 목록 (JR, `CMS-CONTENT-INVENTORY.md`)

**배치 1 (Test Writer + Infra)**  
3. M0-INV-2 완료: `pg`만 설치·고정(`48a502d`). `@tiptap/*`는 M3-FE-1(첫 실제 시각 에디터 구현)까지 지연.
4. M1-TW-1 MDX 왕복 실패 테스트 완료
5. M1-TW-2 ContentStore 실DB 실패·계약 테스트 완료

**배치 2 (테스트 병합 후 병렬 worktree)**
6. M1-ED-1 serialize 완료(`src/cms/mdx`)
7. M1-DA-1 ContentStore 실DB 완료(`content-store.ts`)
8. M1-ED-2 SourceConverter/에디터 토글 연결 완료(`53b1495`)
9. M1-RV-1 Milestone 1 검수 완료(`53b1495`, Milestone 1 완료)

다음 테스트 우선(test-first) 순서:
- TW-1 → BE-2 (M2-TW-1이 READY인 동안 M2-BE-2는 TODO 상태를 유지하며 TW-1 완료 후 착수)
- TW-1 → TW-3 → DA-1 (M2-TW-3은 TW-1 이후 TODO, M2-DA-1은 TW-3 이후 TODO)
- TW-2 → DA-2 (M2-DA-2는 TW-2 이후 TODO)
- BE-1은 INV-1 이후 독립 진행 가능 (M2-BE-1 READY)
- BE-3은 BE-1, BE-2, DA-1 대기 (M2-BE-3은 BE-1, BE-2, DA-1 완료를 대기하는 TODO)
(계약 테스트 작성 완료 전에 구현 태스크를 병렬로 진행하지 않으며, 향후 구현 태스크를 미리 완료 처리하지 않는다.)

오늘 하지 않는 것: Frontend/Backend 화면·API, R2 업로드, Keystatic 제거, 운영 DB 이전.

---

## 7. 에이전트 운영 규칙 (이 계획과 함께)

- 다음 실행의 현재 위치는 맨 위 진행표다. 본문 전체를 다시 추론하지 않는다.
- Task 하나 = 담당자 하나. 같은 파일을 두 봇에게 주지 않는다. 소유 밖 파일이 필요하면 우회하지 말고 Lead가 이 문서를 고친다.
- 복잡한 핵심(왕복, 발행 트랜잭션, 예약, 일괄, 이전)은 TW 실패 테스트 다음 구현.
- Store/서비스는 `CmsError` 코드(`conflict`, `version_required` 등)를 검증한다. HTTP 409/428은 Route Handler 테스트(M2-BE-3 이후)에서만 단언한다.
- 병렬 시 `/Users/bh2980/Desktop/bh2980_blog-worktrees/<슬롯>`만 쓰고, 병합 후 슬롯을 지운다. 이번 배치에 일하는 봇만 만든다.
- 브리프에 쓰기 루트 절대 경로를 넣는다. cwd를 재할당한다고 가정하지 않는다.
- 비밀값·연결 문자열을 코드·로그·채팅에 쓰지 않는다.
- Reviewer 요청이 오기 전에 Lead가 리뷰했다고 말하지 않는다.
