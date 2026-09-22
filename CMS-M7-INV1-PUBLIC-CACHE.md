# M7-INV-1 공개 페이지 캐시/동적 렌더 조사

- 작성: 2026-09-22 · Lead/BE · 대상: `CMS-V1-IMPLEMENTATION-PLAN.md` M7-INV-1, `CMS-SPEC.md` §11.1
- 목적: Next 16에서 공개 조회를 DB 요청 시 조회로 바꿀 때, 캐시가 초안·보관본을 남기지 않도록 **적용할 페이지 파일 목록과 캐시 설정**을 확정한다. Vercel 전용 ISR을 필수 전제로 두지 않는다.
- 상태: 조사 완료. 캐시 전략 최종 결정은 O1(A1/A2/A3)에서 확정하고 이 문서 말미에 기록한다.

## 1. 결론 요약

1. **원인은 캐시보다 정적 생성이다.** 상세 페이지는 `force-static` + `dynamicParams = false` + `generateStaticParams`이고, 목록·sitemap·OG는 빌드 시 생성된다. 새 글·보관 처리가 **재배포 없이는 반영되지 않는 직접 원인**이다.
2. 따라서 M7-BE-2의 본질은 "캐시 끄기"가 아니라 **공개 조회 경로를 요청 시 조회로 바꾸는 것**이다.
3. 즉시성 요구(발행 즉시 노출 / 보관 즉시 404·피드 제외)와 캐시는 양립하기 어렵다. 계획 원칙 4("캐시·성능보다 미노출 우선")에 따라 **요청 시 조회를 기본값**으로 한다.
4. 프레임워크 기본값에 기대지 않는다. **모든 공개 경로에 캐시 의도를 명시적으로 선언**한다(누락이 곧 버그가 되는 구조를 없앤다).

## 2. 공개 조회 소비자 지도 (전수)

공개 조회는 모두 `src/libs/contents/services/{post,memo,category,tag}.ts`를 거치고, 그 아래 `getContentRepository()`가 단일 교체 지점이다. **페이지·라우트가 제공자를 직접 보는 곳은 없다.**

| # | 파일 | 호출 | 현재 캐시 의도 | 전환 후 목표 |
| --- | --- | --- | --- | --- |
| 1 | `(blog)/(landing)/page.tsx` | `listPosts`, `listMemos` | 명시 없음(빌드 시 정적) | 매 요청 공개본 |
| 2 | `(blog)/(content)/posts/page.tsx` | `listCategories`, `listPosts` | 명시 없음 → 정적 | 매 요청 공개본 |
| 3 | `(blog)/(content)/memos/page.tsx` | `listMemos`, `listTags` | 명시 없음 → 정적 | 매 요청 공개본 |
| 4 | `(blog)/(content)/posts/[slug]/page.tsx` | `getPost`, `listPosts`, `listPostSlugs` | `force-static` + `dynamicParams=false` + `generateStaticParams` | 요청 시 조회, 비공개 404, 별칭 308 |
| 5 | `(blog)/(content)/memos/[slug]/page.tsx` | `getMemo`, `listMemoSlugs` | 동일 | 동일 |
| 6 | `(blog)/(content)/posts/[slug]/opengraph-image.tsx` | `getPost` | 빌드 시 생성 | 요청 시, 비공개면 미생성 |
| 7 | `(blog)/(content)/memos/[slug]/opengraph-image.tsx` | `getMemo` | 빌드 시 생성 | 동일 |
| 8 | `(blog)/(content)/posts/opengraph-image.tsx` | 없음(정적 이미지) | 정적 | 변경 없음 |
| 9 | `(blog)/(content)/memos/opengraph-image.tsx` | 없음(정적 이미지) | 정적 | 변경 없음 |
| 10 | `rss.xml/route.ts` | `listPosts` | 명시 없음(GET 라우트 핸들러) | 요청 시, 비공개 제외 |
| 11 | `sitemap.ts` | `listPosts`, `listMemos` | 명시 없음(메타데이터 라우트) | 요청 시, 비공개·custom canonical 제외 |
| 12 | `robots.ts` | 없음 | 정적 | 변경 없음 |
| 13 | `llms.txt` | 없음(정적 파일) | 정적 | 변경 없음 |
| 14 | `(blog)/(content)/preview/**` | `getPreviewPost`, `listPreviewPosts`, `getPreviewMemo`, `draftMode` | `force-dynamic`(layout) + Keystatic draftMode | M7-FE-1에서 CMS 세션 기반으로 교체 |

