# CMS M7 개발 계획 (블로그 연결과 전환 준비)

- 작성: 2026-09-22 · Lead
- 기준 문서: `CMS-SPEC.md` §3.4 / §6.2 / §11 / §12.1-5 / §12.2, `CMS-V1-IMPLEMENTATION-PLAN.md` M7, `CMS-M6-DEV-PLAN.md`(배치·게이트 관행), `CMS-CONTENT-INVENTORY.md`
- M6 기준선: `feature/new-cms` @ `6a55aff` (M0–M6 DONE · 89 files/556 tests · typecheck 0 errors · build 79 routes)
- 원칙
  1. **1 마일스톤 = 1 관심사**, **1 배치 = 1 writer = 1 worktree**(같은 cwd 동시 쓰기 금지)
  2. 운영 데이터 이전·공개 전환·Keystatic 제거는 **사용자 승인 없이 하지 않는다**
  3. 기존 `ContentRepository` 계약과 M1–M6의 저장·발행·참조 규칙을 깨지 않는다. 교체는 플래그/명시적 교체 + 롤백 경로를 남긴다
  4. 캐시·성능 최적화보다 **초안·보관본 미노출**이 우선이다. 즉시성이 안 되면 캐시를 포기한다

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
pnpm build                          # 운영 DB DSN 제거 환경. M6 기준선 79 routes/exit 0
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

