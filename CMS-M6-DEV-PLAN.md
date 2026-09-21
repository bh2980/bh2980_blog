# CMS M6 개발 계획 (이전·내보내기 검수)

- 작성: 2026-09-22 · 기준 문서: `CMS-V1-IMPLEMENTATION-PLAN.md` M6, `CMS-SPEC.md` §10.1 / §11.3 / §11.4
- 통합 브랜치: `feature/new-cms` @ `b78a9c8` (M0–M5 DONE)
- 원칙: **1 마일스톤 = 1 관심사(전환 예행연습)**. 운영 DB 접촉·운영 전환·Keystatic 제거는 하지 않는다.

## 1. 종료 조건

| ID | 내용 | 선행 | 담당 | 완료 조건 | 검증 |
| --- | --- | --- | --- | --- | --- |
| M6-BE-1 | 내보내기 API | M3-BE-1 (DONE) | BE | 인증된 `GET/POST /api/cms/v1/export`. 초안이 공개 스키마로 나가지 않음 | 픽스처 export 스냅샷 |
| M6-BE-2 | 기존 콘텐츠 시험 가져오기 | M0-INV-3, M1-DA-1, M1-ED-1 (전부 DONE) | BE+DA | 시험 스키마에 post/memo/tag/category/collection 적재, 공개 slug 유지, 원본 파일 불변 | 시험 DB 카운트 vs 파일 목록, slug 집합 비교 |
| M6-ED-1 | 이전 본문 왕복 검수 러너 | M1-ED-1, M6-BE-2 | ED | 전편(49 MDX) analyze→serialize→analyze→공개 렌더 안전 검사. 실패 목록이 비거나 전환 차단으로 분류 | CI에서 러너 실행 |
| M6-RV-1 | Milestone 6 검수 | M6-BE-1/2, M6-ED-1 | RV | 위 3건 증거 검수 + oracle 감사 반영 확인 | 리뷰 보고서 |

Milestone 종료 = §11.3 단계 1–6의 **시험** 도구 + §11.4 내보내기가 동작하고, 잔여 실패가 "전환 차단/비차단"으로 분류된 상태.

## 2. 착수 전 사실 (코드베이스 조사 결과)

### 2.1 재사용할 것

| 영역 | 위치 | 내용 |
| --- | --- | --- |
| 스토어 | `src/cms/adapters/postgres/content-store.ts` | `createEntry`, `getEntry`, `saveWorking`, `publishEntry`, `listEntries`, `listFolders`, `listMediaAssets`, `listTemplates`, `getPreferences`, `getWorkingReferences`, `getPublishedReferences`, `createEntryWithReferences`, `saveWorkingWithReferences`, `migrateContentStore` |
| 서비스 | `src/cms/services/content-service.ts` | `prepareSnapshot`(metadata/mdx 검증 + `contentHash` + 참조 추출), `validateForPublish`, `createContentService` |
| MDX | `src/cms/mdx/*` | `analyze` → `toDocument` → `serialize`, `splitFrontmatter`, `parseYamlMapping`, `serializeFrontmatter` |
| API 패턴 | `src/app/api/cms/v1/**` | `authGateway.verifyAdmin()` + `validateSameOrigin()` + `handleApiError()` + zod 스키마(`src/cms/core/api.ts`) |
| 테스트 DB | `src/cms/adapters/postgres/__test__/test-database.ts` | `CMS_TEST_DATABASE_URL` + 격리 스키마 생성/삭제 (`CMS_DATABASE_URL` 사용 금지) |
| 마이그레이션 | `src/cms/adapters/postgres/migrate-cli.ts` | CLI 진입 패턴 |

### 2.2 없는 것 (M6에서 신규)

- `/api/cms/v1/export` 라우트 및 export 서비스
- `src/cms/migrate-from-files/**` (읽기 전용 보고 + 시험 적재 스크립트)
- 결정적 ID 주입 경로 — `createEntry`는 ID를 받지 않고 생성함 (`CreateEntryInput`에 `id` 없음)
- `importedAt` 저장 위치 (스키마에 해당 컬럼 없음)
- 전편 왕복 러너 (`src/cms/mdx/__test__/roundtrip.test.ts`는 표본 수준)

