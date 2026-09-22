# CMS M7 전환 보고서 (M7-LEAD-1)

- 작성일: 2026-09-22
- 대상: `feature/M7` @ `c7778d4` (베이스 `6a55aff` = M0–M6 DONE)
- 판정: **조건부 — 지금 상태로 운영 전환을 승인하지 않는다.** 아래 “승인 요청” 4건에 대한 사용자 결정이 필요하다.
- 근거: `CMS-M7-DEV-PLAN.md`(특히 §9 실행 기록), `CMS-M7-INV1-PUBLIC-CACHE.md`, O2 독립 감사(runId `e1d1d73c`)

---

## 1. 요약

M7의 구현 배치(1–6)는 끝났고 게이트도 실측으로 통과했다. 그러나 **O2 독립 감사는 전환 승인을 보류**했고, 그 사유는 “코드 결함”이 아니라 **실DB·실응답 증거의 공백**과 **미리보기 회귀 1건**이다.

| 구분 | 상태 |
| --- | --- |
| 구현 배치 1–6 | 완료 (커밋 12개) |
| 타입·단위 게이트 | `pnpm typecheck` 0 errors · `pnpm test:run` 659 tests / **579 pass** / 80 skip / 9 파일 실패(전부 env) · `pnpm build` exit 0 |
| 실DB 계약 테스트 | **미실행** — `CMS_TEST_DATABASE_URL` 없음 (13건) |
| 브라우저·실응답 검증 | **미실행** — 발행/보관 즉시 반영, 별칭 308, SEO head |
| R3–R6 리뷰 | **미완** — reviewer 레인 장애(§7) |
| M7-SEC-1 보안 검수 | **미완** (배치 7) |
| 미리보기 DB 초안 경로 | **미구현** — postgres 전환 시 초안 미리보기 404 |

---

## 2. 무엇이 바뀌었나

1. **공개 읽기 경로를 DB 공개본으로 바꿀 수 있게 됐다.** `ContentRepository` 뒤에 Postgres 구현을 추가했고, `CMS_PUBLIC_REPOSITORY=keystatic|postgres` 플래그로 고른다(미설정 기본 `keystatic`, 오값은 즉시 실패). 공개 판독은 `status='published'` + published body 존재 + current 주소 존재를 **모두** 요구한다.
2. **공개 페이지가 요청 시점에 조회한다.** 상세·목록·랜딩·RSS·sitemap·slug OG에서 `force-static`/`generateStaticParams`/`dynamicParams`를 걷어냈다(0건). 발행·보관이 다음 요청에 반영되고, 과거 주소는 308, 비공개는 404다.
3. **글별 SEO 메타를 저장·출력한다.** `seoTitle`/`seoDescription`/`canonicalUrl`(+/`ogImageId` 예약)을 관리자에서 입력하고 head의 title·description·canonical·OG·Twitter로 출력한다. custom canonical 글은 sitemap에서 빠진다.
4. **공개 HTTP API가 생겼다.** `GET /api/cms/v1/public/entries[/{collection}/{slug}]` — 관리자 세션 없이 공개본만, 관리자 필드·초안 0건, 오류는 400/404/503만. `docs/cms/openapi.yaml`이 §10.1의 24경로를 담고, 테스트가 문서↔라우트 일치를 강제한다.
5. **미리보기가 CMS 세션으로 제한됐다.** Keystatic 토큰 대신 관리자 세션을 본다(`/preview/start`·layout·서비스 3중). 개발 모드 무조건 통과는 사라졌고 `CMS_DEV_AUTH_BYPASS=1`만 예외다. 미리보기는 쓰기를 하지 않는다.
6. **전환 차단급 회귀를 보강했다.** 예약 중복이 500이 아니라 409로 매핑되고(`schedules_active_entry_idx` → conflict), `pre` 코드블록이 스텁 없이 **실제 RSC 스트리밍 렌더**로 검증된다(M6에서는 동기 스텁으로 대체돼 실제 컴포넌트가 렌더된 적이 없었다).

---

## 3. 검증 증거 (실측)

| 게이트 | 명령 | 결과 |
| --- | --- | --- |
| 타입 | `pnpm typecheck` | 0 errors |
| 테스트 | `pnpm test:run` | 102 files · 659 tests · **579 pass** · 80 skip · 9 파일 실패 |
| 기준선 대비 | `6a55aff` | 89/556/489/67/8 → **+103 tests**, 회귀 없음 |
| 실패 원인 | — | 9개 파일 전부 `CMS_TEST_DATABASE_URL is not set` (skip 아니라 throw) |
| 빌드 | `pnpm build`(env 5개 더미) | exit 0 · 공개 라우트 전부 `ƒ` 동적 · slug OG는 `dynamicRoutes`(정적 베이킹 없음, `.body` 없음) |
| 린트 | `pnpm exec biome check` | 신규·변경 파일 clean. 기존 위반 수는 HEAD와 동일(신규 0) |
| 문서 대조 | `openapi-contract.test.ts` | 문서 24경로·메서드 ↔ 실제 라우트 일치 |

