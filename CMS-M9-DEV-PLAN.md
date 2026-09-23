# CMS M9 개발 계획 — 이관과 전환

- 상태: **계획 수립 · 구현 착수 전**
- 기준 브랜치: `feature/new-cms` (`15a76a8`)
- 선행 완료: M0–M8
- 상위 기준: `CMS-SPEC.md`, `CMS-V1-IMPLEMENTATION-PLAN.md` §M9
- 작업 순서: **안전성 결정 → 미리보기 → 이관 → 대조 → 사용자 승인 → 공개 전환 → Keystatic 제거 → 최종 검수**

M9가 v1 마지막 마일스톤이다. 이관 데이터 쓰기, 공개 트래픽 전환, Keystatic 제거는 서로 다른 위험이므로 **서로 다른 승인 게이트**로 운영한다. Oracle/Reviewer 판정은 사용자 승인이나 운영 허가를 대체하지 않는다.

---

## 1. 목표와 완료 조건

기존 콘텐츠 49편을 CMS 운영 DB로 안전하게 이관하고, 공개 대상의 Keystatic 결과와 새 DB 공개 결과가 동등함을 증명한 다음 승인된 순서로 공개 저장소를 전환하고 Keystatic을 제거한다.

M9-RV-1 완료 조건:

- 49편의 콘텐츠·컬렉션·관계·상태가 승인된 source inventory와 일치하고, 누락·중복·잘못된 공개 상태가 없다. 공개 주소는 published 레코드에 대해서만 대조하고, draft의 working slug는 비공개로 유지한다.
- 22개 이미지가 기존 `/assets` 경로에서 그대로 200으로 응답하고, 내려받은 바이트의 SHA-256이 원본과 일치한다. R2 업로드·`media_assets` ready 등록은 M9 범위가 아니다(O1 결정).
- M6 시험 적용은 `published=74, draft=1`이었다. draft 후보는 status 필드가 없는 `src/contents/memos/js의-비동기-처리-메커니즘.mdx`이며 현재 Keystatic/import 경로 모두 이를 draft로 취급한다. 이를 포함한 상태 매트릭스를 **사용자가 확인**하기 전에는 이관 목표를 확정하지 않는다. “49편 전부 공개” 또는 “초안 0”을 전제로 하지 않는다.
- Keystatic와 DB 공개 HTML 대조에서 설명되지 않은 차이가 0이다.
- 공개 목록·상세·별칭·RSS·sitemap·SEO/OG·공개 API가 DB 전환 후 정상이며, 초안은 공개되지 않고 인증된 편집 미리보기는 동작한다.
- 승인된 롤백 절차와 복구 가능한 원격 코드 상태가 실제로 확인된다.
- 사용자 승인 후 Keystatic 전용 런타임·패키지·설정이 제거되고 전체 v1 검수표를 통과한다.

---

## 2. 선행 조건과 중단 규칙

### 착수 전 확인

1. M8 저장 계약과 46편 변환본이 현재 기준 브랜치에 있고, M0–M8 진행표/테스트 근거가 현행 HEAD와 맞는지 확인한다.
2. `CMS-M7-LEAD1-CUTOVER-REPORT.md`의 미해결 결정, 실DB 상태, 백업·복구·원격 배포 증거를 다시 확인한다. 2026-09-22의 DB 수치는 과거 스냅샷이므로 현재 값으로 간주하지 않는다.
3. 이전 입력 파일·주소·이미지 체크섬의 기준 inventory를 고정하고 해시를 남긴다.
4. M6 `cms:migration:apply`는 격리된 시험 DB를 대상으로 검증된 도구다. 운영 DB 적용은 아래 **O1 결정**대로 별도 진입점을 만든다. 테스트 보호를 약화해 운영 URL을 통과시키는 편법은 금지한다.
5. 작업 시크릿·DB URL·토큰은 문서, 로그, 커밋, 리뷰 메시지에 기록하지 않는다.

### 즉시 중단 조건

- inventory와 DB 상태/카운트가 다르거나, 카테고리·태그 관계 해석이 불명확함.
- 예상되지 않은 초안, 누락 주소, 중복 주소, 이미지 객체/체크섬 불일치가 있음.
- 롤백 대상 커밋/환경 설정 또는 복구 가능한 백업이 확인되지 않음.
- Reviewer가 P0/P1 또는 데이터 손실·권한·공개 유출 위험을 지적함.
- Oracle 결과 또는 사용자 승인이 미완료임.

중단 후 원인을 기록하고 재개 승인 전까지 운영 DB 쓰기, 플래그 전환, Keystatic 제거를 하지 않는다.

---

## 3. 작업 순서와 배치

| 순서 | 작업 | 주요 산출물 | 선행 / 게이트 |
| --- | --- | --- | --- |
| 0 | M9-0 사전조사 + Oracle O1 | 결정 로그, 기준 inventory, 롤백/승인 절차 | 구현 전 필수 |
| 1 | M9-FE-1 DB 초안 미리보기 | 관리자 전용 working-body 조회 + 공개/권한 테스트 | O1 결정 |
| 2 | M9-BE-1 이관 안전성 및 실행 | 운영 적용 가드, dry-run 보고서, 시험 DB 적용 결과, 운영 이관 증거 | O1 + Reviewer R2 + **사용자 운영 이관 승인** |
| 3 | M9-TW-1 전후 공개 HTML 대조 | 승인된 published 집합 주소·HTML 비교, draft preview 별도 검증, 차이 분류 보고서 | M9-BE-1 완료 |
| 4 | Oracle O2 + M9-LEAD-1 | 독립 go/no-go 감사, 전환 보고서 | 이관/대조 완료 + Reviewer R3/R4 |
| 5 | M9-BE-2 플래그 전환 | 승인된 배포, 공개 smoke 결과, 복구 기록 | **사용자 공개 전환 승인** |
| 6 | 안정화 관찰 + Oracle O3 | 관찰 로그, Keystatic 제거 go/no-go | BE-2 정상 + 사전 합의한 관찰 기간 |
| 7 | M9-BE-3 Keystatic 제거 | 제거 변경, 범용 MDX/콘텐츠 보존 확인 | **사용자 제거 승인** |
| 8 | M9-RV-1 최종 검수 | v1 최종 승인 및 남은 위험 목록 | BE-2/BE-3 완료 |

M9-FE-1 구현은 O1 이후 M9-BE-1의 코드 조사와 일부 병행할 수 있으나, 운영 DB 쓰기는 절대 병행하지 않는다. BE-1 실제 운영 적용 → TW-1 대조 → LEAD-1 승인은 순서대로 진행한다.

### M9-0 사전조사

