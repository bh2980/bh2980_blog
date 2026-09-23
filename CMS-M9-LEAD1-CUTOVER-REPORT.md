# CMS M9 전환 보고서 (M9-LEAD-1)

작성: 2026-09-24 · 브랜치 `feature/new-cms` @ `47aaf12` · 기준 문서 `CMS-M9-DEV-PLAN.md`

이 보고서는 **공개 트래픽 전환 승인 요청**을 위한 것이다. 운영 DB 이관은 이미 실행됐고,
공개 전환과 Keystatic 제거는 **각각 별도 승인**이 필요하다.

---

## 1. 요약

| 항목 | 상태 |
| --- | --- |
| 운영 DB 이관 (75건) | **완료** · `outcome=verified` |
| 사후 검증 (읽기 전용) | **통과** · blocking 없음, Payload 미접촉 |
| 공개 렌더 등가성 (48편 DOM) | **통과** · 48/48 동일 |
| 본문 해시 전수 대조 (149개) | **통과** · 149/149 일치 (2건 복원 후) |
| 이미지 22장 | **통과** · 파일·응답 바이트 SHA-256 22/22, HTTP 200 22/22 |
| 테스트 | **812 tests / 127 files PASS** (TZ=UTC), `pnpm typecheck` 0, `pnpm build` 통과 |
| R3 독립 검수 | **중대한 결함/위험 없음(머지 가능)** |
| O2 독립 감사 | **조건부 go** — 아래 §5의 조건 |

**결론: 이관 데이터는 전환 가능한 상태다. 다만 §6의 사용자 결정 3건이 남아 있다.**

---

## 2. 무엇을 했나

### 2.1 운영 이관

```
CMS_MIGRATION_APPLY_PRODUCTION=1 … apply-production \
  --expect-digest 70794ce90e83db05d5acb3f5d91bf7d10c2ffb012eae377669d632643c3cbbf4 \
  --expect-items 75 --expect-existing-entries 0

[apply-production] schema=public db=neondb role=neondb_owner
  적재: imported=75 skipped=0
  검증: entries=75 published=74 draft=1 slugSetsMatch=true
  outcome: verified
```

대상은 **운영 브랜치**(`ep-bitter-pine…`)의 `public` schema다. 시험 브랜치가 아니다.
운영 진입점은 `CMS_DATABASE_URL`만 쓰고, 두 DSN이 같은 DB면 중단하며, `cms_m6_*` schema와
슈퍼유저를 거부하고 DDL을 하지 않는다. 적재는 단일 트랜잭션이고 1회만 돈다.

### 2.2 사후 검증 (읽기 전용)

| 항목 | 값 |
| --- | --- |
| entries | 75 (post 7, memo 42, category 3, tag 22, collection 1) |
| 상태 | published 74 / draft 1 |
| addresses | current 74, reservation 1 |
| media_assets / folders / schedules | 0 / 1(기존) / 0 |
| Payload 테이블 | 19개 미접촉 |
| `schemaReady` / `isSuperuser` | true / false |

`inspect-target`은 `BEGIN TRANSACTION READ ONLY`로만 돈다.

### 2.3 이관 중 고친 결함 2건

| 커밋 | 내용 |
| --- | --- |
| `955d51a` | 한글 slug 공개 주소가 전부 500이 되던 alias 판정 (M9 이전부터 main에 있던 버그) |
| `99f6707` | Keystatic이 KST를 UTC로 잘못 저장한 발행일을 KST로 해석 (B안) |
| `321c12c` | 표시 날짜를 `Asia/Seoul`로 고정 (R3 P1) — 아래 §4.2 |

---

## 3. 검증 증거

### 3.1 공개 렌더 등가성 — DOM 구조 48/48 동일

시험 브랜치(`cms_m6_preview`)와 운영 브랜치(`public`)로 각각 같은 앱을 띄워 공개 48편을 받아 비교했다.

| 비교 항목 | 결과 |
| --- | --- |
| `article` DOM · `a[href]` · `img[src]` · `meta` · `link` · head `<title>` | **48/48 동일** |
| 남은 차이 | `dateTime` 속성 문자열 정밀도(`10:07+09:00` vs `10:07:00.000+09:00` — 같은 순간) |

### 3.2 본문 해시 전수 대조 — 149/149

계획의 `contentHash` 149개와 운영 DB `entry_bodies` 149행을 대조했다.

- 처음에 **2건 불일치**를 발견했다(§4.3). 계획 원본으로 되돌린 뒤 **149/149 일치**.
- `contentHash` = `sha256(JSON.stringify(["cms-snapshot-v1", schemaVersion, sortKeys(metadata), mdx]))`.

### 3.3 이미지 22장

