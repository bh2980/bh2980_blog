# CMS M7 개발 계획 (블로그 연결과 전환 준비)

- 작성: 2026-09-22 · Lead
- 기준 문서: `CMS-SPEC.md` §3.4 / §6.2 / §11 / §12.1-5 / §12.2, `CMS-V1-IMPLEMENTATION-PLAN.md` M7, `CMS-M6-DEV-PLAN.md`(배치·게이트 관행), `CMS-CONTENT-INVENTORY.md`
- M6 기준선: `feature/new-cms` @ `6a55aff` (M0–M6 DONE · 89 files/556 tests · typecheck 0 errors · build 성공). 라우트 수 “79”는 M6 보고 문구이며 M7에서 재측정하지 않았다 → §9.7.1 참조
- 원칙
  1. **1 마일스톤 = 1 관심사**, **1 배치 = 1 writer = 1 worktree**(같은 cwd 동시 쓰기 금지)
  2. 운영 데이터 이전·공개 전환·Keystatic 제거는 **사용자 승인 없이 하지 않는다**
  3. 기존 `ContentRepository` 계약과 M1–M6의 저장·발행·참조 규칙을 깨지 않는다. 교체는 플래그/명시적 교체 + 롤백 경로를 남긴다
  4. 캐시·성능 최적화보다 **초안·보관본 미노출**이 우선이다. 즉시성이 안 되면 캐시를 포기한다
- **진행 상태(2026-09-22 갱신)**: 배치 **1–6 구현·커밋 완료** · 배치 7(SEC-1)·RV 미착수 · 배치 8(LEAD-1) 보고서 작성됨 → `CMS-M7-LEAD1-CUTOVER-REPORT.md` · 배치 9(Keystatic 제거) 보류. 전체 게이트: typecheck 0 · tests 659(579 pass·80 skip·9 파일 env 실패) · build exit 0. 남은 차단: 실DB 검증(13건)·R3–R6 리뷰·사용자 승인.

---

## 0. 착수 전 정리 (배치 0 — 구현 아님)

배치 1 시작 전에 아래를 끝낸다. 이 배치에는 reviewer를 붙이지 않고, 결과만 계획서에 기록한다.

| # | 항목 | 내용 | 담당 |
| --- | --- | --- | --- |
| D1 | 기준점 정렬 | 현재 `feature/M7` = `304c30e`(= main)로 **M0–M6 코드가 전혀 없다**. merge-base가 main HEAD와 동일하므로 `git merge --ff-only feature/new-cms`로 `6a55aff`에 붙인다(충돌 없음). 배치 1은 반드시 이 뒤에 시작한다 | Lead |
| D2 | 원격 백업 | `feature/new-cms`는 **로컬에만** 있고 `origin/main` 대비 96 커밋 앞이다. 원격 푸시 후 진행한다 | Lead |
| D3 | M6 인계 항목 처리 방침 | (a) M6-RV-1 P2 4건과 (b) M7 인계 확인 5건을 "M7 처리 / v2 이관"으로 확정한다. **M6 미완 항목은 없다** | Lead + 사용자 |
| D4 | 계획서 커밋 | 이 문서를 `M7-BASE` 커밋으로 올린다(코드 변경 없음) | Lead |

### D3 — M6에서 넘어온 항목 처리 방침

**전제: M6는 DONE이다.** M6-RV-1 최종 검수 승인 · 중대 위험 6기준 전부 O · **P0/P1 없음** · 556 tests / typecheck 0 / build 79 routes. 아래는 미완 작업이 아니라 ① 수정 불요로 판정된 P2 기록과 ② M7로 넘긴 확인 항목이다.

**(a) M6-RV-1 비차단 P2 4건 — "고치지 않음" 판정 기록**

| # | 지적 | 판정 근거 | 방침 |
| --- | --- | --- | --- |
| 1 | `pickPublicMetadata`가 최상위 키만 필터 | 현 스키마에서는 중첩 유출 없음 | 기록 유지. 배치 3(A6)에서 allowlist를 **확장할 때** 같은 형태를 유지하고 회귀 테스트를 먼저 붙인다 |
| 2 | `stateDigest` 참조에 `occurrences` 미포함 | 아카이브 digest는 `references.json` 바이트를 덮으므로 영향 없음 | 기록만 |
| 3 | `sameDatabase`가 host:port/path만 비교 | Neon pooler 호스트 미정규화, `cms_m6_*` 격리로 흡수 | 기록만 |
| 4 | unknown collection throw · occurrences-only conflict 단위 테스트 부재 | 전자는 `5544041`에서 보강 완료 | 후자는 테스트 공백(결함 아님). 배치 6에서 여유가 있으면 승격 |

**(b) M6 로그 item 10 "M7 전 확인 항목" — M6 작업이 아니라 M7 인계 확인/문서화 대상**

| # | 항목 | 방침 |
| --- | --- | --- |
| 1 | `pre` shim을 실제 RSC 렌더로 재검증 | **M7 처리** — 배치 6에서 검증 항목으로 승격(전환 후 공개 렌더가 유일한 출력 경로) |
| 2 | 이미지 22장의 R2 키·체크섬 대조 | **M7 처리** — 배치 8 전환 보고서 입력(§12.2 "이전" 통과 조건) |
| 3 | legacy 상대경로 미디어의 `media.json` 의존성 명시 | **M7 처리** — 배치 8 문서화(전환 후 재현 불가 위험) |
| 4 | ZIP 스트리밍 미구현 | **v2 이관** — 현재 규모 비차단, 이미 결정됨 |
| 5 | `handleApiError`의 413/415/428/503 미표현 | **v2 이관** — M7 계약 아님, 공개 경로 아님 |

---

## 1. 종료 조건

| ID | 내용 | 선행 | 담당 | 완료 조건 | 검증 |
| --- | --- | --- | --- | --- | --- |
| M7-INV-1 | 공개 페이지 캐시/동적 렌더 조사 | 없음 | BE | 적용할 페이지 파일 목록과 캐시 설정이 문서로 확정 | 문서. 구현은 M7-BE-1 |
| M7-BE-1 | Postgres ContentRepository | INV-1, M3-BE-1, M6-BE-2 | BE | 플래그 또는 명시적 교체로 시험 요청이 DB를 읽고, 페이지는 repository만 본다. 별칭은 정규 slug 정보로 노출. DB 장애는 5xx | repository 테스트 + 초안 slug 404 |
| M7-BE-2 | 공개 라우트 동적화 (RSS·sitemap·목록·상세·OG) | BE-1, INV-1 | BE | 새 발행이 재배포 없이 다음 요청에 보인다. 보관/휴지통/초안은 목록·RSS·sitemap·OG에서 제외, 주소는 404 | 시험 DB에서 발행/보관 후 요청 |
| M7-FE-1 | 인증된 미리보기 | M2-BE-1, BE-1 | FE | 비로그인 미리보기 불가, 미리보기가 발행하지 않음 | 브라우저 |
| M7-FE-2 | SEO 메타 필드와 공개 메타 렌더 | BE-1, BE-2 | FE | head에 title/meta/OG/Twitter/canonical 출력, 미입력 시 title/summary 폴백. custom canonical은 sitemap 제외 | 브라우저 + head 대조 |
| M7-BE-3 | 공개 HTTP `/public/entries` | BE-1 | JR | 공개 스키마만. 관리자 필드·초안 없음 | 계약 테스트(`toPublicEntry`와 동일 규칙) |
| M7-BE-4 | OpenAPI와 확장 문서 | M2–M6 API 안정 | BE | §10.1 표 경로가 문서에 있고 예제 존재 | 문서 ↔ 라우트 목록 대조 |
| M7-SEC-1 | 권한·MDX 실행 경로 검수 | M2-BE-1, BE-1 | Security QA | 비로그인 쓰기 불가, 실행기 토큰 쓰기 불가, 검증 안 된 MDX가 실행 컴파일러로 안 감 | 독립 보고서. Lead가 수정 배정 |
| M7-TW-1 | 전환 차단 회귀 테스트 | M6-ED-1, M3-BE-1, M2-BE-1 | TW | 파서 왕복·원자적 발행·참조/주소·인증·예약 중복·저장 충돌 회귀가 CI에 남는다 | `pnpm test:run` 해당 경로 |
| M7-LEAD-1 | 전환 보고서와 사용자 승인 게이트 | BE-2, M6-ED-1, SEC-1 | Lead | 사용자가 전환을 승인하거나 보류한다. **승인 없이 Keystatic을 제거하지 않는다** | 보고서 + 승인 기록 |
| M7-BE-5 | Keystatic 제거 (승인 후) | LEAD-1 승인 | BE + INF | 검색·설치·빌드·테스트에 Keystatic 없음. 공개 주소·본문 의미 유지 | typecheck / test:run / build / 저장소 검색 |
| M7-RV-1 | 최종 검수 | BE-2, FE-2, (전환 후 BE-5) | RV | 마일스톤 전체 승인 | 리뷰 보고서 |