- 현재 DB는 Payload CMS 테이블과 CMS 테이블이 함께 있는 공유/레거시 DB로 취급한다. 대상 스키마·테이블만 명시하고, 기존 테이블 truncate/drop/재생성 금지.
- 기준 파일·메타데이터·관계·카테고리 공개 상태·미디어 22개를 inventory와 연결한다.
- 상태 목표는 O1 결정 ④로 확정됐다: 49편 = published 48 / draft 1. status 없는 `memos/js의-비동기-처리-메커니즘.mdx`를 draft로 유지하고 승격하지 않는다. source inventory와 대조해 차이가 있으면 중단한다.
- 운영 백업/스냅샷, 연결 주체 권한, 실행자, 복구 한계, 원격 롤백 배포 가능성을 확인한다. 확인이 안 되면 BLOCKED.
- 쓰기 동결 구간(O1 결정 ⑤)의 시작·해제 시점과 동결 중 허용 작업을 사용자 승인 요청에 명시할 수 있게 정리한다.

### M9-FE-1 — DB 초안 미리보기

- `getPreviewPost`/`getPreviewMemo`/`listPreviewPosts`가 공개 `ContentRepository`를 그대로 사용하는 현재 경로를 분리한다.
- 관리자 store에 최소한의 slug → working body 조회만 추가한다. 공개 repository/store API에는 초안을 추가하지 않는다.
- post/memo 각각 인증된 관리자 초안 미리보기 성공, 비인증/권한 없는 접근 거부, 공개 상세/API에서 초안 404, 발행 전후 데이터 상태 불변을 검증한다.
- 공개 repository source가 Keystatic일 때와 postgres일 때 모두 미리보기 동작을 확인한다.

### M9-BE-1 — 이관

- 기존 M6 parser/import-plan/stable ID/all-or-nothing 로직을 재사용한다. 코퍼스 출력과 대상 DB 스키마가 바뀌지 않는지 계약 테스트로 고정한다.
- 운영 적용을 위해 별도 승인 가능한 실행 경로가 필요하다면 O1에서 설계안을 결정한다. `CMS_TEST_DATABASE_URL` 보호·격리 검사를 우회하지 않는다. dry-run과 실제 apply를 구분하고, 사용자 승인 없이는 운영 대상에 쓰지 않는다. → **구현 완료:** `apply-production` 진입점(`production-guard.ts`·`production-runner.ts`). DDL 없음, 일회 적재, 지문 검사.
- 시험 적용은 운영 DB와 명확히 격리된 DB/schema에서 반복 실행해 멱등성·재개·실패 원자성을 확인한다.
- draft 후보는 status 필드가 없는 `src/contents/memos/js의-비동기-처리-메커니즘.mdx`다. 현재 Keystatic/import 경로 모두 이를 draft로 취급하므로, 의도된 상태인지 M9-0에서 사용자와 확인한다.
- 실제 운영 apply 전: 사용자에게 대상 환경, 정확한 생성/변경 범위, 예상 건수, 백업/롤백 한계, 실행 명령(비밀값 제외)을 제시하고 명시 승인을 받는다. dry-run에서 받은 원본 지문을 `--expect-digest`로 고정한다. **O1 결정 ⑤의 양쪽 콘텐츠 쓰기 동결이 시작됐는지 확인하고, 아니면 실행하지 않는다.**
- 운영 apply 후 읽기 전용 대조로 49편의 원본 레코드·관계·승인된 상태 매트릭스, published 48편의 주소, `/assets` 이미지 22개 HTTP 200·SHA-256, 원본 미변경을 증명한다. 하나라도 불일치하면 플래그를 바꾸지 않는다.

### M9-TW-1 — Keystatic ↔ DB 공개 렌더 대조

- 동일한 고정 49편의 상태 매트릭스를 기준으로 비교한다. Keystatic과 DB의 **공개 HTML은 published 콘텐츠에 한해서** 비교하며, 최종 건수는 M9-0에서 확정한 상태 매트릭스에서 산출한다. draft는 공개 HTML 비교 대상이 아니며, 관리자 인증 미리보기로 별도 검증한다.
- 주소/리다이렉트, title/metadata, directive 표현, 링크, 이미지·캡션·크기·정렬, 코드·목록·하드브레이크를 비교한다.
- 허용 정규화는 O1에서 범위를 고정하고 보고서에 공개한다. 본문 의미·링크·이미지 차이를 정규화로 숨기지 않는다.
- 결과는 `같음 / 허용된 표기 차이 / 결함`으로 모두 분류하고, 미분류·결함은 0이어야 통과한다.

### M9-LEAD-1 — 전환 보고서 / 공개 승인

`CMS-M7-LEAD1-CUTOVER-REPORT.md`를 승계·갱신하며 아래를 포함한다.

- 현재 기준 커밋/배포와 M9 완료 산출물 링크.
- 기준 inventory 대비 이관 결과, published 48개 주소·`/assets` 이미지 22개·draft 1편·상태/관계 대조표.
- 공개 HTML 대조 결과와 모든 차이 분류.
- 미리보기/공개 API/SEO/RSS/sitemap/OG smoke 근거.
- 롤백 명령·소요/제약·백업 및 관찰 계획, 잔여 위험.
- Oracle O2와 Reviewer R3/R4 판정.

Reviewer와 Oracle이 통과해도 자동 전환하지 않는다. 사용자가 보고서를 보고 **공개 트래픽 postgres 전환을 별도로 승인**해야 BE-2로 간다.

### M9-BE-2 — 플래그 전환

- 승인된 `CMS_PUBLIC_REPOSITORY=postgres` 설정으로 배포한다. 환경변수는 모듈 로드 시 고정되므로 설정만 변경하고 재배포를 생략하지 않는다.
- 운영 로그/모니터링에서 비밀값을 제외하고 확인한다.
- smoke: 랜딩, post/memo 목록·상세, 이전 주소 308, 비공개 404, RSS, sitemap, SEO/canonical/OG, 공개 API, 인증 미리보기, 초안 비공개, 이미지 응답.
- 실패 시 사전 합의한 설정/커밋으로 되돌리고 재배포한다. 롤백 뒤 공개 경로와 draft preview를 다시 검증한다.
- 관찰 기간은 O1 및 LEAD-1에서 합의한 값으로 기록하고, 완료 전 Keystatic을 삭제하지 않는다.

### M9-BE-3 — Keystatic 제거

- BE-2 안정화 기간이 끝나고 Oracle O3 검토 및 사용자의 **별도 Keystatic 제거 승인**을 받은 뒤 수행한다.
- 패키지·lockfile·Keystatic 라우트/설정/전용 env/patch만 제거한다. 범용 MDX 렌더러, 공개 콘텐츠 파일 및 이관 근거는 삭제하지 않는다.
- 콘텐츠 원본 파일의 장기 보존/삭제는 임의 결정하지 않는다. 별도 명시 승인 전까지 보존한다.
- 제거 후 검색으로 Keystatic 참조/환경 설정 잔존을 확인하고 typecheck/test/build 및 공개 smoke를 다시 통과시킨다.