빌드에 필요한 env는 `HOST_URL`, `GSC_VERIFICATION_TOKEN`, `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`이며, 빌드 시점에는 네트워크 호출이 없어 더미로 충분하다.

---

## 4. 종료 조건 대비

| ID | 완료 조건 | 상태 |
| --- | --- | --- |
| M7-INV-1 | 적용 파일 목록·캐시 설정 문서 확정 | 완료 |
| M7-BE-1 | 플래그로 DB를 읽고 페이지는 repository만 본다. 별칭은 정규 slug, DB 장애 5xx | 구현 완료 · **실DB 12건 미실행** |
| M7-BE-2 | 재배포 없이 발행 반영, 보관·휴지통 제외, 주소 404 | 구현 완료 · **실DB·실응답 미실행** |
| M7-FE-1 | 비로그인 미리보기 불가, 미리보기가 발행하지 않음 | 구현 완료 · 단 **postgres 전환 시 초안 404**(§6) |
| M7-FE-2 | head 메타 출력, 폴백, custom canonical sitemap 제외 | 구현·단위 테스트 완료 · 브라우저 head 대조 미실행 |
| M7-BE-3 | 공개 스키마만, 관리자 필드·초안 0건 | 구현·계약 테스트 완료 |
| M7-BE-4 | §10.1 경로가 문서에 있고 예제 존재 | 완료(대조 테스트 포함) |
| M7-TW-1 | 전환 차단 회귀가 CI에 남는다 | 구현 완료(+103 tests) · 실DB 1건 미실행 |
| M7-SEC-1 | 권한·MDX 실행 경로 독립 검수 | **미완** |
| M7-LEAD-1 | 전환 보고서 + 사용자 승인 기록 | **이 문서** |

---

## 5. O2 독립 감사 요약

안건 6개 중 **3번(DB 장애 404 위장 금지)만 충족**, 나머지는 부분충족이다. 판정이 “보류”인 이유는 위험 5건이다.

| # | 전환 차단급 위험 |
| --- | --- |
| ① | 실DB 계약·실제 HTTP 동작(발행/보관/별칭/장애)이 한 번도 실행되지 않았다 |
| ② | `CMS_PUBLIC_REPOSITORY=postgres`로 바꾸면 **초안 미리보기가 404**가 된다 |
| ③ | R3–R6 리뷰와 M7-SEC-1 보안 검수가 끝나지 않았다 |
| ④ | 이관 무결성 대조(49편 주소, 22장 이미지 체크섬)가 남아 있다 |
| ⑤ | 원격 백업·배포 가능 커밋이 없다(롤백 대상이 없다) |

O2가 요구한 승인 선행 조건 7개: 실DB 13건 pass·0 skip / postgres staging 관통 검증 / SEO head 실측 / 미리보기 DB 경로 완성 / R3–R6·SEC-1 완료 / 이관 무결성 대조 / 원격 푸시·롤백 관찰 기간.

---

## 6. 미리보기 문제 (위험 ②) — 왜 전환 선행인가

미리보기 서비스는 **공개 repository**로 초안을 읽는다. Keystatic 저장소는 설정에 따라 초안을 반환하므로 지금은 동작하지만, `postgres` 저장소는 계약상 초안을 절대 반환하지 않는다. 따라서 플래그를 켜는 순간 “초안 미리보기” 기능이 404로 죽는다. 미리보기가 없으면 편집 흐름이 발행→확인밖에 남지 않으므로, 전환과 동시에 기능 회귀가 발생한다.

**제안 범위(승인 시 즉시 착수 가능, 별도 소배치):**
- 관리자 저장소에 draft 조회 1개 추가(예: slug → working body). 공개 store surface(O1 A2가 2개로 고정)는 건드리지 않는다.
- 미리보기 서비스가 `postgres` 저장소일 때 draft 경로를 쓰도록 분기.
- 테스트: 초안 slug 미리보기 200/공개 404 대조, 발행 전후 상태 불변, 비로그인 401/403.

---

## 7. 진행을 막고 있는 인프라 문제