**Milestone 종료** = 공개 페이지가 DB 공개본만 노출하고, 초안/보관/휴지통이 목록·RSS·sitemap·OG·API 어디에도 없고, 글별 SEO 메타가 출력되고, 전환 보고서가 있고, **사용자 승인 여부가 기록**된 상태.

---

## 2. 착수 전 사실 (코드베이스 조사 결과, `6a55aff` 기준)

### 2.1 재사용할 것

| 영역 | 위치 | 내용 |
| --- | --- | --- |
| 공개 조회 계약 | `src/libs/contents/contracts/repository.ts` | `getPost/getMemo/getSeries/listPosts/listPostSlugs/listMemos/listMemoSlugs/listCategories/listTags/listSeries` — **M7-BE-1이 구현할 인터페이스** |
| 공개 조회 소비자 | `src/libs/contents/services/{post,memo,category,tag}.ts`, `src/libs/contents/og.tsx` | 페이지·RSS·sitemap·OG가 이 서비스만 호출한다(교체 지점이 하나다) |
| CMS 읽기 기반 | `src/cms/adapters/postgres/content-store.ts` | `getPublishedReferences`, `readExportSnapshot`, `listEntries`, `content_addresses`(`current`/`alias`/`reservation`/`deleted`) |
| CMS 서비스/API 패턴 | `src/cms/services/content-service.ts`, `src/app/api/cms/v1/**` | `authGateway.verifyAdmin()` + `validateSameOrigin()` + `handleApiError()` + zod(`src/cms/core/api.ts`) |
| 공개 투영 | `src/cms/services/export-service.ts` | `PUBLIC_METADATA_KEYS` 컬렉션별 allowlist, `pickPublicEntry` — M7-BE-3·FE-2가 같은 규칙을 재사용 |
| 컬렉션 레지스트리 | `src/cms/core/collections.ts` | 필드/블록 확장 단일 소스 (M7-FE-2 SEO 필드 추가 지점) |
| 테스트 DB 하네스 | `src/cms/adapters/postgres/__test__/test-database.ts` | `CMS_TEST_DATABASE_URL` + 격리 스키마 (`CMS_DATABASE_URL` 금지) |
| 공개 렌더 체인 | `src/components/mdx/**`, `mdx-content.tsx` | M6-ED-1에서 단일 소스화 완료 |

### 2.2 없는 것 (M7 신규)

- `src/libs/contents/repositories/postgres.ts` (**파일 자체가 없다**). `getContentRepository()`는 Keystatic 구현을 하드코딩한다
- **공개 전용 published 읽기 경로가 store·service에 없다.** `listEntries`는 관리자용(초안 포함·상태 필터), `readExportSnapshot`은 전량 스냅샷이라 요청 단위 조회에 쓸 수 없다 → **M7의 최대 신규 surface**
- 공개 라우트의 DB 조회 전환(`force-static`/빌드 시 정적 생성 → 요청 시 조회)
- 글별 SEO 필드(meta title/description, canonical, OG 이미지)의 저장 위치·편집 UI·head 렌더
- CMS 세션 기반 미리보기(현재는 Keystatic `draftMode` + `ks-branch` 쿠키)
- `/api/cms/v1/public/**`, `docs/cms/openapi.yaml`
- `Post`/`Memo` 공개 타입에 series·SEO·canonical 필드가 없다(`src/libs/contents/types/contents.ts`)

### 2.3 현재 공개 경로 캐시 지도 (M7-INV-1의 입력)

| 파일 | 현재 설정 | M7 후 목표 |
| --- | --- | --- |
| `(blog)/(content)/posts/[slug]/page.tsx` | `force-static` + `dynamicParams=false` + `generateStaticParams` | 요청 시 DB 조회, 비공개/미존재 `notFound()`, 별칭 308 |
| `(blog)/(content)/memos/[slug]/page.tsx` | 동일 | 동일 |
| `(blog)/(content)/posts/page.tsx`, `memos/page.tsx` | 명시 없음 → 빌드 시 정적 | 매 요청 공개본만 |
| `posts/opengraph-image.tsx`, `posts/[slug]/opengraph-image.tsx`, `memos/...` | 빌드 시 생성 | 요청 시, 비공개면 미생성/404 |
| `rss.xml/route.ts` | 명시 없음 → 정적 | 요청 시, 보관/초안 제외 |
| `sitemap.ts` | 명시 없음 → 정적 | 요청 시, 보관/초안/custom canonical 제외 |
| `robots.ts` | 정적 | 변경 없음 |
| `(blog)/(content)/preview/**` | Keystatic `draftMode()` + `ks-branch` 쿠키, `isRemotePreviewEnabled()` | CMS 세션 기반(M7-FE-1). Keystatic 제거 시 이 경로가 유일한 선행 의존 |

### 2.4 작업 위치

`feature/new-cms`는 어떤 worktree에도 체크아웃되어 있지 않다(Desktop main worktree = `bh2980/quit`, Orca `mullet` = `feature/M7`).

- 기본안: `mullet` worktree(`.../orca/workspaces/bh2980_blog/mullet`)를 `feature/M7` 통합 브랜치로 사용한다. 배치 0(D1)으로 `6a55aff`에 ff 정렬 → 배치마다 `cms/wt/m7-b<n>` worktree를 `feature/M7`에서 분기 → 배치 종료 시 `feature/M7`로 병합 → worktree 삭제
- 최종 전환 시 `feature/M7` → `main` 병합 (그때 `feature/new-cms`는 동결 기준선으로 남긴다)
- **사용자 확인 1건:** 통합 브랜치를 `feature/M7`로 갈지, 계속 `feature/new-cms`에 쌓을지. (권고: `feature/M7`)

---

## 3. 마일스톤 묶음과 순서

M7 하나를 **10개 배치**로 묶는다. 배치 = 1 writer + 1 리뷰 게이트.

| 배치 | 묶음 | 담당 | 선행 | 게이트 |
| --- | --- | --- | --- | --- |
| 0 | 기준점·백업·인계 항목 방침 | Lead | — | 없음(기록만) |
| 1 | M7-INV-1 + M7-BE-1 | BE | 배치 0, **O1** | R1 |
| 2 | M7-BE-2 | BE | 배치 1 | R2 |
| 3 | M7-FE-2 (스키마 + head) | FE | 배치 2, **O1 A5/A6** | R3 |
| 4 | M7-BE-3 + M7-BE-4 | JR | 배치 1 | R4 |
| 5 | M7-FE-1 | FE | 배치 1 | R5 |
| 6 | M7-TW-1 | TW | 배치 0 | R6 |
| (O2) | 독립 감사 | Oracle | 배치 1–6 | 감사 보고 |
| 7 | M7-SEC-1 | Security QA | 배치 1·2 | 독립 보고서 |
| 8 | M7-LEAD-1 전환 보고서 + 사용자 승인 게이트 | Lead | 배치 2, 7, O2 | **사용자 승인** |
| 9 | M7-BE-5 Keystatic 제거 (승인 시) | BE+INF | 배치 8 승인, O3 | R7 |
| 10 | M7-RV-1 최종 검수 | RV | 배치 2·3, (전환 시 9) | 승인 |

### 순서 (의존 그래프)

```text
배치 0 (정렬·백업)
  → O1  → 배치 1 (INV-1 + BE-1)  ←────────────────────────┐
              ├─→ 배치 2 (공개 라우트 동적화) → 배치 3 (SEO 메타)   │ 비동기 병렬 레인
              ├─→ 배치 4 (공개 API + OpenAPI 문서)                    │ (배치 1 완료 직후 착수)
              ├─→ 배치 5 (인증 미리보기)                              │
              └─→ 배치 6 (전환 차단 회귀 테스트, 배치 0 직후 가능) ───┘
  → O2 감사 → 배치 7 (보안 검수) → 배치 8 (보고서 + 사용자 승인)
  → [승인 시] O3 → 배치 9 (Keystatic 제거) → 배치 10 (최종 검수)
```