---

## 4. Oracle 자문 — 고정 3회

각 회차는 해당 게이트에서 반드시 호출한다. 응답은 결정 로그에 **질문·권고·수용/기각·근거·롤백 조건**으로 남긴다. Oracle은 조언자이며 운영 실행 승인자는 사용자가 맡는다.

### O1 — 구현 착수 전 필수

**시점:** M9-0 종료 직후, M9-FE-1/M9-BE-1 구현 전에.

**질문:**
1. 테스트 전용 M6 import 경로를 훼손하지 않으면서 안전하게 운영 DB에 apply할 최소 경계/가드는 무엇인가?
2. 공유/레거시 DB에서 안전한 원자성·대상 범위·재실행/복구 전략은 무엇인가?
3. draft preview를 관리자 store에만 추가하고 공개 store를 격리하는 최소 설계는 무엇인가?
4. `published` 카테고리/관계, 예상 draft 수(시험 결과 1 draft 포함), 49주소·22이미지 검증의 정확한 불변식은 무엇인가?
5. 운영 전환/Keystatic 제거 전 필요한 백업·롤백·관찰 증거는 무엇인가?

**게이트:** 데이터 상태·운영 apply 가드·승인/롤백 절차의 미해결 P0/P1이 있으면 구현 착수 보류.

### O2 — 이관·HTML 대조 완료 후, LEAD-1 전에 필수

**시점:** 운영 apply와 TW-1 대조 증거가 완성된 뒤, Reviewer R3/R4와 같은 게이트에서.

**질문:** 49주소, 상태/관계, 이미지, 공개 HTML, draft preview, 실제 공개 경로 증거가 충분한가? 숨은 유출·조용한 누락·불완전 롤백 위험이 있는가? postgres 전환 go/no-go와 추가 증거를 제시해 달라.

**게이트:** 불일치·증거 공백·P0/P1이 있으면 LEAD-1에서 공개 전환 승인을 요청하지 않는다.

### O3 — Keystatic 제거 직전 필수

**시점:** BE-2 관찰 기간 종료 및 smoke 통과 후, M9-BE-3 변경 병합/배포 전에.

**질문:** 현재 배포에서 Keystatic이 런타임/롤백/콘텐츠 원본에 아직 필요한가? 제거 목록이 정확하고, 롤백 가능성·보존 정책이 충분한가?

**게이트:** O3 결과와 잔여 위험을 사용자에게 제시하고 **별도 제거 승인**을 받는다. 제거 승인 없이는 패키지·라우트 삭제를 진행하지 않는다.

### O1 결정 기록 (2026-09-23)

자문 결과를 아래처럼 확정했다. 구현은 이 결정을 따른다.

| # | 안건 | 결정 | 근거 |
| --- | --- | --- | --- |
| 1 | 운영 DB 적용 경로 | M6 가드를 완화하지 않고 **운영 전용 진입점**을 따로 만든다. 기존 `buildImportPlan()`·`ContentStore.importEntries()`의 충돌 검사·단일 트랜잭션을 재사용하고, 운영에서는 스키마 생성·`migrateContentStore()`를 실행하지 않는다. 대상 URL을 임의 CLI 인자로 받지 않고 명시적 opt-in + 대상 DB/역할/스키마 확인 + CMS 테이블·스키마 버전 읽기 전용 검사 + 원본 해시·예상 건수 검사를 통과해야 실행된다. CMS 테이블 전용 최소 권한 계정을 쓰고 공유 DB의 Payload 테이블은 건드리지 않는다. | 테스트 격리 보호를 유지하면서 최소 변경으로 운영 경로를 얻는다 |
| 2 | 이미지 22장 | 기존 `/assets` 파일·경로를 유지하고 공개 URL HTTP 200과 원본 SHA-256을 대조한다. **R2 업로드·`media_assets` 등록은 M9 범위 밖**으로 두고 별도 승인 변경으로 분리한다. | M6의 “이미지 보고 전용” 결정 및 `CMS-SPEC.md` §11.3-6과 일치 |
| 3 | 미리보기 인증 응답 | `/preview/start`는 401/403을 유지한다. 미리보기 **페이지**는 비인증이면 404(정보 은닉, 현행 유지), 인증된 draft는 200, 공개 경로는 draft 404다. | 경로별 계약이 다르며 M7 검수의 “공개 셸 비노출” 의도와 충돌하지 않는다 |
| 4 | 상태 목표 | status 필드가 없는 `memos/js의-비동기-처리-메커니즘.mdx`를 승격하지 않는다. **49편 = published 48 / draft 1** (전체 75 = published 74 / draft 1). 공개 주소·HTML 대조는 published 48편만. | 현 Keystatic·import 동작을 보존하고 공개 상태를 조용히 바꾸지 않는다 |
| 5 | 롤백 경계 | 최종 원본 스냅샷·운영 import 전부터 전환 관찰 종료까지 **Keystatic·CMS 양쪽 콘텐츠 쓰기를 동결**한다. 동결 미승인이면 운영 이관·전환을 진행하지 않는다. 공유 DB 전체 복원은 기본 롤백으로 제시하지 않는다. | 플래그만 되돌리는 롤백은 전환 후 DB 쓰기가 있으면 무손실이 아니다 |

중단 규칙: 위 1–5 중 하나라도 지키지 못하는 상황이면 그 상태에서 운영 DB 쓰기·플래그 전환·Keystatic 제거를 멈춘다.

**M9-FE-1 구현 결과:** 관리자 전용 working slug 조회 1개(`ContentStore.getWorkingEntryBySlug`)와 미리보기 전용 모듈(`src/libs/contents/repositories/draft-preview.ts`)만 추가했다. 공개 `ContentRepository` 계약은 넓히지 않았고, 초안 경로는 `CMS_PUBLIC_REPOSITORY=postgres`일 때만 동작한다.

**M9-BE-1 구현 결과(O1 ①·⑤ 반영):** 시험 경로(`apply`)를 그대로 두고 운영 전용 진입점을 분리했다.

- `production-guard.ts`: `CMS_MIGRATION_APPLY_PRODUCTION=1` opt-in, `CMS_DATABASE_URL`만 사용, 시험 DSN과 같은 DB면 중단, `cms_m6_*` schema 거부, 슈퍼유저 거부, **DDL 없이** CMS 테이블 9개 존재 + `cms_migrations` 기대 표식 확인.
- `production-runner.ts`: 읽기 전용 사전조사 → 승인 원본·대상 수 검사 → 한 번만 적재 → 검증. `migrateContentStore()`를 부르지 않고 두 번 적재하지 않는다.
- CLI: `apply-production --dry-run`(DB 미접속, 지문·건수만) / `apply-production --expect-digest --expect-items --expect-existing-entries` / `inspect-target`(READ ONLY 트랜잭션).
- 실측: 계획 **75건(published 74/draft 1)**, 원본 지문 `00dcccc1…`, 대상 `entries` 8건. M6 결과·O1 결정 ④와 일치한다. 운영 적재는 승인 전이므로 하지 않았다.