이미지 바이너리는 옮기지 않고 기존 `/assets` 경로를 그대로 쓴다(R2 업로드는 M9 범위 밖).

| 검사 | 결과 |
| --- | --- |
| `public/` 파일 존재 · SHA-256 | 22/22 (`assets-sha256.txt`) |
| HTTP 200 · **응답 바이트** SHA-256 | 22/22 (`assets-http-response-sha256.txt`) |

경로는 본문에 퍼센트 인코딩돼 저장돼 있어 대조 시 `unquote` 후 파일을 찾아야 한다.
**로컬 서버(`next dev`, TZ=UTC, 운영 DB 구성) 기준이다.** 실제 배포 CDN 응답은 이 환경에서
`bh2980.dev` DNS가 해석되지 않아 확인하지 못했다(§6.4).

### 3.4 실제 브라우저 전수 확인 (75건)

| 대상 | 건수 | 결과 |
| --- | --- | --- |
| 공개 페이지 | 48 | 오류 0, 깨진 이미지 0, 이미지 22장 |
| 에디터 | 49 | 빈 본문 0, 원문 카드 130개 보존 |
| 초안 | 1 | 공개 404, 에디터 정상 |

커스텀 컴포넌트(Callout·Tabs·Collapsible·Tooltip·mermaid·chart·수식) 공개 렌더 전종 정상.

### 3.5 인증 경계

| 경로 | 비인증 | 인증 |
| --- | --- | --- |
| `/preview/memos/[초안]` | **404** | **200** |
| `/memos/[초안]` (공개) | **404** | 404 |
| `/admin` | 307(로그인) | — |

미리보기 경로는 `/preview/posts/[slug]`·`/preview/memos/[slug]`다. `getPreviewMemo`는 못 찾으면
`null`을 돌려주고 페이지가 `notFound()`를 부른다(`preview/memos/[slug]/page.tsx`).
`/preview/start`는 Keystatic 라우트라 M9-BE-3 범위다.

---

## 4. 이관 후 발견한 문제와 처리

### 4.1 `<title>GitHub</title>` 오진 (문서 정정)

§12.3에 "Keystatic 리더 실패"로, 뒤에 "본문 코드 예시"로 적었는데 **둘 다 틀렸다.**
실체는 `src/components/footer.tsx:32`의 **SVG 아이콘 제목**이다. 계획서를 정정했다.

### 4.2 표시 날짜 타임존 (R3 P1, 수정 완료)

`Intl.DateTimeFormat`에 `timeZone`이 없어 프로세스 로컬 달력을 썼다. 이관 전에는 파일 경로가
Keystatic의 잘못된 `Z`를 넘겨 UTC 런타임에서 **우연히** 맞았지만, 이관 후 DB는 정확한 순간을 주므로
UTC 런타임(Vercel)에서 KST 벽시계 00:00~08:59 발행 **8편이 하루 앞당겨진다.**

수정: `formatPublishedAt`에 `Asia/Seoul` 고정 + 파일 기반 조회도 `keystaticPublishedAt`으로 정규화.
검증: `TZ=UTC`에서 DB 경로 48/48, 파일 경로 48/48 화면 날짜 일치.

### 4.3 이관 후 운영 DB 쓰기 2건 (복원 완료)

**이관 뒤 working 본문 2행이 다시 쓰였다.**

| 항목 | 시각 |
| --- | --- |
| 이관 | 2026-09-23 20:39:22 KST |
| `왜-내-블로그는-ssg가-안될까` working | 2026-09-23 22:29:59 KST |
| `코드-블럭에-툴팁을-띄우고-싶었을-뿐인데` working | 2026-09-23 22:28:40 KST |

- 차이는 MDX 정규화 형태뿐이었다(`***"…"***` → `<strong><em>…</em></strong>`, `:::text-align` 추가).
  **published 본문은 계획과 일치**했고 공개 렌더도 동일했다 — 즉 공개 영향은 없었다.
- 한 편의 DB 값은 현재 에디터 정규화 결과와 **정확히 일치**했다. 에디터 저장 흔적으로 보인다.
- **`planDigest`는 계획 동결만 증명하고 이관 후 DB 쓰기를 탐지하지 못한다.** O2 지적이 맞았다.
- 조치: 계획 원본으로 되돌렸고 **149/149 일치**를 확인했다.
- 재발 방지(운영 약속): 운영 DB를 향한 dev 서버는 관리자 경로를 열지 않는다(에디터 자동저장이 운영 DB를 쓴다).
  이건 **코드 가드가 아니라 운영 규칙**이다. `planDigest`는 여전히 이관 후 DB 쓰기를 탐지하지 못한다.

### 4.4 레거시 모음집 계약 위반 (미해결 — §6 결정 필요)