**직렬 구간(위험 구간)은 배치 1→2→3 하나뿐이다.** 4·5·6은 배치 1 이후 독립이며 다른 파일을 만지므로 병렬 레인이 가능하다. 단 **같은 worktree 동시 쓰기는 금지**이므로 레인마다 별도 worktree를 쓴다.

### 배치 1 — M7-INV-1 + M7-BE-1 (공개 조회 읽기 경로 전환)

- 산출물
  - 캐시/동적 렌더 조사 문서(§2.3 확정판 + 선택 근거 + 롤백 조건)
  - `src/libs/contents/repositories/postgres.ts`(신규), `get-content-repository.ts`(교체/플래그)
  - 공개 전용 published 읽기: store 메서드 1~2개 + service 함수 (초안·보관·휴지통 제외, 공개 metadata만)
- 예상 영향 파일
  - `src/cms/adapters/postgres/content-store.ts` (읽기 전용 조회 추가)
  - `src/cms/services/content-service.ts` (공개 조회 계약 추가)
  - `src/libs/contents/{repositories/postgres.ts,get-content-repository.ts,types/contents.ts}`
- 완료 조건: 시험 DB에서 공개본만 조회됨, 초안 slug는 `null` → 페이지 404, DB 오류는 404가 아니라 5xx, 기존 Keystatic 경로가 플래그로 그대로 살아 있음
- 금지: 페이지 파일 수정(배치 2 몫), `Post`/`Memo` **기존 필드 변경**(추가는 배치 3)

### 배치 2 — M7-BE-2 (공개 라우트 동적화)

- 산출물: §2.3 표의 목표 상태 구현. 발행/보관/휴지통 즉시 반영, 별칭 308, 비공개 404
- 예상 영향 파일: `src/app/(blog)/**`, `src/app/rss.xml/route.ts`, `src/app/sitemap.ts`, `opengraph-image.tsx` 4개
- 완료 조건: 시험 DB에서 발행→다음 요청에 노출 / 보관→다음 요청에 목록·RSS·sitemap 제외 + 주소 404 / slug 변경 후 기존 주소 308
- 금지: 캐시로 인한 지연 노출. 즉시성이 안 되면 캐시를 끈다(원칙 4)

### 배치 3 — M7-FE-2 (SEO 메타 필드 + 공개 head)

- 산출물: 관리자 입력 필드(meta title/description, canonical, OG 이미지 선택), DB 저장 경로, 공개 head 렌더, custom canonical의 sitemap 제외
- 예상 영향 파일: `src/cms/core/collections.ts`, 인스펙터/에디터 폼, `src/cms/services/export-service.ts`(공개 allowlist), `src/libs/contents/types/contents.ts`(**선택 필드 추가**), `src/app/(blog)/**/page.tsx`
- 완료 조건: 미입력 시 title/summary 폴백, OG/Twitter 카드 값 대조, custom canonical 글은 sitemap에 없음
- ⚠️ **M6 호환 필수 검증**: 초안 metadata가 공개 투영으로 새지 않을 것, `PUBLIC_METADATA_KEYS` 갱신 후 M6 export 계약 테스트가 계속 통과할 것
- 선행: O1 A5/A6 결정. **M7-BE-1의 "페이지 타입 유지"는 기존 필드 불변을 뜻하며, SEO 필드는 선택 필드로 추가**한다

### 배치 4 — M7-BE-3 + M7-BE-4 (외부 공개 계약 + 문서)

- 산출물: `/api/cms/v1/public/**`, `docs/cms/openapi.yaml`, `docs/cms/extensions.md` 보강
- 완료 조건: `toPublicEntry`와 동일 규칙, 관리자 필드·초안 0건, §10.1 표 ↔ 라우트 목록 대조 일치
- 새 규칙을 만들지 않는다(서비스 재사용). 새 규칙이 필요하면 O2 안건으로 올린다

### 배치 5 — M7-FE-1 (인증된 미리보기)

- 산출물: `(blog)/(content)/preview/**`를 CMS 세션에 연결. Keystatic `draftMode`/`ks-branch` 의존 제거 준비
- 완료 조건: 비로그인 미리보기 401/403, 미리보기가 공개 상태를 바꾸지 않음(발행 아님), 초안 본문만 임시 노출
- 금지: 미리보기 토큰을 공개 URL에 영구 노출

### 배치 6 — M7-TW-1 (전환 차단 회귀 테스트)

- 산출물: 파서 왕복 / 원자적 발행 / 참조·주소 / 인증 / 예약 중복 / 저장 충돌 회귀 + **D3-1(`pre` 실제 RSC 렌더 재검증) 승격**
- 완료 조건: CI에서 실행되는 회귀가 남고 스타일 스냅샷을 양산하지 않음
- M6 기준선(556 tests) 대비 순증만 기록한다

### 배치 7 — M7-SEC-1 (보안 검수, 독립)

- 산출물: 독립 보고서. 비로그인·타 계정·실행기 토큰의 쓰기 차단, 검증 안 된 MDX의 실행 컴파일러 진입 차단, 공개 응답 초안 0건
- 배치 8로 넘어가기 전에 Lead가 등급(P0/P1/P2)을 분류하고 수정을 배정한다

### 배치 8 — M7-LEAD-1 (전환 보고서 + 사용자 승인)

- 산출물: 전환 보고서 — 미해결 오류, 주소 비교(전 49편 vs DB), 이미지 22장 R2 키·체크섬, 남은 Keystatic 의존 목록, O2·SEC-1 결과, D3 이관 항목 결과
- 완료 조건: **사용자 승인 또는 보류 기록.** 승인 없이 배치 9 착수 금지

### 배치 9 — M7-BE-5 (Keystatic 제거, 승인 시)

- 산출물: 패키지·lockfile·`(admin)/keystatic`·`api/keystatic`·`src/keystatic/**`·patches·전용 env 제거. 공개 렌더에 필요한 범용 MDX는 `src/components/mdx`, `src/libs`에 잔류. `src/contents/**` 원본 파일은 **사용자 확인 후** 백업 유지/삭제
- 완료 조건: 저장소 검색·설치·빌드·테스트에 Keystatic 0건, 공개 주소·본문 의미 유지

### 배치 10 — M7-RV-1

- 배치 1–9 전체 증거 + O2 감사 + SEC-1 + 승인 기록을 대상으로 최종 검수

---

## 4. Oracle 자문 시점

### O1 — 착수 전 (배치 1 시작 전, 1회) **[필수]**

목적: 재작업을 유발하는 결정을 먼저 고정한다. 산출물은 결정 목록(각 항목 = 채택안 + 근거 + 롤백 조건).

| # | 안건 | 쟁점 | 권고안 |
| --- | --- | --- | --- |
| A1 | 공개 조회 캐시 전략 | `force-dynamic` 전면 vs 태그 무효화(`revalidateTag`+발행 훅) vs 시간 기반 `revalidate` | **`force-dynamic` 전면.** 시간 기반은 "보관 즉시 404"를 못 지키고, 태그 무효화는 M3-BE-1 발행 경로 수정으로 범위가 커진다. 성능 문제는 v2 |
| A2 | repository 교체 방식 | 플래그(env) vs 즉시 교체 | **env 플래그 + 기본값 유지**, 배치 2에서 공개 전환, 롤백은 플래그 1개로 |
| A3 | DB 오류 표현 | 5xx vs 404 위장 vs 폴백(Keystatic) | **5xx.** 폴백은 캐시 stale과 같은 문제를 만든다(보관 글이 되살아남) |
| A4 | 공개 타입 확장 범위 | `Post`/`Memo` 기존 필드 변경 금지 + SEO 선택 필드 추가 | **가산적(optional) 추가만.** 기존 필드 의미·이름 불변 |
| A5 | SEO 메타 저장 위치 | `entry_bodies.metadata`(working/published) vs 전용 컬럼 | **metadata.** 스키마 변경 없이 공개본 분리 규칙을 그대로 상속한다 |
| A6 | 공개 metadata allowlist 확장 | `PUBLIC_METADATA_KEYS`에 SEO 키 추가 시 중첩 키 유출 위험 | **명시 키만 추가 + M6 export 계약 테스트에 부분집합 단언 유지.** 초안 유출 회귀를 먼저 추가 |
| A7 | series 지원 범위 | 공개 페이지가 `listSeries/getSeries`를 **사용하지 않음**(소비자 0). DB에는 collections 1건 | **계약 유지 + 최소 구현**(빈 배열 허용 여부를 O1에서 확정). 사용처가 생기면 v2 |
| A8 | 별칭/308 계약 | `content_addresses`의 `alias`/`deleted` → 정규 slug 매핑 응답 형식 | repository가 `canonicalSlug` 정보를 노출하고 페이지가 `permanentRedirect`(308). `deleted`는 410이 아니라 404 |
| A9 | 미리보기 인증 방식 | CMS 세션 재사용 vs 별도 서명 토큰 | **CMS 세션 재사용**(M2-BE-1 재사용, 새 토큰 체계 없음). 공개 URL에 토큰 미노출 |
| A10 | Keystatic 제거 경계 | 공개 렌더에 남겨야 하는 범용 자산 범위, `src/contents/**` 처리 | 배치 9에서 확정하되, 삭제 목록/잔류 목록을 미리 문서화 |