### 2.1 부수 확인 사항 (전환 시 회귀 위험)

| 항목 | 사실 | 영향 |
| --- | --- | --- |
| `src/keystatic/libs/runtime.ts` | `shouldHideDraftContent = NODE_ENV !== "development" && !preview` | **개발 모드에서는 공개 경로에 초안이 보인다.** DB repository는 NODE_ENV와 무관하게 초안을 반환하지 않아야 한다 |
| `posts/[slug]`의 `dynamicParams = false` | 목록에 없는 slug는 렌더 시도 없이 404 | 요청 시 조회로 바꾸면 `dynamicParams = true` + 명시적 `notFound()`가 필요 |
| `generateStaticParams` | 빌드 시 전체 slug 목록을 요구 | DB 조회로 바꾸면 빌드가 DB에 접속하게 된다. **빌드 무DB 원칙(M6에서 확인)과 충돌** → 제거 대상 |
| OG 이미지 4종 중 2종 | `generateImageMetadata` + `Image`가 `getPost`/`getMemo` 호출 | 비공개 slug의 OG가 생성되지 않도록 함께 동적화 |

### 2.2 빌드 무DB 원칙과의 상호작용

M6는 "build가 운영 DB에 접촉하지 않음"을 확인했다(79 routes). M7-BE-2에서 `generateStaticParams`가 남아 있으면 빌드가 DB를 읽어 이 성질이 깨진다. 따라서:

- 상세 페이지: `generateStaticParams` 제거(전부 요청 시 조회)
- 목록·sitemap·RSS: 동적화
- `pnpm build`는 `.env.local` 없이도 통과해야 한다(DB·Keystatic 자격증명 비의존). 단 현재 빌드는 Keystatic GitHub 모드 env를 요구하므로 이 성질은 **배치 9(Keystatic 제거) 이후에만 성립**한다. M7 기간에는 빌드 게이트에 `.env.local`이 필요하다.

## 3. 검토한 선택지

| 안 | 내용 | 즉시성 | 비용/위험 | 판정 |
| --- | --- | --- | --- | --- |
| S1 | 공개 경로 전부 `force-dynamic`(요청 시 조회), 캐시 없음 | 발행/보관 즉시 반영 | 요청마다 DB 조회. Neon cold start 시 TTFB 악화 | **권고** |
| S2 | 시간 기반 `revalidate = N` | 최대 N초 지연 | 보관 후 N초간 주소·피드 잔존 → 종료 조건 위반 | 기각 |
| S3 | 태그 기반 `cacheTag`/`revalidateTag` + 발행 훅 | 즉시 반영 | M3-BE-1 발행·보관·예약 경로에 무효화 훅 추가 → 범위 확대, 훅 누락 시 stale | v2 |
| S4 | `unstable_cache`로 repository만 캐시 | 데이터 계층에서 지연 | 동일한 stale 문제를 위치만 옮겨 재발 | 기각 |

기각 근거는 모두 동일하다: **M7 종료 조건이 "보관 즉시 404·목록/피드 제외"이므로 캐시 TTL이 존재하는 한 조건을 만족할 수 없다.**

## 4. 캐시 선언 원칙 (S1 채택 시)

1. 공개 조회를 하는 모든 서버 파일에 `export const dynamic = "force-dynamic"`을 **명시**한다. 프레임워크 기본값에 의존하지 않는다.
2. `generateStaticParams`와 `dynamicParams = false`를 공개 상세 경로에서 제거한다.
3. `fetch` 캐시에 기대지 않는다(DB 조회이므로 해당 없음).
4. 페이지 내 `notFound()`는 **비공개·미존재에만** 쓴다. DB 오류는 5xx로 전파한다(O1 A3).
5. `dynamic = "force-dynamic"`은 레이아웃에 두지 않고 **조회를 수행하는 파일에** 둔다(레이아웃에 두면 하위 전체가 묶여 의도가 흐려진다). `(blog)/(content)/preview/layout.tsx`는 기존대로 유지.