**R2 2차 판정: 중대한 결함/위험 없음(머지 가능).** 1차 P0 2건·P1 1건은 모두 닫혔고 새 P0/P1은 없다. 남은 지적은 P2 4건이다.

| 지적 | 수정 |
| --- | --- |
| P0 · 비어 있지 않은 대상에 쓰는 것을 막지 못함(`entryCount`를 계산만 하고 판단에 안 씀) | 계획 밖 항목 수(`foreignEntryCount`)를 추가로 읽고 **있으면 쓰지 않고 중단**한다. 대상 `entries` 수는 `--expect-existing-entries`와 정확히 일치해야 한다 |
| P0 · 승인된 원본이 강제되지 않음(`--expect-digest` 선택) | `--expect-digest`·`--expect-items`·`--expect-existing-entries`를 **필수**로 바꿨다. 하나라도 없거나 값이 다르면 무쓰기 중단 |
| P1 · 스키마 버전을 확인하지 않음 | `assertCmsSchemaReady`가 `cms_migrations`의 기대 표식까지 읽기만 해서 확인한다 |
| P1 · 사후 검증이 로그로만 끝남 | 검증 실패면 **보고서를 쓴 뒤 예외를 올려** 0이 아닌 종료를 낸다(플래그를 켜지 말라는 메시지 포함) |
| P1 · 승인·동결은 사람 게이트 | 코드가 강제하는 척 하지 않도록 CLI 도움말과 이 문서에 명시했다(`PRODUCTION_APPLY_FLAG`는 승인 기록이 아니다) |

R2 2차가 남긴 P2 4건의 처리:

| P2 지적 | 처리 |
| --- | --- |
| 실패 보고서에 실패 표시가 없어 JSON만 보면 성공 적재로 읽힘 | 보고서에 `outcome`(`verified`/`verification_failed`/`dry_run`)을 추가했다. 실패면 notes 첫 줄에 경고를 넣고 **표식을 넣은 뒤에** 예외를 올린다 |
| §11.4·승인 표가 코드의 거부 동작과 모순 | §11.3의 “깨끗하다”는 **ID·slug 충돌이 0**이라는 뜻이고, 계획 밖 항목 검사는 별개다. §11.4와 승인 표를 그에 맞게 고쳤다(§11.5) |
| 테스트 공백(`allow-existing`+foreign, 사후 검증 throw, CLI 인자 파싱) | `allow-existing`+foreign 조합과 `outcome` 표식을 테스트로 고정했다. 사후 검증 throw는 **공개 진입점으로 도달할 수 없다**(아래) |
| `runProductionApply`가 `assertCmsSchemaReady`를 다시 부르지 않음 | 의도된 구조다. opt-in·슈퍼유저 검사와 같은 계층이고, 운영 실행 경로는 CLI 하나뿐이다 |

**사후 검증 실패 분기는 도달 불가능한 방어선이다.** 검증 실패를 만들려면 적재 후 대상이 기대와 갈려야 하는데, 어떤 변형이든(`content_addresses` 행 삭제, 별칭 추가, 상태 변조) `importEntries`가 **conflict로 먼저 중단**한다. 그래서 이 분기에 대한 종단 테스트는 만들지 않았다(가짜로 통과시키지 않는다). 표식 자체는 타입에서 필수이고 도달 가능한 두 경로(`verified`·`dry_run`)에서 테스트로 고정했다. 분기가 살아 있는 한, 발동하면 그게 유일한 신호다.

**P0-1 수정의 결과:** 운영 DB에 계획 밖 초안 8건이 있어, 지금은 `apply-production`이 쓰기를 거부한다. 이 결정이 §11.5에 추가됐다.

---

## 5. Reviewer 검수 — 각 게이트에서 반복

각 리뷰는 독립 Reviewer가 수행한다. 리뷰 전 담당자는 변경 커밋, 실행 명령/결과, 증거 파일, 알려진 제한을 제공한다. P0/P1 또는 중대한 데이터·보안·회귀 위험은 수정 후 같은 단계 리뷰를 반복한다. 최종 조건은 **중대한 결함/위험 없음(머지 가능)**이다. Oracle/Reviewer 통과는 사용자 승인 대체가 아니다.

| 리뷰 | 시점 | 검수 범위 / 통과 조건 |
| --- | --- | --- |
| R1 | M9-FE-1 구현 완료, 병합 전 | 미리보기 권한 분리, 초안 공개 차단, 공개 API surface 불변, 초안/발행 전후 회귀 테스트 |
| R2 | M9-BE-1 코드·시험 적용 완료, 운영 apply 전 | 대상 DB fail-closed, 운영/테스트 대상 분리, 범위 제한, 트랜잭션/재실행, 카테고리 published, 상태/미디어 검증, 실패·중단 안전성. R2 승인 전 운영 DB 쓰기 금지. **1차 부적합(BLOCK, P0 2·P1 1) → 수정 → 2차 통과(중대한 결함/위험 없음, P2 4건 처리)** |
| R3 | 운영 이관 및 M9-TW-1 결과 완료 후 | inventory↔DB↔published 48 주소↔`/assets` 이미지 22개↔렌더 결과의 독립 대조, draft 1편 비공개·미리보기 확인, 누락/중복/허용 정규화의 정당성 |
| R4 | M9-LEAD-1 보고서 확정 전 | 근거 링크, 승인 항목 분리, 롤백/관찰 계획, 잔여 위험·go/no-go 결론의 정확성 |
| R5 | M9-BE-2 배포 smoke 완료 후, 관찰 종료 판정 전 | 실제 HTTP/SEO/RSS/sitemap/API/미리보기, 공개 초안 차단, rollback/redeploy 근거 |
| R6 | M9-BE-3 변경 완료, 제거 배포 전 | 제거 범위 최소성, 범용 MDX·콘텐츠 보존, Keystatic 참조 잔존 검색, 전체 빌드/테스트 |
| M9-RV-1 | R1–R6 및 O1–O3 이후 최종 | CMS-SPEC §12.2 전 항목, 운영/롤백 증거, 전환·제거 승인 기록, 최종 판정 |

---

## 6. 사용자 승인 게이트

다음 승인은 명시적으로 각각 받는다. 앞 단계 승인을 다음 단계 승인으로 간주하지 않는다.

1. **운영 이관 승인 (M9-BE-1 apply 전):** 운영 DB에 CMS 데이터를 쓰는 범위/위험을 승인.
2. **공개 전환 승인 (M9-LEAD-1 후, M9-BE-2 전):** `CMS_PUBLIC_REPOSITORY=postgres` 설정과 재배포를 승인.
3. **Keystatic 제거 승인 (O3/R5 후, M9-BE-3 전):** 패키지·라우트·설정 삭제 및 원본 보존 정책을 승인.