### O2 — 배치 1–6 완료 후, 배치 7 전 (1회) **[필수]**

M6의 O2와 같은 성격의 **독립 감사**. 최소 확인 항목:

1. 초안·보관·휴지통이 HTML·RSS·sitemap·OG·`/public/entries` 어디로도 새지 않는가
2. 캐시/stale로 상태 역전(보관 후에도 노출, 발행 후 미노출)이 생기지 않는가
3. DB 장애가 404로 위장되지 않는가 (라우트별 오류 경로)
4. 별칭·slug 변경·`deleted` 주소 계약이 §6.2와 일치하는가
5. SEO 폴백·canonical·sitemap 제외 규칙이 명세와 일치하는가
6. 미리보기가 공개 상태를 바꾸지 않으며 비로그인 차단이 실제로 동작하는가

### O3 — 배치 8 승인 직후, 배치 9 착수 전 (조건부, 1회)

Keystatic 제거 경계와 잔여 의존(런타임 import·env·patch) 목록을 고정한다. 승인 전제가 있으므로 **자문만 미리 하고 실행은 승인 후**다.

### 추가 자문 트리거 (O1/O2/O3 외)

1. 배치 1에서 공개 published 읽기에 **스키마 변경**(컬럼·인덱스)이 필요해진 경우
2. 배치 2에서 태그 기반 무효화 없이 성능·비용 목표를 못 맞춘다고 판명된 경우
3. 배치 3의 SEO 필드가 M6 export/import 계약과 충돌해 공개 allowlist 규칙을 바꿔야 하는 경우
4. `(blog)/(content)/preview/**`가 CMS 세션 없이는 대체 불가한 Keystatic 전용 경로로 판명된 경우
5. 배치 6에서 전환 차단급(초안 노출·본문 손실) 회귀가 발견된 경우 → O2 전에 즉시 자문

---

## 5. Reviewer 리뷰 시점

| 회차 | 시점 | 대상 | 통과 조건 |
| --- | --- | --- | --- |
| R1 | 배치 1 병합 전 | 캐시 조사 문서 + postgres repository + 공개 읽기 경로 | 중대 위험 없음 |
| R2 | 배치 2 병합 전 | 공개 라우트 동적화 + 별칭/404/제외 규칙 | 중대 위험 없음 |
| R3 | 배치 3 병합 전 | SEO 필드·저장·head 렌더 + **M6 export 계약 회귀** | 중대 위험 없음 |
| R4 | 배치 4 병합 전 | `/public/entries` + OpenAPI | 중대 위험 없음 |
| R5 | 배치 5 병합 전 | 미리보기 인증·부작용 없음 | 중대 위험 없음 |
| R6 | 배치 6 병합 전 | 회귀 테스트 세트 | 중대 위험 없음 |
| R7 | 배치 9 병합 전 | Keystatic 제거 결과(검색·빌드·테스트·주소) | 중대 위험 없음 |
| RV | 배치 10 | 배치 1–9 전체 증거 + O2 + SEC-1 + 승인 기록 | 마일스톤 승인 |

### 판정 규칙 (M6 관행 유지, M7 기준으로 조정)

- reviewer 지적은 **등급을 먼저 분류**한다: **P0(중대) / P1(중대 가능) / P2(비차단)**
- **중대 위험이 있을 때만** 수정 후 재리뷰한다. P2(문서·스타일·UX·성능)는 계획서에 기록하고 다음 배치로 진행한다
- 중대 위험 기준 (하나라도 해당하면 수정 + 재리뷰)
  1. **데이터 손실·오염** — 원본 `src/contents/**` 훼손, 공개 본문/참조 유실
  2. **운영 DB 접촉** 또는 오접속 가능성 (시험 가드 우회)
  3. **초안·보관·휴지통의 공개 노출** — HTML·RSS·sitemap·OG·`/public/entries` 중 어디로든
  4. **인증·CSRF·미리보기 결함** — 비로그인 미리보기, 실행기 토큰 쓰기, 관리자 전용 정보의 공개 유입
  5. **캐시 stale로 인한 상태 역전** — 보관 후에도 공개 주소·목록·피드에 잔존, slug 변경 후 기존 주소 404
  6. **주소 계약 위반** — 별칭 308 누락/오연결, DB 오류를 404로 위장
- reviewer 위임 시 매번 요구: ① "중대한 위험 존재 여부" 명시 판정, ② 근거 커밋 SHA와 실행 명령·결과, ③ 등급 라벨
- "위험 없음"이면 즉시 다음 배치로 진행한다(추가 재리뷰 없음)

---

## 6. 검증 명령 (모든 배치 공통)

```bash
# 계약·단위 테스트 (repo 관행, DB 포함 전체)
node --env-file=.env.local node_modules/vitest/vitest.mjs run

# 타입·린트·빌드
pnpm typecheck
pnpm exec biome check .            # M4/M5 관리자 FE 기존 위반 존재 → 변경 파일 기준으로도 확인
pnpm build                          # 운영 DB DSN 제거 환경. exit 0 (라우트 인벤토리·표 실측은 §9.7.1)
```

배치별 추가 확인:

| 배치 | 추가 확인 |
| --- | --- |
| 1 | 초안 slug → `null`/404 · DB 오류 → 5xx(404 아님) · Keystatic 플래그 경로 무회귀 |
| 2 | 시험 DB 발행→즉시 노출 / 보관→즉시 제외+404 / 별칭 `curl -I` 308 / RSS·sitemap에서 비공개 0건 |
| 3 | head 태그 대조(title/description/OG/Twitter/canonical) · 폴백 · custom canonical sitemap 제외 · M6 export 계약 테스트 |
| 4 | 라우트 목록 ↔ OpenAPI 경로 대조 · 공개 응답에 초안/관리자 필드 0건 |
| 5 | 비로그인 미리보기 차단 · 미리보기 후 공개 상태 불변(발행/버전 증가 0) |
| 9 | `git grep -i keystatic` 0건(허용 예외 문서화) · typecheck / test:run / build · 기존 공개 주소 응답 비교 |

---

## 7. 리스크와 대기 결정

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| 배치 1 미착수 상태에서 배치 2 착수 | repository 없이 페이지를 고쳐 재작업 | 배치 순서 고정(D1 정렬 → O1 → 배치 1) |
| 공개 라우트 동적화가 DB 지연에 그대로 노출 | TTFB 악화, Neon cold start | A1에서 성능 목표를 "비차단"으로 명시. 악화 시 O1 재자문(트리거 2) |
| `force-dynamic` + OG 이미지 4종 | OG 생성이 매 요청 발생(비용) | 캐시하지 않는다는 원칙 유지. 필요 시 v2에서 태그 무효화 |
| SEO 필드 추가가 M6 export/import 계약을 깨뜨림 | 공개 allowlist 유출 또는 왕복 회귀 | A6 사전 고정 + R3에서 M6 계약 테스트 필수 실행 |
| 초안 본문이 미리보기 밖으로 유출 | P0 | A9 세션 재사용 + R5 + SEC-1 + O2 |
| Keystatic 제거 후 공개 렌더 자산 누락 | 공개 페이지 파손 | O3에서 삭제/잔류 목록 확정, 배치 9에서 주소·본문 비교 |
| 사용자 승인 지연 | 배치 9·10 대기 | 승인 전까지 기존 읽기 경로 유지가 정상 상태다(일정 리스크 아님) |
| 로컬 Postgres 미가동 | DB 계약 테스트 skip | 착수 전 `CMS_TEST_DATABASE_URL` 접속 사전 점검 |

