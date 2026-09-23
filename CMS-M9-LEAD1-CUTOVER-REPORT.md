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

### 4.4 레거시 모음집 계약 위반 (해결 — B안 적용)

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

**조치(사용자 결정 B, 2026-09-24):** 규격에 맞춰 **22개를 버렸다.**

- `import-plan.ts`: 모음집은 `title`만 넣는다. 버린 개수는 `dropped_collection_items` **경고**로 남긴다.
- 운영 DB: 본문 2행(`working`·`published`)에서 `itemIds` 제거 + `content_hash` 재계산, 딸린
  `entry_references` 44행 삭제. 이전 값은 `artifacts/cms/m9/drop-collection-items.json`에 남겼다.
- 검증: 새 계획 ↔ 운영 DB **본문 149/149, 참조 207/207, 차이 0**.

### 4.5 모음집 `description` 누락 (해결 — 버리기로 결정)

원본에 `description: 그동안 풀었던 타입 챌린지를 순서대로 모았습니다.`가 있는데 DB metadata에는
`title`과 `itemIds`만 있다. `import-plan.ts`가 `description`을 옮기지 않는다.

**사용자 결정으로 되살리지 않는다**("레거시 모음집은 버려주세요"). 공개 화면에 모음집을 그리는
곳이 없어 사용자 영향은 0이다. `description`은 `collection.collection.ts` 스키마에는 있으므로
나중에 필요하면 관리자에서 직접 넣을 수 있다.

### 4.6 M9-BE-3 Keystatic·Giscus 제거 (실행 완료)

사용자가 제거를 승인했다: "keystatic이랑 gisus도 지워버려", "롤백을 왜하지?", "콘텐츠 원본은 보존".

**제거한 것**

| 대상 | 내용 |
| --- | --- |
| 패키지 | `@keystatic/core`, `@keystatic/next`, `@giscus/react` (239개 패키지 정리) |
| 패치·설정 | `patches/` 2개, `pnpm-workspace.yaml`의 `patchedDependencies`·prosemirror overrides |
| 소스 | `src/keystatic/**` 101개, `keystatic.config.ts`, `global.d.ts` |
| 라우트 | `(admin)/keystatic/**`, `api/keystatic/**`, `preview/end`, `posts/[slug]/comments.client.tsx` |
| 인증·설정 | `libs/admin/verify-access.ts`(Keystatic GitHub 쿠키), `tsconfig`의 `@/keystatic/*` alias, `env.d.ts`의 Keystatic·Giscus 변수 |
| 그 외 | `robots.ts`의 `/keystatic/` 규칙, 네비게이션의 `/keystatic` 링크 → `/admin` |

**보존한 것** — `src/contents/**` 75개 원본, `public/assets/**`, `artifacts/cms/m9/**`, 공개 MDX 렌더러
(`src/components/mdx/**`), CMS TipTap 편집기·관리자·이관 코드, `keystaticPublishedAt`(이관 근거),
초안 미리보기 경로 2개.

**공유 의존 처리** — `libs/annotation/code-block/types.ts`가 `@/keystatic`의 타입 하나를 썼다.
상수 파일을 살리지 않고 `CodeBlockElementName = "CodeBlock"` 리터럴로 대체했다.

**`/preview/start`** — 404로 만들면 계획서 §13.4의 401/403과 충돌하므로 호환 라우트를 유지했다:
비인증 **401/403**, 인증된 옛 URL은 **410 Gone**. 리다이렉트·`draftMode`·branch 쿠키는 하지 않는다.

**`CMS_PUBLIC_REPOSITORY`** — `postgres`만 허용하고 **미설정·오값은 실패**한다(fail-closed).

### 4.7 ⚠️ P1 — DB 경로에서 빈 slug가 빌드를 깨뜨렸다 (수정 완료)

Keystatic을 지우고 플래그를 `postgres`로 켜서 **처음으로 `pnpm build`를 돌렸더니 빌드가 실패했다.**