각 요청에 대상 환경, 변경 범위, 증거, 롤백, 남은 위험을 함께 제시한다. 명시 승인이 없으면 대기한다.

---

## 7. 배치 종료 게이트 및 최종 명령

### 코드 변경 게이트

각 구현 배치에서 최소한 다음을 수행하고 결과를 Reviewer에게 첨부한다.

- `pnpm typecheck`
- 관련 Vitest 계약/통합 테스트; DB 테스트는 격리된 `CMS_TEST_DATABASE_URL`만 사용
- 최종 통합 전 전체 `pnpm test:run` 및 `pnpm build`
- 변경된 TypeScript에 `pnpm exec biome check <changed-files>`
- 운영 DB 읽기/쓰기는 코드 테스트와 분리하고, 쓰기 전 별도 사용자 승인과 사전/사후 읽기 검증을 둔다.

### 최종 검수 자료

- M9-0 inventory와 데이터베이스 읽기 전용 대조 결과
- 운영 apply 승인/실행/사후 대조 기록 (비밀값 제외)
- 전후 공개 HTML 대조 원자료와 분류표
- 배포 커밋, 환경 전환 확인, HTTP smoke, 관찰 기간, 롤백 리허설/실행 기록
- Oracle O1/O2/O3 결정 로그와 Reviewer R1–R6 판정
- M9-BE-3 승인 및 Keystatic 잔존 검색
- CMS-SPEC §12.2 최종 체크리스트 및 M9-RV-1 결론

---

## 8. 진행 상태

| ID | 상태 | 담당 | 산출물/검증 |
| --- | --- | --- | --- |
| M9-0 | DONE | Lead + BE + INF | O1 결정 5건 확정(§4). 남은 실행 항목은 운영 진입점 구현과 R2다 |
| M9-FE-1 | DONE | BE + FE | `getWorkingEntryBySlug` + `draft-preview.ts`; 공개 계약 불변. 검증: 실DB 5건·서비스 5건 통과, 전체 119 files/770 tests, `pnpm typecheck` 0 errors |
| M9-BE-1 | DONE(운영 적재 전) | BE + INF | 구현·검수 완료(R2 2차 통과). 운영 적재는 승인 전이라 미실행. 검증: 실DB 18건, 전체 793 tests, dry-run 75건 일치. **선행 결정: 계획 밖 초안 8건 처리(§11.5)** |
| M9-TW-1 | TODO | TW | 49편 전후 공개 HTML 대조, R3 |
| M9-LEAD-1 | TODO | Lead | O2/R4 포함 전환 보고서와 cutover 승인 요청 |
| M9-BE-2 | TODO | BE + INF | 승인된 공개 저장소 플래그 전환, 재배포/smoke/관찰, R5 |
| M9-BE-3 | TODO | BE + INF | O3 및 제거 승인 후 Keystatic 제거, R6 |
| M9-RV-1 | TODO | RV | v1 전체 최종 검수, 중대 위험 없음 판정 |

현재 착수 위치는 **M9-BE-1 실행 대기**다. 코드·검수는 끝났고(R2 2차 통과), 운영 적재는 사용자 승인과 계획 밖 초안 8건 결정을 기다린다(§11.5).

---

## 9. 실행 기록

| 일자 | 단계 | 결과/결정 | 근거 |
| --- | --- | --- | --- |
| 2026-09-23 | 계획 초안 | M9 Oracle O1–O3, Reviewer R1–R6, 사용자 승인 3게이트 및 운영 적용 차단 규칙을 명시 | 이 문서 |
| 2026-09-23 | M9-0 / O1 | 자문 결과 5건 확정: 운영 전용 import 진입점, 이미지 `/assets` 유지, 경로별 미리보기 응답, published 48/draft 1, 양쪽 쓰기 동결 | 위 O1 결정 기록 |
| 2026-09-23 | M9-FE-1 | 관리자 전용 working slug 조회와 초안 미리보기 폴백 구현. 공개 저장소 계약·공개 조회 동작 불변 | `working-entry-by-slug.test.ts`(실DB 5), `preview-draft-fallback.test.ts`(5), 전체 770 tests |
| 2026-09-23 | M9-BE-1 | 운영 전용 이관 진입점 구현(가드·사전조사·지문·1회 적재·검증). 운영 적재는 승인 전이라 미실행 | `production-guard.test.ts`(7), `production-runner.test.ts`(10), dry-run 75건(published 74/draft 1) |
| 2026-09-23 | M9-BE-1 · R2 | R2 1차 **부적합(BLOCK)**. P0 2건(비어 있지 않은 대상·승인 원본 미강제), P1 1건(schema 버전·사후 검증) 수정하고 재검수 대기 | R2 run `583b9a08`, 전체 122 files/793 tests, `pnpm typecheck` 0 |
| 2026-09-23 | M9-BE-1 · R2 재검수 | 1차 재검수 런이 **인프라 실패**(`pi-router: No available model found for reviewer-route`, 검수 판정 아님). 라우터 복구 후 같은 프로토콜로 재시도 → run `45504275` | 실패 run `477dd097`, 재시도 run `45504275` |
| 2026-09-23 | M9-BE-1 · R2 2차 | **통과 — 중대한 결함/위험 없음(머지 가능).** 1차 P0 2건·P1 1건 닫힘 확인, 새 P0/P1 없음. P2 4건 처리(실패 표식, 문서 모순, 테스트 공백, 재호출 구조) | run `45504275`, `production-runner.test.ts` 12건 |
| 2026-09-23 | M9-TW-1 선행 | 격리 schema에서 운영 경로로 이관한 뒤 **공개 조회→렌더**가 원본과 같은지 검증. 48편 렌더 등가·slug 집합·메타데이터·draft 비공개·이미지 파일 존재 통과 | `public-parity.test.tsx` (5 tests, 실DB) |
| 2026-09-23 | M9-0 정합성 | 원본 계획(75건, published 74/draft 1)과 운영 DB 읽기 전용 조사(주소 0, 기존 slug 0, 필수 테이블 준비 완료)를 대조. 충돌 위험 0 | §11, `artifacts/cms/m9/target-inspection-pre.json` |
| 2026-09-23 | M9-BE-1 · 정리 | 운영 DB의 계획 밖 초안 8건을 삭제(사용자 승인 A안). 정체는 2026-09-21 관리자 테스트 데이터(slug 없음). 8건끼리 참조하는 `entry_references` 1행을 먼저 지우고 `entries` 8행 삭제 → 네 테이블 모두 0. Payload·`folders` 미접촉 | `foreign-drafts-pre.txt`, `target-inspection-post-cleanup.json` |
| 2026-09-23 | M9-BE-1 · 지문 재확인 | 삭제 후 dry-run 재실행. `planDigest 00dcccc1…`이 승인값과 **동일**하고 75건(published 74/draft 1)·blocking 0 유지 → 원본 동결이 유지되고 있음 | `dry-run-post-cleanup.json` |
| 2026-09-23 | M9-TW-1 · 로컬 리허설 | 테스트 DB의 격리 schema(`cms_m6_preview`)에 이관하고 **두 모드로 사이트를 띄워 대조**했다. 이 과정에서 **P0 2건**을 찾아 수정: (1) 한글 slug가 전부 500이던 버그, (2) 게시일 해석 차이 25편 | `page.test.ts`(2), 전체 124 files/802 tests |
| 2026-09-23 | M9-BE-1 · 게시일 | Keystatic이 한국 시간을 UTC로 잘못 저장한 값을 이관 시 KST로 되돌린다(B안 확정). 48편 전수 표시 날짜 불일치 0, RSS도 현재 사이트와 동일. **승인 지문 변경: `00dcccc1…` → `70794ce9…`** | `published-at-seoul.test.ts`(2), `verify-dates.mjs` |