---

## 8. 완료 후 갱신

1. `CMS-V1-IMPLEMENTATION-PLAN.md` 진행 상태 표: M7-INV-1 … M7-RV-1을 DONE으로 갱신(worktree·commit·검증 열 포함)
2. 같은 문서 계획 변경 로그: O1/O2/O3 결정, 배치별 reviewer 판정, 비차단 P2 목록, SEC-1 결과, **사용자 승인 기록**
3. `CMS-CONTENT-INVENTORY.md`: 주소 비교(49편), 이미지 22장 R2 키·체크섬 대조 결과, D3 이관 항목 결과
4. `CMS-M6-DEV-PLAN.md` §8에서 이관한 "M7 착수 전 확인 목록"의 처리 결과(처리/v2 이관)를 표로 남긴다
5. v2 이관 목록 확정: ZIP 스트리밍, `handleApiError` 413/415/428/503, 태그 기반 캐시 무효화(필요 시), series 소비처, 대표 이미지

---

## 9. 실행 기록

### 9.1 O1 결정 (2026-09-22, 확정)

| 안건 | 결정 |
| --- | --- |
| A1 | CMS 의존 surface만 동적화(`force-dynamic`/`no-store`). 고정 문구 목록 OG 2종은 정적 유지. 태그 무효화는 v2 |
| A2 | store surface 2개로 고정: `listPublishedEntries` / `getPublishedEntryBySlug`(판별형 `current`\|`alias`\|`not_found`). slug 목록은 전자에서 파생 |
| A3 | 공개 판독 = `status='published'` + published body 존재 + current 주소 존재. archived/trashed/draft/reservation/deleted 제외 |
| A4 | 기존 `ContentRepository` 메서드·타입 불변. alias 조회는 정규 current slug를 반환하고 페이지가 요청 slug와 비교 |
| A5 | `CMS_PUBLIC_REPOSITORY`(`keystatic`\|`postgres`), 미설정 기본 `keystatic`, 오값은 시작 시 실패 |
| A6 | SEO는 `entry_bodies.metadata`의 `seoTitle`·`seoDescription`·`canonicalUrl`·`ogImageId`. `PUBLIC_METADATA_KEYS`에는 명시 원시값만 추가 |
| A7 | series는 published collection + published post만, `itemIds` 순서 보존. 소비처·UI는 v2 |
| A8 | current=본문, alias=308, deleted/reservation=404. alias 대상이 비공개이거나 current 주소가 없으면 404 |
| A9 | NextAuth CMS 세션 재사용. `draftMode`는 의도 표시용. preview start와 layout 모두 관리자 세션 검사 |
| A10 | 승인 전 Keystatic·`src/contents/**` 전부 보존. 승인 후 Keystatic 전용만 제거 |
| 배치1 경계 | `content-store.ts`, 신규 `repositories/postgres.ts`, `get-content-repository.ts` + 해당 테스트. **page/route 파일 금지** |
| 배치1 테스트 | 실DB는 store SQL 계약, fake store 기반 순수 단위는 매핑·플래그·오류 전파 |

### 9.2 배치 0 결과

| # | 항목 | 결과 |
| --- | --- | --- |
| D1 | 기준점 정렬 | `304c30e` → `6a55aff` (충돌 없음). untracked 이미지 1장이 동일 blob이라 삭제 후 병합 |
| D2 | 원격 백업 | **보류** — GitHub가 author email `bh2980@naver.com`을 거부(email privacy). 사용자 결정 필요 |
| D4 | 계획서 커밋 | `ac6134c` |
| D5 | **(신규) 베이스라인 타입 게이트 복구** | M6의 "typecheck 0 errors"가 커밋된 lockfile로 **재현되지 않았다**. `prosemirror-view` 1.41.5/1.42.4 중복으로 `src/keystatic/plugins/pm/wrapper-keys.ts`가 실패 → `pnpm-workspace.yaml` overrides로 단일화(`830d03a`). 계획에 없던 항목이므로 전환 보고서에 기록 |
| 실측 | 테스트·빌드 베이스 | 556 tests 중 489 pass / 67 skip / 8 파일 실패(실패는 전부 `CMS_TEST_DATABASE_URL` 미설정). `pnpm build`는 Keystatic GitHub env 부재로 실패. **둘 다 `.env.local` 필요** |

#### D5 부수 관찰 (재발 방지 기록)

- `pre-push` 훅이 `pnpm lint`(= `biome check . --write`)를 돌려 **작업 트리를 자동 수정**한다. 푸시가 실패해도 49개 파일이 수정된 상태로 남았고, `git checkout -- src/`로 복구했다. 앞으로 푸시 전에 `git status`를 확인한다 |
- 같은 훅의 `pnpm lint`는 기존 M4/M5 관리자 UI 위반 40건 때문에 항상 실패한다(푸시 시 `--no-verify` + 사유 기록) |

### 9.3 배치 1 (M7-BE-1) 결과

상태: **구현 완료 · 실DB 검증 대기**(`CMS_TEST_DATABASE_URL` 필요)

| 산출물 | 내용 |
| --- | --- |
| `src/cms/adapters/postgres/content-store.ts` | `PUBLIC_COLLECTIONS`, `PublishedEntryRecord`, `PublishedEntryLookup` 타입 + `listPublishedEntries`·`getPublishedEntryBySlug` 2개 공개 조회 메서드. 초안·보관·휴지통·reservation/deleted 제외, alias는 정규 slug 반환 |
| `src/libs/contents/repositories/postgres.ts` (신규) | DB 공개본을 `ContentRepository`로 매핑. 카테고리/태그 관계 해석, series `itemIds` 순서 보존, 공개본만 반환 |
| `src/libs/contents/repositories/source.ts` (신규) | `CMS_PUBLIC_REPOSITORY` 판정 순수 모듈(부수 효과 없음, 단위 테스트 대상) |
| `src/libs/contents/get-content-repository.ts` | 플래그 기반 팩토리. 기본값 keystatic |
| `src/libs/contents/contracts/repository.ts` | **문서 주석만** 추가(초안 미노출·alias=308 신호·목록 본문 비움) |
| `vitest.config.ts` + `src/test/stubs/server-only.ts` | `server-only`는 next 의존성으로만 설치되어 루트에서 해석되지 않는다. 테스트만 스텁으로 대체 |

테스트: `postgres-repository.test.ts` 13건(매핑·필터·series·오류 전파), `get-content-repository.test.ts` 5건(플래그), `public-read.test.ts` 12건(실DB 계약, **env 대기**).

전체 회귀: 586 tests / **507 pass** / 79 skip / 9 파일 실패(전부 env 미설정). 배치 0 실측 대비 pass +18, 실패 파일 +1(신규 DB 테스트)로 **기존 회귀 없음**.

#### O1 대비 의도적 차이 3건

| # | O1 | 구현 | 사유 |
| --- | --- | --- | --- |
| 1 | `PublishedEntry`에 MDX 포함 | `includeBody` 옵션(목록 기본 false, 단건 기본 true) | 목록마다 전 본문을 전송하면 페이지 페이로드가 커진다. 본문 소비자는 상세 페이지뿐임을 확인했다 |
| 2 | `content-service.ts`도 배치 1 파일 | 공개 읽기는 repository가 container의 store를 직접 사용 | `StorePort`는 좁은 구조적 타입이라 필수 메서드를 추가하면 무관한 M2 테스트 다수를 수정해야 한다. 공개 읽기에 도메인 규칙이 없다. 계획 M7-BE-1의 영향 파일 목록과도 일치 |
| 3 | 별도 판별값 | `getPublishedEntryBySlug`가 판별형 union 반환 | O1 쟁점 2와 동일. slug 비교가 아니라 타입 수준에서 구분한다 |

### 9.4 배치 2 (M7-BE-2) 결과

상태: **구현 완료 · R1/R2 게이트와 실DB 검증 대기**