```
TypeError: Cannot read properties of undefined (reading 'trim')
  at getMemo → generateStaticParams
Error [CmsError]: Invalid slug
  at getPublishedEntryBySlug
```

**원인:** Next.js는 빌드 수집 단계에서 `generateImageMetadata`를 **`params` 없이** 부른다.

| | 동작 |
| --- | --- |
| 파일 기반(제거 전) | `sanitize(slug)`가 `if (!str) return ""`로 막아 `read("")` → null |
| DB 기반(제거 후) | `normalizeSlug(slug)`가 `slug.trim()`에서 터짐 |

**이관 전에는 이 경로를 빌드가 타지 않아 드러나지 않은 기존 결함이다.** 그대로 배포했으면
**운영 빌드가 실패**했을 것이다.

**수정(근본 원인):**
- `src/libs/contents/slug.ts` — `normalizeSlug`가 `undefined`/`null`을 받아 `""`를 돌려준다
- `src/libs/contents/repositories/postgres.ts` — `getPost`/`getMemo`가 빈 slug면 저장소를 부르지 않고 `null`

**검증:** `pnpm build` 통과, 회귀 테스트 `src/libs/contents/__test__/slug.test.ts` 추가.

### 4.8 BE-3 검증 결과

| 항목 | 결과 |
| --- | --- |
| `pnpm exec tsc --noEmit` | 통과 |
| 테스트 | **742 tests / 113 files PASS** (`TZ=UTC`) |
| `CMS_PUBLIC_REPOSITORY=postgres pnpm build` | **통과** |
| ProseMirror 중복 버전 | **없음** (1.25.11/1.42.4/1.4.4/1.12.1 단일) |
| TipTap 에디터 실제 로드 | **정상** — 본문 4,339자·문단 36·코드블록 1, 콘솔 오류 0 |
| `/keystatic`·`/api/keystatic`·`/preview/end` | **404** |
| `/preview/start` (관리자 세션) | **410** |
| 공개 글 | **200**, `giscus`/`comments` 마크업 **0건** |
| 공개 초안 | **404** |
| `/rss.xml`·`/sitemap.xml` | **200** |
| 활성 Keystatic 참조 | **0건** (남은 것은 주석과 이관용 헬퍼) |

### 4.9 한글 slug 12건을 영문으로 교체 (사용자 지시)

사용자 지시: "모든 slug를 내용에 맞는 영문으로 교체해줘. 이제 한글 slug도 안 쓰려고."

**대상은 12건뿐이었다.** post 7(전부 한글), memo 5(한글), 나머지 category 3·tag 22·collection 1과
memo 41건은 이미 의미 있는 ASCII(`4-pick`, `898-includes`, `download-file` 등)였다.

| 옛 주소 | 새 주소 |
| --- | --- |
| `ai가-뱉어낸-코드의-숲에서-길을-잃지-않으려면` | `finding-your-way-through-ai-generated-code` |
| `내가-만든-rag의-성능-측정하기` | `measuring-my-rag-performance` |
| `블로그라면-seo는-해봐야지` | `seo-for-blogs` |
| `블로그를-검색하는-벡터-rag-만들기` | `building-a-vector-rag-for-blog-search` |
| `블로그를-다시-만들면서` | `rebuilding-my-blog` |
| `왜-내-블로그는-ssg가-안될까` | `why-my-blog-cant-be-ssg` |
| `코드-블럭에-툴팁을-띄우고-싶었을-뿐인데` | `tooltips-in-code-blocks` |
| `js의-데이터-타입-및-메모리-관리` | `js-data-types-and-memory-management` |
| `js의-코드-실행-메커니즘` | `js-code-execution-mechanism` |
| `tuple과-readonly` | `tuple-and-readonly` |
| `정규표현식-정리` | `regular-expression-notes` |
| `js의-비동기-처리-메커니즘` (초안) | `js-async-processing-method` → `js-async-processing-mechanism` |

**O3 사전 자문이 방식을 바꿔놓았다.**