### 2.3 이전 대상 데이터 (`CMS-CONTENT-INVENTORY.md`)

| 구분 | 값 |
| --- | --- |
| MDX | 49 (posts 7, memos 42) |
| record | categories 3, tags 22, collections 1 (memo 22개 참조) |
| 이미지 | 상대 경로 22장(5개 파일), 전부 `alt=""` |
| 알려진 이슈 | `status` 누락 1건, 빈 `tags` 1건, 날짜 누락 0건 |

### 2.4 작업 위치

`feature/new-cms`는 `/Users/bh2980/Desktop/bh2980_blog`(main worktree)에 체크아웃되어 있고, Orca 워크스페이스 `.../orca/workspaces/bh2980_blog/scup`에는 잠겨 있어 같은 브랜치를 동시에 체크아웃할 수 없다.

- 기본안: 계획서 관행대로 배치마다 `git worktree add /Users/bh2980/Desktop/bh2980_blog-worktrees/m6-b<n> -b cms/wt/m6-b<n> feature/new-cms` 생성 → 배치 종료 시 `feature/new-cms`로 병합 → worktree 삭제.
- 대안: Orca 워크스페이스에서 `bh2980/m6-*` 브랜치를 `feature/new-cms`에서 분기해 작업 후 병합.

## 3. 배치 구성

### 배치 1 — M6-BE-1 내보내기 API

- 산출물: `GET/POST /api/cms/v1/export`, export 서비스, 아카이브 스키마, 픽스처 스냅샷 테스트
- 예상 영향 파일
  - `src/app/api/cms/v1/export/route.ts` (신규)
  - `src/cms/services/export-service.ts` (신규, 기존 스토어 조회 조합)
  - `src/cms/core/api.ts` (export 쿼리/바디 zod 스키마)
  - `src/cms/adapters/postgres/content-store.ts` (필요 시 읽기 전용 조회 1–2개만 추가)
  - `src/app/api/cms/v1/export/__test__/*` 또는 픽스처 테스트
- 완료 조건: 인증 없이는 401/403, 초안은 공개 scope 응답에 미포함, 스냅샷 결정적(정렬·타임스탬프 고정)

### 배치 2 — M6-BE-2 시험 가져오기

- 산출물: 읽기 전용 검사 보고서(dry-run), 안정 ID 매핑, 시험 스키마 적재, 멱등 재실행, `CMS-CONTENT-INVENTORY.md` 갱신
- 예상 영향 파일
  - `src/cms/migrate-from-files/{cli,inspect,map-ids,import}.ts` (신규)
  - `src/cms/adapters/postgres/content-store.ts` (결정적 ID 적재 경로 — 방식은 O1에서 고정)
  - `package.json` (`cms:import:inspect`, `cms:import:dry-run`, `cms:import` 스크립트)
  - `src/cms/migrate-from-files/__test__/**` 계약 테스트
- 완료 조건: 시험 스키마에 49건 + record 적재, 공개 slug 동일, 재실행 시 중복 0건, 원본 `src/contents/**` 무변경, 운영 DB 접속 불가 가드 동작

### 배치 3 — M6-ED-1 왕복 검수 러너

- 산출물: 전편 왕복 러너 + 정규화/손실 구분 보고서
- 예상 영향 파일
  - `src/cms/mdx/__test__/corpus-roundtrip.test.ts` (신규, DB 불필요 — `src/contents/**/*.mdx` 49개)
  - `src/cms/migrate-from-files/roundtrip-report.ts` (신규, 가져온 DB 본문 대상 실행)
- 완료 조건: 49/49 실행, 실패 0건이거나 잔여 항목이 "전환 차단/비차단"으로 분류되고 차단 항목 0건

### 배치 4 — M6-RV-1 마일스톤 검수

- 배치 1–3 증거(커밋 SHA, 명령, 결과)와 oracle 감사(O2) 반영 내역을 대상으로 최종 검수.