`type-challenges` 모음집의 `itemIds` 22개가 **memo**를 가리킨다. 그런데:

- `CMS-SPEC.md:482` — "`itemIds`는 게시글(post)만을 대상으로 한다"
- `content-service.ts:528-534` — post가 아니면 `invalid_item_collection`
- `postgres.ts:toSeries` — `postsById`에서만 찾으므로 memo ID는 해석되지 않음
- 원본 `src/contents/collections/type-challenges.yaml`은 `items` 필드가 없고 레거시
  `meta.discriminant: wiki` / `value.memo` 형태다(Keystatic 스키마는 `post` 관계를 선언)

**공개 영향은 없다.** `listSeries`/`getSeries`에 공개 소비자가 없고, 이관 전에도
`series.items`가 비어 있어 **양쪽 다 0개**다. `toSeries`가 `postsById`에서만 찾으므로
이관 후에도 `series.items`는 0개다.

**발행은 막히지 않는다.** `validateForPublish`의 `invalid_item_collection`(`content-service.ts:528-534`)은
**테스트에서만 호출된다.** 발행 API는 `store.publishEntry`만 부르고(`publish/route.ts:41`), 그 함수는
참조 대상이 존재하고 `published`인지만 본다(`content-store.ts:1458-1464`) — 컬렉션이 post인지는 보지 않는다.
이 22개는 발행된 memo이므로 이 검사를 통과한다.

즉 **계약 함수는 위반으로 보지만 현재 발행 API는 막지 않는다.** 재발행해도 공개 `series.items`는 0이다.

### 4.5 모음집 `description` 누락 (미해결 — §6 결정 필요)

원본에 `description: 그동안 풀었던 타입 챌린지를 순서대로 모았습니다.`가 있는데 DB metadata에는
`title`과 `itemIds`만 있다. `import-plan.ts`가 `description`을 옮기지 않는다. **데이터 손실**이다.
공개 화면에 모음집을 그리는 곳이 없어 사용자 영향은 0이다.

---

## 5. O2 독립 감사 결과

**판정: 조건부 go — 공개 전환 승인 요청은 아직 보류.** 조건과 처리 상태:

| # | 조건 | 상태 |
| --- | --- | --- |
| 1 | 7편·미분류 2편을 DOM 구조·링크·head 메타로 다시 비교 | **완료** — 48/48 동일 (§3.1) |
| 2 | 계획↔운영 DB `content_hash` 149개 전수 대조 | **완료** — 2건 발견·복원, 149/149 (§4.3) |
| 3 | `/assets` 응답 **바이트** SHA-256 | **완료**(로컬) — 22/22 (§3.3). 배포 CDN은 미확인 |
| 4 | 배포 ID·플래그 복귀 권한·재배포 절차·소요, 관찰 기간 확정 | **미완 — 사용자 확인 필요** (§6) |
| 5 | LEAD-1 기록 + R4 검수 + `pnpm build` | **진행 중** — 빌드 통과, R4 대기 |

O2가 지적한 "7편을 RSC 순서 차이로 단정한 근거가 약하다"는 타당했고, 다시 하니 **더 강한 결과**가 나왔다.

---

## 6. 승인 요청 (사용자 결정 필요)

### 6.1 공개 트래픽 전환 승인 (별도)

`CMS_PUBLIC_REPOSITORY=postgres`로 전환하고 배포한다. `feature/new-cms`의 M9 커밋은 **아직 원격에 없다**
(`origin/feature/new-cms`가 `origin/main`과 같은 `f03f92b`를 가리킨다). 개수는 커밋마다 변하므로
기준은 **현재 HEAD SHA**로 잡는다.

### 6.2 관찰 기간 (미정)

계획서 §309에 "미정 · O1에서 권고, LEAD-1에서 승인값 확정"으로 비어 있다.
관찰 기간이 끝나기 전에는 Keystatic을 삭제하지 않는다.

### 6.3 레거시 모음집 처리 (A/B)

| 안 | 내용 | 대가 |
| --- | --- | --- |
| **A** | 그대로 둔다 | 공개 영향 0. CMS에서 재발행은 되지만 공개 `series.items`는 계속 0 |
| **B** | 이관 시 memo `itemIds`를 버린다 | `CMS-SPEC`와 일치. "원본 관계를 버렸다"는 기록 필요 |

`description` 누락도 같은 결정에 묶는다(되돌리려면 운영 DB 추가 쓰기).

### 6.4 배포 절차 확인 (미확인)

저장소에 `vercel.json`·`.vercel`·CI 워크플로가 **없다.** 배포 ID, 플래그 복귀 권한,
재배포 절차와 소요 시간을 코드로 확인할 수 없다. **사용자 확인이 필요하다.**