---

## 10. 위험/미결정 사항

| 항목 | 상태 | 해결 시점 |
| --- | --- | --- |
| 운영 DB apply를 위한 안전한 실행 경로 | 방향 확정(O1 ①: 운영 전용 진입점) · 구현과 R2는 남음 | 구현 후 R2 통과 전 |
| 이미지 22장의 R2 업로드·`media_assets` 등록 | M9 범위 밖으로 확정(O1 ②) | 별도 승인 변경 |
| status 없는 memo 1편의 의도된 공개 상태 | `js의-비동기-처리-메커니즘.mdx`는 현재 draft 취급. 사용자 승인된 상태 매트릭스 필요 | M9-0/O1 |
| ~~**운영 DB의 계획 밖 초안 8건**~~ | **해결.** 관리자 테스트 데이터로 판명되어 2026-09-23 삭제(사용자 승인 A안). 대상이 빈 상태가 됐다 | 완료 |
| R2 재검수 | **2차 통과**(중대한 결함/위험 없음). 1차 P0 2·P1 1 닫힘, P2 4건 처리 | 완료 |
| 2026-09-22 DB 스냅샷·원격 롤백 증거의 현재성 | 재측정 필요, 시크릿 없이 기록 | M9-0 |
| 콘텐츠 원본 파일 보존 정책 | 사용자 별도 결정 전까지 보존 | O3/제거 승인 |
| 공개 전환 후 안정화 관찰 기간 | 미정 | O1에서 권고, LEAD-1에서 승인값 확정 |

미결정 표의 운영 안전·데이터 무결성 항목이 남아 있는 한 M9 진행표에서 해당 작업을 DONE으로 바꾸지 않는다.

---

## 11. 대상 상태 매트릭스와 정합성 대조 (M9-0 증거)

### 11.1 원본 → 이관 계획

`pnpm cms:migration:plan:production` (2026-09-23, DB 미접속)

| 컬렉션 | published | draft | 합계 |
| --- | --- | --- | --- |
| post | 7 | 0 | 7 |
| memo | 41 | 1 | 42 |
| category | 3 | 0 | 3 |
| tag | 22 | 0 | 22 |
| collection | 1 | 0 | 1 |
| **합계** | **74** | **1** | **75** |

- 원본 MDX 49편 = post 7 + memo 42. 그중 **published 48 / draft 1**.
- draft 1편은 status 필드가 없는 `src/contents/memos/js의-비동기-처리-메커니즘.mdx`다(O1 결정 ④).
- `blocking=0`, `warnings=0`.
- 원본 지문: `00dcccc1b7571a04ccb124aa6e10966afdb7208c8e8a346c42c5bf17ce8a88ab`.

같은 원본의 이미지 검사(`tsx src/cms/migrate-from-files/cli.ts inspect`):

| 항목 | 값 |
| --- | --- |
| 이미지 | **22장, missing=0** (전부 로컬에 있고 SHA-256 기록됨) |
| 코퍼스 warning | 24건 (`emptyAlt=22` 포함) |
| 코퍼스 blocking | 0 |

`emptyAlt=22`는 기존 콘텐츠의 접근성 부채이지 이관 회귀가 아니다. v1 검수표의 alt 항목은 편집기 동작(F05/F14)을 말하므로 **비차단**으로 두고 M9-RV-1에 남긴다. 22장의 200응답·바이트 일치는 M9-BE-1 대조에서 확인한다.

### 11.2 운영 DB 현재 상태

`tsx src/cms/migrate-from-files/cli.ts inspect-target` — **READ ONLY 트랜잭션**이라 쓰기가 불가능하다.

| 항목 | 값 |
| --- | --- |
| database / role / superuser | `neondb` / `neondb_owner` / **false** |
| schema / 테이블 준비 | `public` / `schemaReady=true` (필수 CMS 테이블 9개 존재, DDL 불필요) |
| `entries` | 8건 — post draft 5, memo draft 1, tag draft 1, tag published 1 |
| `content_addresses` | **0건** |
| `media_assets` | 0건 |
| `folders` / `schedules` | 1 / 0 |
| `cms_migrations` | `seed_initial_body_templates` |
| 기존 `working_slug` | **0건** |
| 비 CMS 테이블 | 19개(Payload 계열). 이관 경로는 이들을 이름으로도 건드리지 않는다 |

### 11.3 충돌 위험 판정

| 확인 | 결과 |
| --- | --- |
| 계획 ID ↔ 기존 `entries.id` | **0건** (계획 ID는 경로 기반 UUIDv5, 기존 8건은 CMS가 만든 임의 UUID) |
| 계획 slug ↔ 기존 `content_addresses` | **0건** (주소 자체가 0건) |
| 계획 slug ↔ 기존 `working_slug` | **0건** (기존 항목에 slug 없음) |
| 계획 건수 ↔ M6 시험 결과·O1 결정 ④ | **일치** (75건, published 74 / draft 1) |

### 11.4 결론과 남은 조건

이관 입력과 대상은 **ID·slug 충돌이 0건**이고, 계획 밖 초안 8건도 정리했다(§11.5). `inspect-target` 사후 조사에서 `entries`·`entry_bodies`·`content_addresses`·`entry_references`가 모두 0건이다. **지금 상태로 이관은 통과 가능하다.**

남은 조건은 데이터가 아니라 **승인·동결**이다.