의존 관계: 배치 1과 2는 서로 독립이지만 **아카이브 형식과 ID 전략을 공유**하므로 O1에서 함께 고정한다. 배치 3은 배치 2 결과에 의존하므로 배치 1·2 병렬 진행 후 착수한다.

## 4. Oracle 자문 시점

### O1 — 착수 전 (배치 1 시작 전, 1회)

목적: 재작업을 유발하는 형식·ID·스키마 결정을 먼저 고정한다. 산출물은 결정 목록(각 항목에 채택안 + 근거 + 롤백 조건).

| # | 안건 | 쟁점 |
| --- | --- | --- |
| A1 | export 응답 형식 | ZIP 스트리밍 vs 단일 JSON 아카이브 vs 다중 응답(manifest + 항목별) |
| A2 | scope 분리 | 관리자 백업(초안+공개본) vs 공개 스키마(공개본만) 분리 방식, "초안 미포함" 보장 위치 |
| A3 | "설정" 포함 범위 | §10.1의 "콘텐츠·설정 내보내기"에서 preferences / body_templates / schedules 포함 여부 |
| A4 | 일관성·결정성 | 스냅샷 트랜잭션 격리 수준(REPEATABLE READ 필요 여부), 정렬 키, `exportedAt`을 스냅샷에서 제외하는 규칙 |
| A5 | 안정 ID 전략 | `createEntry`에 결정적 ID 주입 vs UUIDv5 매핑 vs id-map 파일. §11.4 "ID를 유지"와 §11.3 "재실행 중복 없음" 동시 충족 |
| A6 | `importedAt` 위치 | `entries.imported_at` 컬럼 추가(마이그레이션 + 드리프트 테스트) vs working metadata 기록 |
| A7 | 상태·날짜 규칙 | `status` 누락 1건 정책, 알 수 없는 시각은 null, `firstPublishedAt/lastPublishedAt` 처리 |
| A8 | 이미지 22장 범위 | 보고만(권장) vs `media_assets` ready 등록. M7 전환 시 별도 목록·체크섬 요구(§11.3-6)와의 경계 |
| A9 | 충돌·재실행 규칙 | 기존 `(collection, slug)` 충돌 시 중단·보고 형식(§11.4), 재실행 스킵 판정 키 |
| A10 | 왕복 판정 기준 | 정규화 허용 목록(인용부호·태그 표기·프론트매터 재직렬화·공백) vs 손실 판정, 공개 렌더 검사 범위(파싱만 vs 플러그인 체인 실행) |
| A11 | DB 안전 가드 | 운영 DB 오접속 방지 설계(`CMS_TEST_DATABASE_URL` 강제, schema 필수, `CMS_DATABASE_URL` 거부) |

### O1 결정 기록 (2026-09-22, oracle 자문 완료)