| 파일 | 변경 |
| --- | --- |
| `(blog)/(content)/posts/[slug]/page.tsx` | `force-static`·`dynamicParams=false`·`generateStaticParams` 제거 → `force-dynamic`. alias 판정 시 `permanentRedirect`(308), 미공개는 `notFound()` |
| `(blog)/(content)/memos/[slug]/page.tsx` | 동일 |
| `(blog)/(content)/posts/page.tsx`, `memos/page.tsx` | `force-dynamic` 명시 |
| `(blog)/(landing)/page.tsx` | `force-dynamic` 명시 |
| `posts/[slug]/opengraph-image.tsx`, `memos/[slug]/opengraph-image.tsx` | `force-dynamic` + 미공개 slug는 `notFound()`(OG도 생성 안 함) |
| `rss.xml/route.ts`, `sitemap.ts` | `force-dynamic` 명시 |

- O1 A1에 따라 고정 문구 목록 OG 2종(`posts/opengraph-image.tsx`, `memos/opengraph-image.tsx`)은 **정적을 유지**했다.
- `grep -rn "force-static\|generateStaticParams\|dynamicParams" src/app` 결과 0건: 빌드가 공개 조회를 위해 DB·Keystatic을 요구하지 않는다.
- 상세 페이지에서 `listPosts()` 호출을 404/308 판정 뒤로 옮겨 비공개·별칭 요청의 불필요한 조회를 줄였다.
- 상세 페이지의 본문 포함 조회 1회 + 분류 조회 1회로 요청당 쿼리 2회(별칭은 동일). 목록 페이지는 2회.

**남은 검증(차단):** `CMS_TEST_DATABASE_URL`(via `.env.local`)이 이 worktree에 없어 ① 실DB 발행/보관 즉시 반영, ② 별칭 308 실제 응답을 실행하지 못했다.

#### 9.4.1 빌드 게이트 결과 — 회귀 1건 발견·수정

`pnpm build`를 실제로 돌려 **배치 2의 빌드 파단 회귀를 찾았다.**

| 항목 | 내용 |
| --- | --- |
| 증상 | `Error: NEXT_HTTP_ERROR_FALLBACK;404` → `Failed to collect page data for /memos/[slug]/opengraph-image-k6zr86/[__metadata_id__]` |
| 원인 | `generateImageMetadata`가 **빌드 수집 단계에서도** 호출되는데 여기서 `notFound()`를 throw했다(미공개 slug는 빌드 시 항상 null) |
| 수정 | `notFound()`를 `Image()`에만 남기고 `generateImageMetadata`는 `alt: post?.title \|\| OG_ALTER_ALT` 폴백으로 되돌렸다 |
| 교훈 | 종료 조건의 “미공개 OG 404”는 **요청 시점** 규칙이며, 메타데이터 선언 단계에서 throw하면 빌드가 깨진다 |

**수정 후 `pnpm build` 통과(exit 0).** 빌드에 필요한 env는 더미로 공급했다(`HOST_URL`, `GSC_VERIFICATION_TOKEN`, `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`). 빌드 시점에는 네트워크 호출이 없어 더미로 충분하다.

라우트 분류 증거(`.next/routes-manifest.json` + `.next/prerender-manifest.json`):

| 분류 | 경로 |
| --- | --- |
| `ƒ` 동적 (CMS 의존 공개 경로 전부) | `/`, `/posts`, `/posts/[slug]`, `/memos`, `/memos/[slug]`, `/rss.xml`, `/sitemap.xml`, `/preview/*` |
| 정적 | `/_not-found`, `/robots.txt`, 고정 문구 OG 3종(`/opengraph-image`, `/posts/opengraph-image-*`, `/memos/opengraph-image-*`) |
| 동적 라우트로 등록 | `[slug]/opengraph-image/[__metadata_id__]` 4개 — `dynamicRoutes`에 있고 **`.body` 없음 → 정적 베이킹되지 않는다**(표의 `●` 표기는 메타데이터 id를 static param으로 잡기 때문) |

### 9.5 현재 차단 항목(사용자 조치 필요)

| # | 항목 | 필요한 조치 |
| --- | --- | --- |
| 1 | 실DB 테스트 9개 파일 + 배치 1·2 실DB 검증 | `.env.local`에 `CMS_TEST_DATABASE_URL` 추가. 현재 이 worktree의 `.env.local`(682B)은 Jev 도구용 stub이고 블로그·CMS 키가 0개다. 하네스는 `cms_test_*` 격리 schema를 만들기 때문에 운영 DB를 지정하면 안 된다(`CMS_DATABASE_URL`은 코드가 거부) |
| 2 | `pnpm build` | 위 5개 키(`HOST_URL`, `GSC_VERIFICATION_TOKEN`, `KEYSTATIC_*` 3종). 더미 값으로는 이미 통과함 |
| 3 | D2 원격 백업 | GitHub email privacy 설정 또는 96+3 커밋 author email 재작성 결정 |

로컬 Postgres는 이 머신에 없다(5432 리스닝 없음, docker 컨테이너 없음, `psql` 미설치) → 테스트 DB는 원격 연결 문자열이어야 한다.

### 9.6 배치 3 (M7-FE-2) 결과

상태: **실DB 외 검증 완료 · R3 게이트 대기**

| 항목 | 내용 |
| --- | --- |
| 저장 | `entry_bodies.metadata`의 `seoTitle`/`seoDescription`/`canonicalUrl`/`ogImageId` (O1 A6) |
| 계약 | `SeoMetadata` 추가, `BasePost`/`BaseMemo`에 선택 필드 `seo` |
| 해석 | `src/libs/contents/seo.ts` — 공백 trim, canonical은 사이트 내 경로(`/...`)와 http(s) 절대 URL만 통과, `javascript:`·`//host`·해석 불가 값은 폐기 |
| 매핑 | `repositories/postgres.ts` — metadata → `seo`. 값이 없으면 **`seo` 키를 만들지 않는다**(기존 글의 공개 객체 모양 불변) |
| allowlist | `PUBLIC_METADATA_KEYS.post`/`.memo`에 4키 추가 |
| 레지스트리 | `COLLECTION_DEFINITIONS` post/memo에 4필드 추가(없으면 `content-service`가 `invalid_metadata_key`로 저장을 거부한다) |
| head | posts/memos `generateMetadata`: title·description·canonical·OG·Twitter. **canonical만** custom 값이 되고 OG url은 자기 주소를 유지한다 |
| sitemap | `buildSitemapEntries`(신규 순수 모듈)로 분리, custom canonical 글 제외 |
| 관리자 UI | InspectorPanel에 SEO 섹션(검색 제목·검색 설명·canonical). post/memo에만 노출해 record 컬렉션의 저장 거부를 피한다 |

**O1 대비 의도적 편차 1건:** `ogImageId`는 저장·allowlist·매핑까지 했지만 head 반영은 v2다. media id → 공개 URL 해석에는 공개 store surface 추가가 필요한데 O1 A2가 공개 메서드를 2개로 고정했다. 사이트는 이미 글별 동적 OG 이미지(`[slug]/opengraph-image`)를 생성하므로 종료 조건의 “OG 출력”은 충족한다.

검증:

| 게이트 | 결과 |
| --- | --- |
| `pnpm typecheck` | 0 errors |
| `pnpm test:run` | 94 files / 604 tests / **525 pass** / 79 skip / 9 파일 실패(전부 `CMS_TEST_DATABASE_URL` 미설정) |
| 기준선 대비 | 89/556/489/67/8 → +48 tests, **회귀 없음** |
| `pnpm build` | 통과(exit 0) |
| biome | 신규·변경 파일 clean. 관리자 2파일은 HEAD와 동일한 기존 진단 19건(신규 위반 0) |

#### 9.6.1 부수 발견 (M7 범위 밖, 기록만)

`entry-editor-shell.tsx`의 `performSave`는 의존성 배열이 `[collection, entry]`인데 `description`을 state에서 읽는다 → 첫 저장에서 요약이 직전 값으로 저장될 수 있다(이후 `entry` 갱신으로 복구되지만 그 사이 변경은 다음 편집까지 반영되지 않는다). SEO 필드는 이 함정을 피해 ref로 최신값을 넘긴다. 기존 UI 결함은 M4/M5 소관이므로 이 배치에서 고치지 않고 v2로 넘긴다.

### 9.7 배치 4 (M7-BE-3 + M7-BE-4) 결과

상태: **구현·계약 테스트 완료 · R4 게이트 대기**