- **`content_addresses`만 바꾸면 안 된다.** 초안 조회와 다음 발행의 목표 주소는 `entries.working_slug`이라
  12건 모두 같이 갱신해야 한다. 이것을 빼먹으면 새 초안 주소가 조회되지 않는다.
- **`publishEntry`를 부르면 안 된다.** 그 함수는 working 본문을 published로 복사하므로
  `ai가-뱉어낸-…`의 **미발행 편집이 라이브로 나간다**(그 글만 working≠published다).
  그래서 주소만 직접 바꾸고 `entry_bodies`는 손대지 않았다.
- **본문에 절대 URL 링크가 1건 있었다.** `내가-만든-rag…`가 `https://bh2980.dev/posts/블로그를-검색하는-벡터-rag-만들기`를
  가리킨다. 308 별칭이 이를 살린다(검증함).
- **`canonicalUrl` 수동 지정은 0건**이었다(있었으면 중단할 예정).

**적용:** `artifacts/cms/m9/rename-slugs.mjs` (드라이런 기본, `--apply` + `CMS_SLUG_RENAME_APPLY=1` 필요).
단일 `SERIALIZABLE` 트랜잭션, 영향 행 수 단언(11/11/1/12), 불변량 검증 실패 시 자동 ROLLBACK.

- published 11건: 기존 `current` → `alias`, 새 slug를 `current`로 INSERT
- 초안 1건: `reservation` 행의 slug만 UPDATE (공개 이력 없음 → alias 없음)
- 12건 모두 `entries.working_slug`·`version+1`·`updated_at`만 갱신

**검증 결과**

| 항목 | 결과 |
| --- | --- |
| 주소 분포 | current 74 / reservation 1 / **alias 11** |
| 본문 149행 지문 | **불변** (`00e33670…`) |
| 참조 207행 | **불변** |
| 상태 | 74 published / 1 draft **불변** |
| `ai가-뱉어낸` working≠published | **유지** |
| 신규 주소 11건 | **200** |
| 옛 주소 11건 | **308 → 신규 주소** |
| 초안 신규 공개 / 옛 주소 | **404 / 404** |
| 초안 신규 미리보기(인증) | **200** |
| 본문 절대링크(옛 주소) | **308 → 신규 주소** |
| RSS·sitemap | 새 주소 사용, 옛 한글 주소 **잔존 0** |

한글은 **current·reservation에서 0건**이지만, **alias에는 옛 URL을 살리기 위해 남긴다**(§457과 일치).

### 4.10 P1 — 이미지 노드 뷰가 TipTap v3 계약을 어겼다 (수정 완료)

사용자 보고: 브라우저에서 `Please use the NodeViewWrapper component for your node view`.

**원인:** `src/cms/editor/image-node-view.tsx`가 `<figure>`를 그대로 반환했다.
TipTap v3는 노드 뷰의 첫 자식이 `data-node-view-wrapper`를 가져야 한다
(`@tiptap/react/dist/index.js:941`). 그 속성을 넣는 것이 `NodeViewWrapper`다.

**M9 이전부터 있던 결함**이다(`2b1028a`, M9 커밋 아님). **이미지 있는 글 5건**에서 터졌다.

**수정:** `<NodeViewWrapper as="figure" data-image-block …>`로 감쌌다.

**검증(실제 Chrome, DB 모드):** 이미지 있는 글에서 `figure[data-image-block]` **2개**,
`[data-node-view-wrapper]` **2개**, `img` **2개**, 깨진 이미지 문구 **0**, **콘솔 오류 0**.

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

## 6. 사용자 결정 결과 (2026-09-24)

### 6.1 배포·전환은 사용자 소관

사용자 결정: **"배포는 main에 merge하면 되는거라 내가 알아서 할게"**, **"로컬에서 충분히 손보고 배포"**.

따라서 `feature/new-cms` 푸시·머지·배포와 `CMS_PUBLIC_REPOSITORY=postgres` 전환은 **사용자가 직접** 한다.
배포 환경 정보(§6.6)도 더 요구하지 않는다.