| # | 결정 | 채택안 | 비고 |
| --- | --- | --- | --- |
| A1 | export 응답 | 스트리밍 ZIP. `manifest.json` + 항목별 metadata JSON/MDX + 관계·설정·미디어 목록을 고정 경로에 배치. 헤더 전에 DB snapshot·검증 완료 | ZIP writer는 외부 의존성 없이 구현, CRC32·결정적 mtime |
| A2 | scope 분리 | 관리자 백업과 공개 projection을 분리. 공개 DTO에는 `working` 필드가 없고 published 없는 엔트리는 공개 projection에서 제외. 런타임 allowlist projection + zod 검증 | 타입만으로 유출 방지하지 않음 |
| A3 | "설정" 범위 | admin에 folders, body_templates, schedules, user_preferences, content_addresses 전부 포함. 환경변수·자격증명·cms_migrations 제외 | preferences 원시 테이블 중복 출력 금지 |
| A4 | 일관성·결정성 | `REPEATABLE READ READ ONLY` 트랜잭션에서 전체 읽고 commit 후 ZIP 생성. 정렬은 entity-kind→ID→state, 참조는 source ID→relation→ordinal. `exportedAt`은 manifest에만 두고 digest에서 제외 | |
| A5 | 안정 ID | 스토어에 **전용 explicit-ID import 경로** 추가(일반 `createEntry`에는 ID 입력 비공개). legacy 최초 ID는 UUIDv5, 키는 `kind + NUL + NFC(repo-relative POSIX path)`. 이후 manifest ID가 권위. slug는 키로 쓰지 않음 | case-fold 충돌은 사전 오류 |
| A6 | `importedAt` | **저장하지 않음.** 실행 시각·출처는 manifest/import report에 기록 | 스키마 확장 없음(M0-INV-1 드리프트 되살리지 않음) |
| A7 | 상태·날짜 | status 누락 = **draft**(Keystatic 기본값). published 항목의 날짜는 `publishedAt`에만 매핑, `firstPublishedAt`/`lastPublishedAt`은 null. draft는 세 필드 null, 원본 날짜는 working metadata와 보고서에만 | 암묵적 published 승격 금지 |
| A8 | 이미지 22장 | **보고만.** 경로·참조 수·존재·size/MIME·SHA-256·예상 R2 key 목록화. `media_assets ready` 선등록 금지 | 실물 없는 ready = 거짓 상태 |
| A9 | 충돌·재실행 | 전체 preflight 후 **단일 트랜잭션·전체 롤백.** 동일 ID+동일 canonical digest만 skip. 동일 ID+상이 digest, 동일 (collection,slug)+다른 ID는 쓰기 전 409 중단. 보고서는 `artifacts/cms/m6/<archiveDigest>/import-report.json` | 부분 성공·upsert 덮어쓰기 금지 |
| A10 | 왕복·렌더 판정 | metadata canonical 값 + MDX canonical AST 동일. 정규화 허용(LF/final newline, YAML key 순서·따옴표, JSX quote/공백, 의미 동일 escape, 무의미 blank) 
/ 손실(공백 접힘, 코드·수식·URL·alt·JSX props/children·참조 순서 변경, unknown node 삭제). 49건 전편을 production remark/rehype 체인에 태워 검사. 별도 runner가 JSON 보고서, vitest는 규칙 단위 테스트 | parse-only로 낮추지 않음 |
| A11 | 운영 DB 가드 | `CMS_TEST_DATABASE_URL`만 사용, `--url` 미지원, `CMS_DATABASE_URL`과 동일하면 즉시 실패, `cms_m6_*` 격리 schema 생성 후 `migrateContentStore(pool,{schema})` 명시 전달, SQL은 schema-qualified | sentinel은 테스트 DB에서 확인 |

추가 리스크(자문 지적): ① `handleApiError()`가 413/415/428/503을 표현하지 못함 → import/export 오류 타입 확장 필요, ② entity/ID 선생성 후 body/reference 적재하는 2-pass 필수, ③ `type-challenges.yaml`의 legacy `meta.value.memo` 형식을 현재 Keystatic reader로 재해석 금지 → 별도 legacy 파서 fixture.

### O2 — 배치 3 완료 후, M6-RV-1 전 (1회)

목적: M2 관행과 동일한 **독립 감사**. 구현 결과물을 대상으로 데이터 손실·초안 유출·멱등성·DB 안전·왕복 무손실 관점을 감사한다. 결과는 위험 등급별 수정 배치로 환산하고, 반영 후 reviewer 재리뷰로 넘긴다.

### 추가 자문 트리거 (O1/O2 외)

1. 배치 1·2 진행 중 스키마 변경(컬럼·인덱스 추가)이 필요해진 경우
2. 왕복 러너의 "공개 렌더" 경로가 M7-BE-1(DB repository) 구현 없이는 실행 불가로 판명된 경우
3. 결정적 ID 전략이 스토어 확장 범위를 넘어 발행·복제 로직에 영향을 주는 경우

## 5. Reviewer 리뷰 시점

| 회차 | 시점 | 대상 | 통과 조건 |
| --- | --- | --- | --- |
| R1 | 배치 1 완료 직후 (병합 전) | 내보내기 API 코드 + 스냅샷 테스트 | 중대 위험 없음 판정 |
| R2 | 배치 2 완료 직후 (병합 전) | 가져오기 스크립트 + 시험 적재 결과 + 운영 DB 가드 | 중대 위험 없음 판정 |
| R3 | 배치 3 완료 직후 | 왕복 러너 + 실패 분류 보고서 | 중대 위험 없음 판정 |
| R4 | O2 감사 반영 후 (M6-RV-1) | 배치 1–3 전체 증거 | 마일스톤 검수 승인 |