| 항목 | 상태 | 필요한 것 |
| --- | --- | --- |
| reviewer 레인 | R3–R6 실행 실패. 모델 미고정 시 `上游返回错误`, `xai/grok-4.7` 고정 시 `model_verification_failed` | `~/.pi/agent/extensions/subagent/config.json`의 `modelResponseAliases`에 `router/reviewer-route` → 실제 모델 매핑 추가, **또는** 대체 리뷰어 에이전트 사용을 명시 승인 |
| 실DB 검증 | `CMS_TEST_DATABASE_URL` 부재. 로컬 Postgres도 없음(5432 미리스닝·docker 없음·psql 미설치) | 원격 테스트 DB 연결 문자열 |
| 작업 트리 | `.env.local`에 `JEV_PROVIDER`·`TYPESAFE_API_KEY`만 있고 CMS 키 0개 | 위 항목과 동일 |
| 원격 백업 | 푸시 거부(GitHub email privacy). CMS 커밋 author가 `bh2980@naver.com` | GitHub에 해당 이메일 등록 또는 “명령줄 푸시에 이메일 노출 차단” 해제 |
| pre-push 훅 | `pnpm lint`(= `biome check . --write`)가 기존 M4/M5 위반 40건으로 항상 실패하고 워킹트리를 자동 수정 | 푸시 시 `--no-verify` + 사유 기록 |

---

## 8. 승인 요청 (사용자 결정 필요)

1. **DB 전환 승인**: (a) 승인 (b) 조건부 승인 (§6 미리보기 경로 + 실DB 13건 실행을 조건으로) (c) 보류
2. **미리보기 DB 초안 경로를 지금 구현할지**: 권장 — 지금. 별도 소배치로 진행하며 전환의 유일한 기능 회귀를 제거한다.
3. **검증 환경 제공**: 원격 Postgres 테스트 DB(`CMS_TEST_DATABASE_URL`) 제공 여부. 제공되면 13건 + staging 관통 검증을 즉시 실행한다.
4. **리뷰어 레인 복구 방식**: config 매핑 추가(권장) 또는 대체 리뷰어 명시 승인. R3–R6·SEC-1·RV가 여기에 걸려 있다.

**운영 게이트(승인과 별개로 필수):** 원격 백업 없이는 전환하지 않는다(롤백 대상 부재).

---

## 9. 승인 시 전환 절차 (제안)

1. 선행 조건 7개 충족 확인 — 실DB 13건 pass·0 skip, staging 관통 검증, SEO head 실측, 미리보기 경로 완성, R3–R6·SEC-1 완료.
2. `src/contents/**`와 DB 스냅샷 백업, 원격 브랜치 푸시(롤백 지점 확보).
3. staging에 `CMS_PUBLIC_REPOSITORY=postgres` + `CMS_DATABASE_URL` 설정 후 **재배포**. 재배포 없이 플래그만 바꾸면 HTML과 공개 API가 서로 다른 저장소를 볼 수 있다(모듈 로드 시 고정 vs 요청별 선택).
4. 관찰: 발행→목록·RSS·sitemap·OG 반영, 보관→제외+404, slug 변경→308, 장애 주입→5xx(404 아님).
5. 안정화 기간 동안 Keystatic·`src/contents/**`를 **보존**한다. Keystatic 제거는 별도 승인(O3)이다.

**롤백:** `CMS_PUBLIC_REPOSITORY=keystatic`으로 되돌리고 재배포. DB는 읽기만 했으므로 데이터 손실이 없다. Keystatic을 아직 제거하지 않았기 때문에 이 경로가 유효하다.

---

## 10. 남은 위험 등급

| 등급 | 항목 |
| --- | --- |
| 전환 차단급 | 실DB·실응답 미검증, 미리보기 초안 404, R3–R6·SEC-1 미완, 이관 대조 미완, 원격 백업 부재 |
| 승인 후 후속 | 요청당 중복 조회(React `cache()` 미적용 — metadata와 본문이 다른 시점을 볼 수 있음), 관리자 API 500 vs §10.1의 503, OG alias 요청에 308 미적용 |
| v2 | `ogImageId`의 head 반영, 공개 API의 record 컬렉션(category/tag/collection), 태그 기반 캐시 무효화, 이미지 R2 체크섬 대조 |

---

## 부록 A. 커밋

| 커밋 | 내용 |
| --- | --- |
| `ac6134c` | M7 배치 개발 계획 |
| `830d03a` | 베이스라인 타입 게이트 복구(prosemirror 중복 버전) |
| `4936035` | M7-INV-1 캐시·동적 렌더 조사 |
| `246064e` | 배치 1 — 공개 published 읽기 + Postgres repository |
| `2bdb017` | chore(.pi 추적 해제) |
| `71cc784` | 배치 2 — 공개 라우트 요청 시 조회 전환 |
| `6dc7306` | OG 메타데이터 단계 404 throw 제거(빌드 회귀 수정) |
| `0cf1728` | 배치 3 — SEO 메타 저장·head·sitemap 제외 |
| `1ba504a` | 배치 4 — 공개 API + OpenAPI 계약 문서 |
| `da65822` | slug NFC 정규화 + RSS `no-store`(R1/R2 P2) |
| `5945613` | 배치 5 — 미리보기 세션 제한 |
| `c7778d4` | 배치 6 — 전환 차단 회귀 + `pre` RSC 실제 렌더 |