1. **계획 밖 초안 8건 처리 결정** — 보관·삭제(A안) 또는 섞어 이관(B안, 별도 변경+독립 검수 필요). §11.5 참조.
2. **사용자 운영 이관 승인** — O1 결정 ⑤의 콘텐츠 쓰기 동결 시작/해제 시점을 포함해 승인받는다.
3. 승인 뒤 `inspect-target`으로 대상을 **다시 관찰**해 `--expect-existing-entries` 값을 확정하고, `apply-production`으로 실행한다.
4. 같은 `inspect-target`으로 사후 대조하고, M9-BE-1 항목의 `/assets` 이미지 22개 HTTP 200·SHA-256 대조를 더한다.

### 11.5 사용자 승인 요청 (M9-BE-1 실행 전)

| 항목 | 내용 |
| --- | --- |
| 대상 | Neon `neondb` · schema `public` · role `neondb_owner`(비슈퍼유저) |
| 쓰기 범위 | **INSERT만.** `entries` 75행, `entry_bodies` 149행(working 75 + published 74), `content_addresses` 75행, `entry_references` 251행 → 총 **550행** |
| 쓰지 않는 것 | Payload 테이블 19개, 기존 `entries` 8행, 기존 `folders` 1행, `media_assets`, `schedules`, 스키마(DDL 없음), 폴더 배정 |
| 원본 고정 | `--expect-digest 70794ce90e83db05d5acb3f5d91bf7d10c2ffb012eae377669d632643c3cbbf4`, `--expect-items 75` — 둘 다 필수이고 불일치면 무쓰기 중단. 지문이 **Keystatic 측 동결을 강제**한다(`src/contents`를 고치면 실행이 멈춘다) |
| 대상 수 고정 | `--expect-existing-entries`도 필수다. 값은 **실행 직전 `inspect-target`으로 다시 관찰한 값**을 쓴다. 계획 밖 초안 8건을 정리했으므로 현재 **`0`**이다(`target-inspection-post-cleanup.json`) |
| 실행 전 조건 | 위 `inspect-target` 재관찰 + **O1 결정 ⑤ 양쪽 콘텐츠 쓰기 동결 시작** |
| 계획 밖 초안 8건의 정체 | 2026-09-21에 생성된 **관리자 화면 테스트 데이터**. 전부 slug 없음. `memo/draft` “테스트 메모”, `post/draft` “제목” 1 + “제목 없음” 4, `tag/draft` “TypeScript”, `tag/published` “Nextjs15”(이 1건은 지금 공개 저장소를 켜면 노출된다). 삭제 전 목록: `artifacts/cms/m9/foreign-drafts-pre.txt` |
| 계획 밖 초안 8건 처리 | **2026-09-23 삭제 완료(A안, 사용자 승인).** `entry_references` 1행 + `entries` 8행 삭제 → `entries`/`entry_bodies`/`content_addresses`/`entry_references` 모두 0. `folderCount` 1·Payload 19개 테이블은 미접촉. 사후: `target-inspection-post-cleanup.json` |
| 실패 시 동작 | 쓰기 전 실패는 0행 변경. 트랜잭션 중 충돌은 전체 롤백(부분 적재 없음). 적재 후 검증 실패면 **플래그를 켜지 않으므로 공개 영향 0** |
| 되돌리기 | `CMS_PUBLIC_REPOSITORY`를 되돌리고 재배포한다. 적재 행은 그 상태에서 공개에 쓰이지 않으므로 **삭제하지 않는다**(O1: 자동 삭제 금지) |
| 이 승인이 여는 것 | M9-BE-1 실행만. **공개 전환(M9-BE-2)과 Keystatic 제거(M9-BE-3)는 별도 승인**이다 |

#### 먼저 풀아야 할 결정: 운영 DB의 계획 밖 초안 8건

현재 운영 DB에 이관 계획에 없는 CMS 초안 8건(post 5, memo 1, tag 2)이 있다(§11.2). R2 P0-1을 반영해 `apply-production`은 **계획 밖 항목이 있는 대상에 쓰기를 거부**한다. 따라서 지금 상태로는 이관이 실행되지 않는다.

| 안 | 내용 | 필요한 후속 |
| --- | --- | --- |
| **A. 기존 초안 정리** (권장) | 개발 중 생긴 임시 초안을 보관·삭제해 `entries`를 0으로 만든 뒤 이관 | 초안 8건을 보존할지 확인하고, 삭제 전 목록·본문을 확인한다 |
| B. 섞어서 이관 | 기존 초안을 두고 이관 | 가드를 완화하는 **별도 변경 + 독립 검수**가 필요하다. 지금은 지원하지 않는다 |

두 안 모두 기존 초안은 이관 데이터와 ID·slug가 겹치지 않는다(§11.3). 차이는 "비어 있지 않은 DB에 새 콘텐츠를 섞는 것을 승인하느냐"뿐이고, 그래서 승인이 필요하다.

승인 요청에는 동결 시작·해제 시점을 함께 확정해야 한다. 동결이 없으면 이관과 공개 결과가 실행 중에 달라진다.

동결 범위는 양쪽이다. Keystatic 측(원본 파일)은 위 지문 검사가 기계적으로 막는다. **CMS 관리자 쓰기 측은 기계적으로 막을 수 없으므로 운영 약속으로 둔다** — 이관 직후부터 M9-BE-2 관찰 기간 종료까지 관리자 편집·발행을 멈춘다. 지문은 이미지 바이트까지는 덮지 않으므로, 이미지 원본 해시는 `cms:migration:inspect` 출력으로 함께 기록한다.

---

## 12. 로컬 리허설에서 찾은 것 (M9-TW-1 선행)

테스트 DB(`CMS_TEST_DATABASE_URL`, 운영과 다른 Neon 브랜치)의 격리 schema에 이관한 뒤,
파일 기반(Keystatic)과 DB 기반(Postgres) 사이트를 각각 띄워 같은 주소를 대조했다.
운영 DB는 접촉하지 않았다.

### 12.1 P0 · 한글 slug가 전부 500 (수정 완료)

**증상:** `/posts/*`, `/memos/*` 중 **한글이 들어간 모든 주소**가 500.

**원인:** Next는 동적 세그먼트를 **퍼센트 인코딩된 채로** 넘긴다(`%EB%B8%94…`).
조회는 리포지토리가 `sanitize`로 디코딩해 성공하는데, 페이지는 원문을 그대로 `post.slug`와 비교했다:

```ts
if (post.slug !== slug) permanentRedirect(`/posts/${post.slug}`);
//   "블로그라면…" !== "%EB%B8%94…"  →  항상 참
//   → location 헤더에 한글 → ERR_INVALID_CHAR → 500
```

`git log` 확인 결과 이 코드는 **M9 이전**(M7-BE-2 `9859031`)부터 있었고 **main에 있다**. 제 회귀가 아니다.
기존 테스트가 이 비교를 덮지 않아 놓쳤다.

**수정:** 조회와 같은 규칙(`normalizeSlug`)으로 정규화한 뒤 비교하고, 리다이렉트 대상은
`encodeURIComponent`로 인코딩한다. `posts/[slug]`와 `memos/[slug]` 둘 다.
회귀 테스트 `page.test.ts`는 수정 전 코드에서 실패하고 수정 후 통과한다.