### 판정 규칙 (사용자 지시 반영)

- reviewer 지적은 **등급을 먼저 분류**한다. 등급 라벨: P0(중대) / P1(중대 가능) / P2(비차단).
- **중대한 위험이 있는 경우에만** 수정 후 재리뷰를 요청한다. 그 외(P2, 문서·스타일·UX·성능 개선)는 계획서에 기록만 남기고 다음 배치로 진행한다.
- 중대 위험으로 취급하는 기준(이 중 하나라도 해당하면 수정 + 재리뷰)
  1. 데이터 손실·오염 (원본 MDX 훼손, 본문/참조 유실, 잘못된 상태 전이)
  2. 운영 DB 접촉 또는 오접속 가능성 (테스트 가드 우회)
  3. 초안·보관·휴지통 콘텐츠의 공개 노출
  4. 인증·동일 출처(CSRF)·정보 노출 결함 (storageKey 등 관리자 전용 정보의 공개 스키마 유입)
  5. 멱등성 위반 — 재실행 시 중복 생성 또는 기존 데이터 조용한 덮어쓰기
  6. 왕복 무손실 조건 위반 — 코드 주석 메타데이터·JSX 속성·표·수식·이미지 의미 손실
- reviewer 위임 시 매번 다음을 함께 요구한다: ① "중대한 위험 존재 여부" 명시 판정, ② 근거 커밋 SHA와 실행 명령·결과, ③ 등급 라벨.
- "위험 없음" 판정을 받으면 즉시 다음 배치로 진행한다(추가 재리뷰 없음).

## 6. 검증 명령 (모든 배치 공통)

```bash
# 계약·단위 테스트 (repo 관행)
node --env-file=.env.local node_modules/vitest/vitest.mjs run

# 타입·린트·빌드
pnpm typecheck
pnpm exec biome check .
pnpm build

# 배치 2 산출물 (예정)
pnpm cms:import:inspect   # 읽기 전용 보고 (DB 쓰기 없음)
pnpm cms:import:dry-run   # 시험 스키마 적재 + 보고서, 원본 불변
pnpm cms:import           # 재실행 멱등성 확인용
```

배치 1은 추가로 인증 없는 요청 401/403, 공개 scope에 초안 미포함을 확인한다.

## 7. 리스크와 대기 결정

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| A4·A5 미고정 상태로 배치 1 착수 | export 형식 재작업, 배치 2 재작업 | O1 선행 필수 |
| `entries.imported_at` 컬럼 추가 | M0-INV-1 드리프트 테스트 갱신 필요 | O1에서 컬럼 vs metadata 결정 |
| 49건 전편 왕복에서 손실 발견 | 전환 차단 이슈, M7 일정 영향 | 배치 3에서 조기 검출, 실패 등급 분류 후 O2에서 처리 방침 결정 |
| 배치 3의 공개 렌더 경로가 M7 의존 | 배치 3 착수 불가 | 트리거 2로 O1에서 사전 확인 |
| 로컬 Postgres 미가동 | DB 계약 테스트 skip | 착수 전 `CMS_TEST_DATABASE_URL` 접속 확인을 사전 점검 항목으로 둔다 |

## 8. 완료 후 갱신

1. `CMS-V1-IMPLEMENTATION-PLAN.md` 진행 상태 표: M6-BE-1, M6-BE-2, M6-ED-1, M6-RV-1을 DONE으로 갱신(worktree·commit·검증 열 포함)
2. `CMS-V1-IMPLEMENTATION-PLAN.md` 계획 변경 로그: O1 결정, 배치별 reviewer 판정, 비차단 P2 목록, O2 감사 결과
3. `CMS-CONTENT-INVENTORY.md`: 배치 2 dry-run 결과(재집계 수치, 미디어 22장 목록, `status` 누락 처리 결과)로 갱신
4. 미해결 비차단 항목은 M7 착수 전 확인 목록으로 이관