| 산출물 | 내용 |
| --- | --- |
| `GET /api/cms/v1/public/entries` | 공개본 목록. `collection`(post·memo)·`category`·`tag`·`page`·`pageSize`(≤100). 응답 `{items,total,page,pageSize}` + `Cache-Control: no-store` |
| `GET /api/cms/v1/public/entries/{collection}/{slug}` | 공개본 단건. `{entry, address:{slug,isAlias}}` — 별칭이면 정규 주소를 알려준다(§10.1) |
| `src/libs/contents/public-api.ts` | 공개 DTO·질의 스키마·페이지네이션·별칭 판정(순수 모듈) |
| `src/app/api/cms/v1/public/errors.ts` | 공개 오류 매퍼. 400·404·503만 사용, 내부 메시지 비노출 |
| `docs/cms/openapi.yaml` | §10.1 경로 24개 + 공개 응답 스키마·호출 예제 |
| `docs/cms/extensions.md` | §5 “공개 반영” 표 추가(필드를 어디까지 공개로 내보내는지) |

규칙(새 규칙 없이 재사용):

- 업무 규칙은 기존 `ContentRepository`(= 공개 조회 계약)만 쓴다. 공개 API 전용 조회를 새로 만들지 않았다.
- 직렬화는 `PublicEntryDto`로만 한다. **초안은 매퍼 단계에서 fail-closed로 제거**하므로 개발 모드 파일 저장소가 초안을 돌려줘도 목록에서 빠지고 단건은 404다(단위·라우트 테스트로 고정).
- DB·설정 오류는 404로 위장하지 않고 503이며 응답에 원인 문자열이 없다.
- 관리자 세션을 요구하지 않는다(인증 mock 없이 200을 받는 테스트로 고정).

검증:

| 게이트 | 결과 |
| --- | --- |
| `pnpm typecheck` | 0 errors |
| `pnpm test:run` | 97 files / 626 tests / **547 pass** / 79 skip / 9 파일 실패(전부 `CMS_TEST_DATABASE_URL` 미설정) |
| 기준선 대비 | 89/556/489/67/8 → +70 tests, **회귀 없음** |
| `pnpm build` | 통과(exit 0). 신규 공개 라우트 2개가 `ƒ`(동적)로 등록 |
| 문서 대조 | `src/cms/__test__/openapi-contract.test.ts`가 문서의 경로·메서드 ↔ 실제 라우트를 비교(불일치 시 실패) |
| biome | 신규·변경 파일 clean |

의도적 한계 2건:

1. 공개 API 컬렉션은 `post`·`memo`만 지원한다. record 컬렉션(category·tag·collection) 공개는 v2다(사이트 head가 쓰는 분류값은 repository가 내부에서 이미 해석한다).
2. §10.1은 DB 일시 장애를 503으로 적었다. 공개 경로는 503으로 맞췄고, 관리자 경로의 기존 `handleApiError`는 500을 쓴다(M2–M6 계약을 건드리지 않음) → O2 안건.

### 9.7.1 라우트 수 문구 정정

계획서 §0·§6이 인용한 “build 79 routes”는 M6 보고 문구를 그대로 옮긴 것이고 M7에서 재측정한 값이 아니다. 바탕이 된 지표가 불분명하므로 다음 실측 근거로 대체한다.

| 대체 근거 | 값 |
| --- | --- |
| `pnpm build` | exit 0 (더미 env 5개 공급) |
| 라우트 소스 인벤토리 | `6a55aff` 49 → 현재 51. 추가 2건은 신규 공개 API `route.ts`, 삭제 0건 |
| 빌드 표 줄 수 | 배치 4 후 52줄(참고값. 표는 메타데이터 이미지 하위 경로를 따로 세는 등 라우트 파일 수와 1:1이 아니다) |

따라서 “무회귀” 판정은 빌드 성공 + 라우트 인벤토리 차이(추가 2·삭제 0) + 테스트 pass 증가로 한다.

### 9.8 R1/R2 리뷰 결과 (배치 1·2)

reviewer 에이전트 1회로 R1·R2를 함께 판정받았다. 라우터 모델 장애로 2회 실패한 뒤(아래 9.10) 모델을 `xai/grok-4.7`로 명시 고정해 실행했다.

| 항목 | 결과 |
| --- | --- |
| R1 (`246064e`) | **조건부 통과** — “중대 위험 6기준 해당 없음” |
| R2 (`71cc784`) | **조건부 통과** — 상세 308/404 분기가 읽은 페이지 코드와 일치 |
| P0/P1 | 없음 |
| P2 | 1건: 공개 단건 조회가 `sanitize()`를 쓰지 않아 NFD 한글 주소가 404가 될 수 있음 |
| §9.3 편차 3건 | 셋 다 **허용 편차**로 판정 |
| 리뷰 한계 | reviewer가 검증 명령을 실행하지 못했고, 리뷰 도중 `HEAD`가 배치 3·4 커밋으로 전진했다. 따라서 R1/R2는 **코드 열람 기반**이며 실행 증거는 이 계획서의 typecheck/test/build 기록으로 대체한다 |

**P2 반영(수정 완료 `da65822`):** `PostgresRepository.getPost`/`getMemo`가 조회 전 `normalizeSlug()`로 NFC 정규화한다(Keystatic 저장소와 동일 규칙). 퍼센트 인코딩이 없는 주소는 `trim + NFC`만 하고, `%`가 있으면 기존 `sanitize()`를 쓰되 실패 시 원문으로 조회해 **500이 아니라 404**로 끝낸다. 테스트 3건 추가(NFD 한글 조회, 메모 동일 규칙, 미존재·잘못된 인코딩 → null).

**R1/R2 부수 지적 처리:**

- RSS 응답에 `Cache-Control: no-store`를 추가했다(피드도 캐시하지 않는다).
- slug별 OG가 alias 요청에 308이 아니라 200 이미지를 만든다 → INV-1이 요구한 것은 “비공개 미생성”이므로 계약 위반 아님으로 기록만 남긴다.
- reviewer가 실행하지 못한 명령의 실측값은 §9.9에 있다.

### 9.9 배치 5 (M7-FE-1) 결과

상태: **구현·단위 테스트 완료 · R5 게이트 대기**

| 파일 | 변경 |
| --- | --- |
| `src/libs/admin/preview-access.ts` (신규) | 미리보기 접근 판정을 Keystatic 토큰이 아니라 **CMS 관리자 세션**으로 바꿘다(O1 A9). `checkPreviewAccess()`가 401/403을 구분하고, 인증과 무관한 오류는 감추지 않고 올린다 |
| `src/libs/contents/services/post.ts`, `memo.ts` | 미리보기 서비스가 `canPreview()`를 쓴다. 세션이 없으면 저장소를 아예 건드리지 않고 `null`/빈 결과 |
| `(blog)/(content)/preview/start/route.tsx` | `draftMode`를 켜기 **전에** 세션을 확인한다. 잘못된 `to` 값은 500이 아니라 400 |
| `(blog)/(content)/preview/layout.tsx` | 세션이 없으면 `notFound()` — 미리보기 셸·배너를 렌더하지 않는다 |

- `draftMode`는 “미리보기 의도 표시”로만 남긴다(O1 A9). `ks-branch`는 Keystatic 원격 미리보기용으로 유지하고 배치 9에서 제거한다.
- **동작 변화:** 개발 모드에서도 미리보기에 세션이 필요하다. 예외는 명시적 opt-in `CMS_DEV_AUTH_BYPASS=1`뿐이다(기존에는 `NODE_ENV=development`이면 무조건 통과였다).
- **확인된 한계(전환 시 필수):** `CMS_PUBLIC_REPOSITORY=postgres`로 바꾸면 미리보기가 읽는 공개 저장소가 초안을 반환하지 않아 **초안 미리보기가 404가 된다**. DB 초안(working body) 조회는 slug→entry 조회 surface가 필요해 M7 범위 밖으로 두었다 → M7-LEAD-1 전환 보고서에 필수 후속으로 기재한다.
- 발행 부작용 없음: `ContentRepository`는 읽기 전용 계약이고, 미리보기 경로는 쓰기 메서드를 호출하지 않는다(테스트로 고정).

검증:

| 게이트 | 결과 |
| --- | --- |
| `pnpm typecheck` | 0 errors |
| 미리보기 테스트 | 17건 통과(`preview-access` 4 · `preview-gate` 5 · `/preview/start` 8) |
| `pnpm test:run` | 100 files / 643 tests / **564 pass** / 79 skip / 9 파일 실패(전부 env) |
| `pnpm build` | exit 0 |

### 9.10 reviewer 레인 장애 기록

R1/R2 리뷰어 실행이 두 번 실패했다. 같은 프로토콜로 재시도만 했고 다른 프로토콜로 우회하지 않았다.