### 12.2 P0 · 게시일 해석 차이 — **B안으로 확정(사용자 판단)**

원본 frontmatter는 49편 전부 `publishedDateTimeISO: 2026-01-05T19:38:00.000Z`처럼 UTC를 명시한다.
그러나 **이 `Z`는 Keystatic의 버그로 한국 시간이 UTC로 잘못 저장된 값**이다(사용자 확인).
실제 의도한 시각은 **19:38 KST**다.

| | Keystatic(현재 운영) | 수정 전 DB | 수정 후 DB |
| --- | --- | --- | --- |
| 해석 | `Z`를 버리고 naive를 지역시각으로 | 원본 UTC를 그대로 신뢰 | wall-clock을 KST로 해석 |
| 화면 날짜 | 2026년 1월 5일 | 2026년 1월 6일 ✗ | **2026년 1월 5일** ✓ |
| RSS `pubDate` | `09 Apr 18:12 GMT` | `10 Apr 03:12 GMT` ✗ | **`09 Apr 18:12 GMT`** ✓ |

**수정:** `import-plan.ts`의 `keystaticPublishedAt`이 오프셋을 떼고 `+09:00`을 붙인다.
표시 날짜(`metadata.publishedAt`)와 공개 시각 컴럼 둘 다 같은 값을 쓴다. 오프셋을 명시하므로
서버 타임존과 무관하게 같은 날짜가 나온다.

**검증:** 발행 **48편 전수에서 표시 날짜 불일치 0건**(`verify-dates.mjs`), RSS `pubDate`도 현재 사이트와 동일.
회귀 테스트 `published-at-seoul.test.ts`(2건).

**승인 지문이 바뀌었다:** `00dcccc1…` → **`70794ce90e83db05d5acb3f5d91bf7d10c2ffb012eae377669d632643c3cbbf4`**.
타임스탬프가 metadata를 거쳐 contentHash에 들어가기 때문이다. 승인은 **새 지문**으로 받아야 한다.

### 12.3 본문 등가성 및 실제 브라우저·에디터 검증

데이터 수준 대조(`public-parity.test.tsx`, 격리 schema에서 운영 경로로 이관)는 **48편 본문 렌더가
원본과 동일**하고 **97개 본문(49편 × working + 48편 published)이 TipTap으로 로드되며 재저장해도
문서가 달라지지 않음**을 고정한다.

테스트 DB에 이관한 뒤 실제 Chrome으로 전수 확인했다.

| 검사 | 결과 |
| --- | --- |
| 공개 48편 브라우저 렌더 | 오류 0, 깨진 이미지 0, 이미지 22장(원본과 동일), p 580·코드블록 115 |
| 공개 메타 | 전편 h1·제목·날짜 존재, 표시 날짜 48/48 의도와 일치 |
| 에디터 49건 | `.ProseMirror` 로드 49/49, 빈 본문 0, 본문 120,771자·p 611·제목 235·코드블록 187·이미지 18 |
| 에디터의 MDX 원문 블록 | callout·mermaid·차트·수식·표가 “원문 모드에서 편집” 카드로 보존됨 |

HTTP 수준 대조는 날짜(§12.2)와 RSC 스트리밍 placeholder 차이를 제외하면 46/48 일치했고,
남은 2편은 로컬 Keystatic 서버가 프로덕션 모드에서 GitHub 리더를 타 `<title>GitHub</title>`을
돌려주는 등 **로컬 서버 자체가 신뢰할 수 없어** HTTP 대조를 확정 근거로 쓰지 않는다.
전환 시점에 두 배포로 다시 대조한다.

**커스텀 컴포넌트 전수 확인(실제 Chrome, DB 모드):**

| 컴포넌트 | 공개 렌더 근거 |
| --- | --- |
| `Callout` (6편) | NOTE/TIP 박스, `.not-prose` 5개 |
| `Tabs`/`Tab` (3편) | `role=tablist` 2·`role=tab` 4·`role=tabpanel` 4 (Radix) |
| `Collapsible` (34편) | `aria-expanded` — 접기/펴기 동작 |
| `:tooltip[...]` (8편) | Radix 트리거 `data-state="closed"` |
| `mermaid` (8편) | SVG 렌더, 문법 오류 0 |
| `chart` (1편) | Recharts 래퍼 + SVG |
| `u`/`br` | 인라인 |

에디터에서는 컴포넌트를 컴포넌트로 그리지 않고 **“원문 모드에서 편집” 카드**(opaque block, 총 130개)로
보존한다. `:::collapsible`·`:::callout`·`:::tab`·`@char Tooltip`이 카드 안에 그대로 보이는 것을 확인했다.

수식(`$$`) 초안(`js의-비동기-처리-메커니즘`)도 에디터에서 확인했다 — `math · 원문 모드에서 편집`
카드로 원문이 보존되고, 공개 경로는 404(초안 비공개)다. 이로써 **75건 전부**(공개 48편 + 초안 1편 +
에디터 49건)를 실제 브라우저로 확인했다.

**`@char Tooltip` 코드블록 주석은 공개 화면에 안 그려진다 — 그러나 M9 회귀가 아니다.**
`data-anno-*` 마크업이 0인데, **파일 기반(현재 운영) 모드에서도 같은 글이 0**이다. 주석 줄 자체는
DB에 그대로 남아 있다(`@char` 4/4). 즉 이 기능은 지금도 공개 렌더에 나타나지 않는다.

**검증 중 발견한 기존 결함(이관 차단 요소는 아님):** 에디터 우측 패널의 “발행 일시” 입력은
`useState("")`로만 시작해 **로드된 값으로 초기화되지 않고 저장에도 쓰이지 않는다**(M9 이전
`13e733a`부터). 이관된 날짜는 `published_at` 컬럼과 `metadata.publishedAt`에 있고,
저장은 기존 metadata를 보존하므로(`...(entry?.working.metadata || {})`) **지워지지 않는다**.
즉 날짜는 정상 표시되지만 에디터에서 바꿀 수는 없다.

### 12.4 부수적으로 추가한 것

`CMS_SCHEMA` 환경변수. 같은 DB를 여러 schema로 나눠 쓰는 미리보기/스테이징용이다.
미설정이면 기존과 동일하게 `public`을 쓴다.

---

## 13. 범위 밖

- 사용자 정의 컬렉션/스키마 빌더와 웹 기반 확장 시스템(M9 이후 별도 v2).
- 과거 본문 버전 이력/복원 UI.
- 승인되지 않은 콘텐츠 원본 삭제, 이미지 최적화·자동 다운로드.
- 공개 저장소 전환 이후 Keystatic을 즉시 제거하는 것(안정화 및 별도 승인 전 금지).