---

## 7. 롤백 계획

| 항목 | 값 |
| --- | --- |
| 원격 롤백 커밋 | **`origin/main` @ `f03f92b`** (라이브가 쓰는 Keystatic 버전, 불변) |
| 롤백 방법 | `CMS_PUBLIC_REPOSITORY`를 파일 기반으로 되돌리고 재배포 |
| 적재 행 | **삭제하지 않는다.** 되돌려도 무해하다 |
| 공유 DB 전체 복원 | **기본 롤백으로 제시하지 않는다** |

**한계(계획서 §171):** 플래그만 되돌리는 롤백은 **전환 후 DB 쓰기가 있으면 무손실이 아니다.**
전환 후 CMS로 쓴 글은 파일 기반 Keystatic에 없다. 그래서 관찰 기간 동안 **양쪽 콘텐츠 쓰기를 동결**한다.
공개·초안 미리보기는 롤백 후에도 다시 확인한다.

---

## 8. 남은 위험

| 등급 | 항목 |
| --- | --- |
| P1(해소) | 표시 날짜 타임존 — 수정·검증 완료 |
| P1(해소) | 이관 후 DB 쓰기 2건 — 복원, 149/149 |
| P2 | 에디터 "발행 일시" 입력이 로드값으로 초기화되지 않음(저장 시 지워지지는 않음, M9 이전 `13e733a`부터) |
| P2 | `@char Tooltip` 코드블록 주석이 공개 렌더에 안 나옴 — **파일 기반 운영 모드도 동일** |
| P2 | `/preview/start`(Keystatic 라우트)가 M9-BE-3 범위로 남음 |
| 미확인 | 배포 ID·재배포 절차·소요 (§6.4) |
| 미확정 | 관찰 기간 (§6.2) |
| 미결정 | 레거시 모음집 `itemIds`·`description` (§6.3) |

**공개 회귀는 없다.** 남은 항목은 전환을 막지 않지만 §6의 결정 없이는 진행하지 않는다.

---

## 9. 전환 절차 (승인 시 제안)

1. 동결 확인 — 양쪽 콘텐츠 쓰기 중단, 지문 재확인(`70794ce9…`)
2. `feature/new-cms` 푸시·머지·배포 (보고서 기준 HEAD `47aaf12`)
3. 배포 smoke — HTTP/SEO/RSS/sitemap/API/미리보기, 공개 초안 차단, `/assets` 22장
4. `CMS_PUBLIC_REPOSITORY=postgres` 전환 + 재배포
5. **R5 검수** (실제 배포 대상 HTTP)
6. 관찰 기간 (승인값) → **O3** → Keystatic 제거 승인 → **M9-BE-3**
7. **M9-RV-1** 최종 검수

---

## 부록 A. 커밋

```
3a0d45e fix(cms): 이관 후 정규화된 working 본문 2건을 계획 원본으로 되돌린다
ade6c74 test: 테스트를 운영과 같은 UTC로 고정한다 (R3 재검수 P2)
321c12c fix(cms): 표시 날짜를 KST로 고정한다 (R3 P1)
0436cff docs(cms): 시험 DB와 운영 DB의 공개 48편 렌더가 동일함을 기록한다
892e791 docs(cms): 운영 DB 이관 실행 결과와 사후 검증을 기록한다
99f6707 fix(cms): 이관 시 발행일을 KST로 해석한다
955d51a fix(blog): 한글 slug 공개 주소가 500이 되던 alias 판정을 고친다
62d926b test(cms): M9-TW-1 선행 — 이관 후 공개 렌더 등가성을 실DB에서 검증한다
bca5a06 feat(cms): M9-BE-1 운영 전용 이관 진입점과 안전 가드를 추가한다
```

## 부록 B. 증거 파일

```
artifacts/cms/m9/production-apply.json           이관 실행 보고서 (outcome=verified)
artifacts/cms/m9/target-inspection-applied.json  READ ONLY 사후 대조
artifacts/cms/m9/dry-run-approval.json           승인 시점 계획·지문
artifacts/cms/m9/assets-sha256.txt               이미지 22장 파일 해시·바이트
artifacts/cms/m9/assets-http-response-sha256.txt 이미지 22장 HTTP 응답 바이트 해시(로컬)
artifacts/cms/m9/restore-working-bodies.json     복원 대상 계획 원본
artifacts/cms/m9/restore-working-bodies.mjs      복원 스크립트(드라이런 기본)
artifacts/cms/m9/preview-targets.json            공개 48 + 에디터 49 목록
artifacts/cms/m9/corpus-inspection.json          원본 inventory
CMS-M9-DEV-PLAN.md §11~§14                        전체 기록
```