**단, 저장소에 남는 작업이 있다** — M9-BE-3(Keystatic 제거)는 개발 작업이고, §6.3의 게이트를
통과해야 착수할 수 있다. 앞서 이 보고서에 "남는 작업 없다"고 적었으나 그건 틀렸다.

`feature/new-cms`의 M9 커밋은 **아직 원격에 없다**(`origin/feature/new-cms`가 `origin/main`과 같은
`f03f92b`를 가리킨다).

### 6.2 관찰 기간 — 사용자가 두지 않기로 결정 (단, 게이트는 면제되지 않음)

계획서 §61·§117은 관찰 기간을 요구했으나, **사용자가 불필요하다고 결정했다**(2026-09-24):
"로컬에서 충분히 손보고 배포할거라 상관없음". 따라서 관찰 기간은 **0**으로 기록한다.

**다만 O3 자문(2026-09-24)은 관찰 기간 0이 R5나 제거 승인을 면제하지 않는다고 지적했다.**
그 지적이 맞다. 앞서 이 보고서에 "저장소에 남는 작업은 없다"고 적었으나 **틀렸다.**

### 6.3 게이트 상태 (계획서 §60~§63)

| 순서 | 게이트 | 상태 |
| --- | --- | --- |
| 5 | M9-BE-2 플래그 전환 + 배포 | **사용자 수행** — 머지·배포는 사용자 소관 |
| 6 | **R5** (배포 smoke) | 배포 후 필요하면 수행 |
| 6 | **O3** | **사전 자문 완료**(§6.5). 정식 O3는 BE-2 배포 후 |
| 7 | **사용자 Keystatic 제거 승인** | **획득** (2026-09-24) |
| 7 | M9-BE-3 Keystatic·Giscus 제거 | **실행 완료** (§4.6~§4.8) |
| 8 | R6 → M9-RV-1 | 미착수 |

사용자가 계획서의 게이트 순서(BE-2 배포 → R5 → O3 → 승인 → BE-3)를 앞당겨
**제거를 먼저 승인·실행**했다. 롤백도 불필요로 결정했으므로 O3가 조건으로 든
"롤백 방식 변경 승인" 문제는 종결됐다. R5·R6·M9-RV-1은 배포 후로 남는다.

### 6.3.1 ⚠️ 필수 배포 선행조건

**`CMS_PUBLIC_REPOSITORY=postgres`를 배포 환경에 설정해야 한다.** 빠뜨리면 사이트가 뜨지 않는다.

- Keystatic 파일 저장소를 제거했으므로 **대체 경로가 없다.** 미설정·오값이면 `getContentRepository()`가
  모듈 로드 시 실패한다(fail-closed).
- **즉 "머지하면 기존 사이트가 유지된다"가 아니다.** 머지와 무중단 전환은 분리되지 않는다.
  플래그를 같은 배포에서 같이 설정해야 한다.
- 로컬 `.env.local`에도 같은 값이 필요하다(빌드가 이 플래그를 요구한다 — §4.7).
- `CMS_DATABASE_URL`도 함께 필요하다.

### 6.4 레거시 모음집 처리 — 결정: B (적용 완료)

사용자가 **B(memo `itemIds`를 버림)** 를 선택했고 §4.4에 적용·검증했다.
`description`은 되살리지 않기로 했다(§4.5).

### 6.5 O3 사전 설계 자문 결과 (2026-09-24, 제거 no-go)

계획서가 정한 순서(BE-2 배포 → R5 → O3 → 제거 승인 → BE-3)를 지키지 않은 채 O3를 소집했다.
Oracle이 이를 지적했고 **그 지적이 맞다.** 따라서 이번 자문은 **사전 설계로만** 기록하고
**삭제는 하지 않는다.**

**제거 방식 권고 — (b) 전체 제거 + 코드 롤백, 단 조건부**
- `repositories/keystatic.ts`는 `@keystatic/core`와 `keystatic.config.ts`에 직접 의존하므로
  **(a) reader만 남기는 안은 패키지 제거와 양립하지 않는다.**