## 5. 성능 영향과 대응

| 영향 | 측정 시점 | 대응 |
| --- | --- | --- |
| 요청마다 DB 왕복(목록 2회 + 태그/카테고리) | 배치 2 후 `pnpm build` + 실제 요청 지연 | 공개 조회 쿼리를 1왕복으로 묶는다(목록+tags/categories 동시 조회). 인덱스는 공개 조회 컬럼 기준으로 확인 |
| OG 이미지 4종 중 2종이 매 요청 생성 | 배치 2 | 비공개는 즉시 404로 조기 반환. 렌더 자체는 기존 `og.tsx` 재사용 |
| Neon cold start | 배치 2 | 비차단으로 기록. A1 권고 유지(정확성 우선). 악화 시 O1 트리거 2로 재자문 |

## 6. 미해결/확인 필요

| # | 항목 | 처리 |
| --- | --- | --- |
| 1 | 빌드 산출물의 static/dynamic 라우트 표(증거) | 미확보. `pnpm build`가 `.env.local`(Keystatic GitHub 모드 env)을 요구해 보류. **env 확보 후 배치 2 착수 전에 기록** |
| 2 | 목록 페이지의 실제 요청 지연 수치 | 배치 2 완료 후 측정 |
| 3 | `llms.txt`를 repository 기반으로 동적화할지 | 현행 정적 파일 유지(범위 밖). 필요 시 v2 |

## 7. 최종 결정 (O1 반영, 2026-09-22)

| 안건 | 결정 |
| --- | --- |
| A1 캐시 전략 | **CMS 의존 surface만 동적화**. 목록·상세·RSS·sitemap·slug별 OG는 `force-dynamic`/`no-store`. 내용이 고정된 목록 OG 2종(`posts/opengraph-image.tsx`, `memos/opengraph-image.tsx`)은 정적 유지. 보관 완료 후 **다음 요청부터** 404·제외. 태그 무효화는 v2 |
| A1 이력(M7-RV-1) | **위반 1건 발견·수정.** `@vercel/og`가 프로덕션에서 `public, immutable, no-transform, max-age=31536000`을 기본으로 심어 슬러그 OG가 A1을 어겼다(`og.tsx`가 `headers`를 넘기지 않았다). `createOgImageResponse(title, { noStore })`로 `cache-control: no-store`를 소문자 키로 덮고, 슬러그 OG 2종만 이 옵션을 쓴다. `src/libs/contents/__test__/og.test.ts`가 덮어쓰기와 기본값 유지를 고정한다. **교훈:** 프레임워크·라이브러리 기본 헤더에 기대지 않는다는 원칙 4는 우리 코드뿐 아니라 **의존 라이브러리가 심는 기본값에도** 적용해야 한다 |
| A2 repository 교체 방식 | 서버 전용 `CMS_PUBLIC_REPOSITORY=keystatic\|postgres` 명시 선택. **기본값은 승인 전까지 `keystatic`**. 알 수 없는 값은 조용히 대체하지 않고 시작 시 실패 |
| A3 DB 오류 표현 | repository에서 그대로 throw → 5xx. `notFound()`는 정상 조회가 `not_found`일 때만. 상세 페이지의 `force-static`·`dynamicParams=false`·`generateStaticParams`는 배치 2에서 전부 제거 |

추가로 O1이 확정한 사항(§3 선택지에 반영):

- 공개 판독 기준은 `entries.status='published'` + `entry_bodies.state='published'` 존재 + current 주소 존재. archived/trashed/draft, reservation/deleted, published body 없는 불일치는 모두 제외
- alias는 canonical current slug를 반환하고 별도 판별값으로 알린다. alias 대상이 비공개이거나 current 주소가 없으면 308이 아니라 404
- 공개 metadata는 published body에서만 읽는다(working metadata 직접 조회 금지)