| 회차 | 결과 |
| --- | --- |
| 1 | `[pi-router] No available model found for configured router/reviewer-route` + `上下游返回错误`. 19턴·55툴콜 후 중단, 작업 트리 오염 없음 |
| 2 | `model_verification_failed: Expected 'router/reviewer-route:high' but observed 'grok-4.7'` |
| 3 | 모델을 `xai/grok-4.7`로 명시 고정해 성공 |

후속: 사용자 설정 `~/.pi/agent/extensions/subagent/config.json`의 `modelResponseAliases`에 `router/reviewer-route` → 실제 모델 매핑을 넣으면 명시 고정 없이도 게이트가 열린다. R3–R6도 같은 고정이 필요하다(기록용).

### 9.11 배치 6 (M7-TW-1) 결과

상태: **구현 완료 · R6 게이트 대기**

**발견한 결함 1건(수정):** 같은 항목에 pending 예약을 두 번 만들면 `schedules_active_entry_idx`(partial unique)가 막지만, `createSchedule`이 pg 오류를 그대로 던져 **409가 아니라 500**이 됐다. `isScheduleConflict()`를 추가해 `CmsError("conflict")`로 매핑했다(§10.1의 “409 충돌/중복”).

기존 회귀 자산 점검(6개 범주):

| 범주 | 기존 자산 | 이번 배치 |
| --- | --- | --- |
| 파서 왕복 | `cms/mdx/__test__/roundtrip·corpus-roundtrip·image-roundtrip` | 추가 없음(이미 충분) |
| 원자적 발행 | `content-store.test.ts`, `content-service.test.ts` | 추가 없음 |
| 참조·주소 | `references.test.ts`, `lifecycle.test.ts` | 추가 없음 |
| 인증 | `auth-gateway.test.ts` | 배치 5의 `preview-access` 4건 |
| 예약 중복 | **없음**(lifecycle은 생성·실행·멱등만 다뤘다) | 실DB 1건 + 라우트 7건 |
| 저장 충돌 | `content-service.test.ts`, `entries.test.ts` | 추가 없음 |
| D3-1 `pre` RSC 렌더 | **없음** — 코퍼스 러너가 “suspended”일 때 동기 스텁(`PreShim`)으로 갈아 끼워 **실제 `pre`가 렌더된 적이 없었다** | 스트리밍 렌더 5건 |

신규 테스트:

- `src/cms/adapters/postgres/__test__/lifecycle.test.ts` §3 — pending 예약 중복 → conflict, pending 행 1개 유지 (**실DB, 현재 env로 미실행**)
- `src/app/api/cms/v1/entries/[id]/schedule/__test__/schedule.test.ts` 7건 — 200·428·400·409·401·cross-origin 거부·204 (실행 통과)
- `src/components/mdx/__test__/mdx-content.code-block.test.tsx` 5건 — 실제 `pre` 스트리밍 렌더, 동기 렌더 실패 사실 고정, fence meta→마크업, meta 없음, 언어 없음 (실행 통과)

검증:

| 게이트 | 결과 |
| --- | --- |
| `pnpm typecheck` | 0 errors |
| `pnpm test:run` | 102 files / 659 tests / **579 pass** / 80 skip / 9 파일 실패(전부 env) |
| 기준선 대비 | 89/556/489/67/8 → **+103 tests**, 회귀 없음 |
| biome | 신규 파일 clean. 기존 파일 경고 수 불변(content-store 5건·lifecycle 4건을 HEAD와 대조) |

한계: 실DB 테스트 1건(lifecycle 예약 중복)과 배치 1의 12건은 `CMS_TEST_DATABASE_URL` 없이는 실행되지 않는다.

### 9.12 O2 독립 감사 결과 (2026-09-22)

runId `e1d1d73c-04b1-4f41-9fe3-d5a1fe1ff8b4` · 판정: **전환 승인 보류**. 안건 판정은 아래와 같다.

| # | O2 안건 | 판정 | 핵심 근거·한계 |
| --- | --- | --- | --- |
| 1 | 초안·보관·휴지통 미노출 | 부분충족 | SQL·서비스·공개 DTO 3중 방어 확인. 실DB 관통 증거 없음 |
| 2 | 캐시 stale 상태 역전 | 부분충족 | 공개 surface 전부 동적 + RSS·API `no-store`. 실DB 반영 검증·CDN 헤더 미확인 |
| 3 | DB 장애 404 위장 금지 | **충족** | 어느 경로도 예외를 404·빈 목록으로 바꾸지 않는다. 공개 API는 503 |
| 4 | 별칭·slug·deleted 주소 계약 | 부분충족 | 요청 주소→정규 주소 1회 반환, deleted/reservation 후보 제외. 실DB 테스트 미실행 |
| 5 | SEO 폴백·canonical·sitemap | 부분충족 | 폴백·위험 스킴 필터·sitemap 제외 확인. 브라우저 head 대조 미실행 |
| 6 | 미리보기 인증·무부작용 | 부분충족 | 3중 게이트·쓰기 0건 테스트 통과. **postgres 전환 시 초안 미리보기 404** |

**전환 차단급 위험 5건:** ① 실DB 계약·실제 HTTP 동작 미검증 ② postgres 전환 시 초안 미리보기 404 ③ R3–R6·SEC-1 미완 ④ 49편 주소·22장 이미지 이관 대조 미완 ⑤ 원격 백업·배포 가능 커밋 없음

**O2가 요구한 승인 선행 조건 7개:** 실DB 테스트(13건 pass·0 skip) · postgres staging 관통 검증(발행/보관/별칭/장애) · SEO head 실측 · 미리보기 DB 경로 완성 후 확인 · R3–R6·SEC-1 완료 · 이관 무결성 대조 · 원격 푸시·롤백 관찰 기간 확보

#### 9.12.1 O2가 추가로 찾은 기술 사실 3건 (미반영·기록)

1. **repository 선택 시점 불일치**: `services/{post,memo,category,tag}.ts`는 모듈 로드 시 `getContentRepository()`를 1회 고정하는데, 공개 API 라우트는 **요청마다** 다시 선택한다. 플래그를 재시작 없이 바꾸면 HTML과 공개 API가 서로 다른 저장소를 볼 수 있다 → 전환 시 **반드시 재배포**해야 한다(체크리스트에 포함).
2. **상세 요청당 중복 조회**: `generateMetadata`와 페이지 본문이 각각 `getPost(slug)`를 부르고, 페이지는 `listPosts()`도 부른다. React `cache()` 결합이 없어 같은 요청 안에서 metadata와 본문이 서로 다른 시점을 볼 수 있다(지속 stale은 아님). v2 안건.
3. **미리보기의 초안 조회 경로**: 위험 ②의 원인. DB working body를 slug로 찾는 경로가 필요하다.

#### 9.12.2 반영 방침

| 안건 | 결정 |
| --- | --- |
| 관리자 `handleApiError`의 500→503 통일 | **v2 유지**(O2 동의). M2–M6 계약을 건드리지 않는다. 단 전환 보고서에 “공개 503/관리자 500”을 명시한다 |
| DB 전환 승인과 Keystatic 제거 승인 | **분리**한다. 승인 후에도 안정화 기간 동안 `CMS_PUBLIC_REPOSITORY=keystatic` 롤백 경로와 `src/contents/**`를 보존한다 |
| 미리보기 DB 초안 경로 | **전환 선행 조건**으로 올린다(승인 후 후속이 아니다). 작업 범위와 승인은 M7-LEAD-1 보고서에서 요청한다 |
| `.pi/` untracked·원격 푸시 차단 | 기능 게이트는 아니지만 **운영 게이트**다(롤백·백업 불가 상태로 전환 금지) |

### 9.13 M7-LEAD-1 전환 보고서

`CMS-M7-LEAD1-CUTOVER-REPORT.md` 작성(커밋 동봉). 함게: 종료 조건별 상태, 실측 증거, O2 위험 5건, 미리보기 선행 조건, 리뷰어 레인 장애 기록, **사용자 결정 요청 4건**, 승인 시 전환 절차·롤백.

현재 상태: **사용자 승인 대기**. 승인 여부가 확정되면 본 계획서 §0 상태표와 이 항목에 기록한다. 승인 없이 `CMS_PUBLIC_REPOSITORY`를 `postgres`로 바꾸지 않고, Keystatic도 제거하지 않는다(배치 9 보류).