- 조건: BE-2 배포 커밋·배포 ID·재배포 절차를 확보하고, **롤백 방식 변경(플래그 → 코드 되돌리기)을
  사용자가 명시적으로 승인**할 때만 진행. 확보 못 하면 **BE-3를 연기하고 플래그 롤백을 유지**한다.

**제가 놓쳤던 것 (Oracle 발견)**
| 항목 | 내용 |
| --- | --- |
| **Giscus** | `posts/[slug]/comments.client.tsx`가 `NEXT_PUBLIC_KEYSTATIC_OWNER/REPO`를 쓴다. 지우면 **댓글이 깨진다** |
| 관리자 인증 | `src/libs/admin/verify-access.ts`가 Keystatic GitHub 쿠키로 인증한다 |
| 네비게이션 | `navigation.client.tsx`가 `/keystatic`으로 링크한다 |
| 패치 | `patches/@keystatic__core@0.5.48.patch`, `patches/@keystar__ui@0.7.19.patch` |
| 공유 상수 | `libs/annotation/code-block/types.ts`의 `EDITOR_CODE_BLOCK_NAME` type은 **리터럴 타입으로 대체**하면 되고 constants 파일을 남길 필요 없다 |
| ProseMirror overrides | `pnpm-workspace.yaml`의 overrides는 **Tiptap도 쓰므로 확인 없이 삭제 금지** |

**`/preview/start` 충돌 정리안**
- 계획서 §13.4의 "비인증 401/403"을 지키려면 **404로 만들면 안 된다.**
- 승인 후 Keystatic 연동만 끊고 `checkPreviewAccess()`를 먼저 부르는 **작은 호환 라우트**를 유지:
  비인증 **401/403**, 인증된 기존 URL은 **410 Gone**. 쿠키·`draftMode().enable()`·리다이렉트는 하지 않는다.
- 실제 초안 미리보기(`/preview/posts/[slug]`·`/preview/memos/[slug]`)는 그대로 유지.

**미설정 기본값**
- **BE-3 이전에는 절대 바꾸지 않는다** — 라이브가 파일 저장소를 읽고 있다.
- BE-3 이후에는 조용한 `postgres` 기본값보다 **`CMS_PUBLIC_REPOSITORY=postgres` 명시 필수**(미설정 시 실패)가 안전하다.

**잔존 검색 통과 정의**
`src`·루트 설정·`package.json`·`pnpm-workspace.yaml`에서 `@keystatic/`, `@/keystatic/`,
`keystatic.config`, `/api/keystatic`, `/keystatic` 링크, `__KEYSTATIC_`, `KEYSTATIC_GITHUB_`,
`KEYSTATIC_SECRET`, 패치 등록의 **활성 사용 0건**. Giscus 변수는 이전 전까지 명시적 예외.
`src/contents/**`·계획·감사 문서·fixture의 역사적 문자열은 세지 않는다.

### 6.6 배포 절차 — 사용자 소관으로 종결

저장소에 `vercel.json`·`.vercel`·CI 워크플로가 없다. 배포 ID·재배포 절차·소요 시간을
코드로 확인할 수 없으나, **사용자가 직접 배포하기로 했으므로 더 요구하지 않는다.**

이 공백이 남기는 위험은 하나다: **롤백 재배포 시간을 문서로 보장할 수 없다.**
롤백 지점(`origin/main` @ `f03f92b`)은 확보돼 있다.

---

## 7. 롤백 계획

| 항목 | 값 |
| --- | --- |
| 원격 롤백 커밋 | **`origin/main` @ `f03f92b`** (라이브가 쓰는 Keystatic 버전, 불변) |
| 롤백 방법 | `CMS_PUBLIC_REPOSITORY`를 파일 기반으로 되돌리고 재배포 |
| 적재 행 | **삭제하지 않는다.** 되돌려도 무해하다 |
| 공유 DB 전체 복원 | **기본 롤백으로 제시하지 않는다** |