## 부록 B. 재현 명령

```bash
pnpm typecheck
pnpm test:run
HOST_URL=https://example.com GSC_VERIFICATION_TOKEN=dummy \
  KEYSTATIC_GITHUB_CLIENT_ID=dummy KEYSTATIC_GITHUB_CLIENT_SECRET=dummy KEYSTATIC_SECRET=dummy \
  pnpm build
# 실DB(env 필요)
node --env-file=.env.local node_modules/vitest/vitest.mjs run src/cms/adapters/postgres/__test__/
```

## 부록 C. 남은 Keystatic 의존 인벤토리 (배치 9 범위)

| 구분 | 수량 |
| --- | --- |
| `src/keystatic/**` | 103 파일 |
| `src/app/**/keystatic/**` (관리자 UI·API) | 4 파일 |
| 그 외에서 keystatic을 참조하는 파일 | 12 |
| package.json 의존 | `@keystatic/core ^0.5.48`, `@keystatic/next ^5.0.4` |
| 전용 env | `KEYSTATIC_OWNER`(`NEXT_PUBLIC_KEYSTATIC_OWNER`), `KEYSTATIC_REPO`, 빌드 필수 `KEYSTATIC_GITHUB_CLIENT_ID`/`_SECRET`/`KEYSTATIC_SECRET` |

그 외 참조 12개:

```
src/app/(admin)/admin/entries/slugify.test.ts
src/app/(blog)/(content)/preview/__test__/start.test.ts
src/app/(blog)/(content)/preview/start/route.tsx
src/app/robots.ts
src/components/navigation.client.tsx
src/libs/admin/preview-access.ts
src/libs/admin/verify-access.ts
src/libs/annotation/code-block/types.ts
src/libs/contents/__test__/get-content-repository.test.ts
src/libs/contents/get-content-repository.ts
src/libs/contents/repositories/keystatic.ts
src/libs/contents/repositories/source.ts
```

주의: `src/libs/contents/repositories/keystatic.ts`·`source.ts`·`get-content-repository.ts`는 M7이 **의도적으로 남긴 폴백 경로**다. Keystatic 제거(배치 9)는 `CMS_PUBLIC_REPOSITORY` 기본값을 postgres로 바꾼 뒤에만 가능하다.

## 부록 D. 이관 주소 대조 준비 (전 49편)

레거시 기준 49주소 = posts 7 + memos 42. 아래 목록이 대조 기준이며, DB 측 결과는 `CMS_TEST_DATABASE_URL` 확보 후 채운다(현재 **미실행**).

posts(7):

```
블로그를-다시-만들면서
코드-블럭에-툴팁을-띄우고-싶었을-뿐인데
블로그를-검색하는-벡터-rag-만들기
왜-내-블로그는-ssg가-안될까
내가-만든-rag의-성능-측정하기
블로그라면-seo는-해봐야지
ai가-뱉어낸-코드의-숲에서-길을-잃지-않으려면
```

memos(42):

```
정규표현식-정리
1-implement-curry
10-tuple-to-union
106-trim-left
108-trim
11-tuple-to-object
11-what-is-composition-create-a-pipe
110-capitalize
12-chainable-options
14-first-of-array
15-implement-a-simple-dom-wrapper-to-support-method-chaining-like-jquery
15-last-of-array
16-pop
167-intersection-of-unsorted-arrays
18-improve-a-function
18-length-of-tuple
189-awaited
2-get-return-type
20-promiseall
268-if
28-implement-clearalltimeout
3-omit
3057-push
3060-unshift
3312-parameters
4-pick
43-exclude
533-concat
6-implement-basic-debounce
62-type-lookup
7-readonly
8-can-you-shuffle-an-array
8-readonly-2
898-includes
9-deep-readonly
download-file
js의-코드-실행-메커니즘
js의-비동기-처리-메커니즘
js의-데이터-타입-및-메모리-관리
load-file
tuple과-readonly
xxx-equal
```

DB 측 대조 SQL(공개 노출되는 주소):

```sql
-- 49행이 나와야 하고, 레거시 목록과 차집합이 0이어야 한다
SELECT a.collection, a.slug
FROM content_addresses a
JOIN entries e ON e.id = a.entry_id
JOIN entry_bodies b ON b.entry_id = e.id AND b.state = 'published'
WHERE a.type = 'current' AND e.status = 'published'
ORDER BY a.collection, a.slug;

-- 별칭·삭제 주소 잔존 확인(공개 404 대상이어야 한다)
SELECT collection, slug, type FROM content_addresses WHERE type IN ('alias','deleted') ORDER BY 1,2,3;
```

이미지 22장 R2 대조는 `media_assets`의 키·체크섬과 R2 오브젝트를 비교한다(env 필요, **미실행**).