**한계(계획서 §171):** 플래그만 되돌리는 롤백은 **전환 후 DB 쓰기가 있으면 무손실이 아니다.**
전환 후 CMS로 쓴 글은 파일 기반 Keystatic에 없다. 관찰 기간을 두지 않기로 했으므로(§6.2)
**이 위험은 사용자가 감수한다.** 롤백 후 공개·초안 미리보기를 다시 확인하는 편이 좋다.

**BE-3 이후에는 이 롤백이 달라진다 (O3 지적).** Keystatic 패키지·`repositories/keystatic.ts`를
지우면 **플래그를 되돌려도 파일 기반으로 돌아갈 수 없다.** 그 뒤 롤백은 **BE-2 배포 커밋으로
코드·설정을 되돌려 재배포**하는 방식이다. 그래서 O3는 **BE-2 커밋·배포 ID·재배포 절차를 확보하고
롤백 방식 변경을 사용자가 명시 승인하기 전에는 BE-3를 강행하지 말라**고 권고했다.

---

## 8. 남은 위험

| 등급 | 항목 |
| --- | --- |
| P1(해소) | 표시 날짜 타임존 — 수정·검증 완료 |
| P1(해소) | 이관 후 DB 쓰기 2건 — 복원, 149/149 |
| P2(해소) | 레거시 모음집 `itemIds` 22개·참조 44행 — B안으로 제거, 계획↔DB 207/207 |
| P2 | 에디터 "발행 일시" 입력이 로드값으로 초기화되지 않음(저장 시 지워지지는 않음, M9 이전 `13e733a`부터) |
| P2 | `@char Tooltip` 코드블록 주석이 공개 렌더에 안 나옴 — **파일 기반 운영 모드도 동일** |
| P2 | 모음집 `description`을 이관하지 않음(사용자 결정으로 되살리지 않음) |
| P2 | `/preview/start`는 Keystatic 제거 후 호환 라우트다 — 비인증 401/403, 인증 410 (§4.6) |
| P1(해소) | **DB 경로에서 빈 slug가 빌드를 깨뜨렸다** — `normalizeSlug`/`getPost`/`getMemo` 수정, 회귀 테스트 추가 (§4.7) |
| 감수 | **`CMS_PUBLIC_REPOSITORY=postgres`를 배포에 설정하지 않으면 사이트가 뜨지 않는다** (§6.3.1) |
| 감수 | 관찰 기간 0 → 전환 후 DB 쓰기가 있으면 플래그 롤백이 무손실이 아님(§6.2) |
| 감수 | 롤백 재배포 소요 시간을 문서로 보장할 수 없음(§6.4) |

**공개 회귀는 없다.** 남은 항목은 모두 전환을 막지 않는다.

---

## 9. 배포 절차

**사용자가 수행:**
1. **배포 환경에 `CMS_PUBLIC_REPOSITORY=postgres`와 `CMS_DATABASE_URL` 설정** (필수 — §6.3.1)
2. `feature/new-cms`를 `main`에 머지·배포
3. 공개 확인 — 48편 200, 초안 404, `/admin` 로그인, RSS/sitemap, `/assets` 22장, 댓글 영역 없음
4. 문제가 있으면 **BE-3 이전 커밋으로 되돌려 재배포** (플래그 롤백은 불가 — §7)

**그 뒤 선택:**
5. **R5** — 배포된 실제 URL 검수
6. **R6** → **M9-RV-1** 최종 검수

**이관 계획 지문이 바뀌었다.** 모음집 항목을 버리면서 해시가 달라졌다:

| | 지문 |
| --- | --- |
| 이관 당시(승인값) | `70794ce90e83db05d5acb3f5d91bf7d10c2ffb012eae377669d632643c3cbbf4` |
| 현재(모음집 항목 제거 후) | `c602e6272b7ea7448a0c5b6952bea9529d8b1d210a62d9e4045a91e01d1c9f05` |

건수는 75건(published 74 / draft 1) 그대로다. 운영 DB는 **새 계획과 149/149·207/207 일치**한다.

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
