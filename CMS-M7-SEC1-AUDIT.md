# CMS M7 SEC-1 보안 점검 (배치 7)

- 작성일: 2026-09-22 · 작성: Lead
- 대상: `feature/M7` @ 배치 1–6 + `af...`(auth 수정 커밋)
- **성격: Lead 자가 점검 — 독립 검수가 아니다.** 배치 7의 산출물 요건은 “독립 보고서”인데 리뷰어 레인이 장애다(`CMS-M7-DEV-PLAN.md` §9.10). 이 문서는 **점검 범위·증거·수정 이력을 고정해 독립 검수의 입력으로 쓰기 위한 것**이며, 배치 7을 완료로 표시하지 않는다.
- 범위: M7이 새로 만든 공개·미리보기 표면 + 관리자 라우트 인증 회귀. 운영 배포·인프라(R2 자격증명, DB 접속 통제)는 범위 밖.
- 방법: 정적 전수 점검(스크립트), 기존 계약 테스트, 타입·빌드 게이트. **침투 테스트·실DB·브라우저·부하 테스트는 미실행.**

---

## 1. 완료 조건 판정

| SEC-1 조건 | 판정 | 근거 |
| --- | --- | --- |
| 비로그인·타 계정 쓰기 차단 | **충족(정적 증거)** | 관리자 쓰기 라우트 17곳 전부 `verifyAdmin()` + `validateSameOrigin()`. 예외는 스케줄러 1곳뿐이며 Bearer 토큰으로 인가 |
| 실행기 토큰의 쓰기 차단 | **충족** | 스케줄러 2곳이 길이 선검사 + `timingSafeEqual`, 실패 시 403. 토큰 미설정이면 무조건 false(fail-closed) |
| 검증 안 된 MDX가 실행 컴파일러로 진입 | **조건부 충족** | `content-service.ts:225`가 저장 전 `analyze()`로 거부. 공개 렌더는 저장된 body만 컴파일. 단 MDX는 본질적으로 실행 형식이며 out-of-band SQL 삽입은 코드로 막을 수 없다(§4 F4) |
| 공개 응답 초안 0건 | **충족(단위 증거)** | `toPublicPost`/`toPublicMemo`가 `status !== "published"`에서 null, 라우트가 404. 실DB 관통 증거는 없음(env 부재) |

---

## 2. 인증·CSRF 전수 점검 (재현 가능)

```
for f in $(find src/app/api/cms/v1 -name 'route.ts'); do ... verifyAdmin / validateSameOrigin 카운트
```

| 구분 | 파일 수 | 결과 |
| --- | --- | --- |
| 관리자 쓰기 라우트(POST/PATCH/PUT/DELETE) | 17 | **17/17 `verifyAdmin` + `validateSameOrigin`** |
| 스케줄러 쓰기 라우트 | 1 | Bearer 토큰 + `timingSafeEqual` + 길이 선검사 → 403 |
| 공개 라우트(`/public/**`) | 2 | 인증 없음이 의도. 초안 fail-closed. `Cache-Control: no-store` |

`validateSameOrigin`(`src/app/api/cms/v1/security.ts`)은 **fail-closed**다. `origin` → `sec-fetch-site` → `referer` 순으로 판정하고, 아무 신호도 없거나 host가 다르면 403이며, body 있는 메서드에 `application/json`을 요구한다.

`verifyAdmin`(`src/cms/adapters/auth/auth-gateway.ts`)은 세션 없으면 401, 허용 목록(`CMS_ADMIN_GITHUB_ID`) 밖이면 403, GitHub ID는 `/^\d+$/` 정규화 후 `BigInt` 비교다. 개발 우회는 `NODE_ENV=development && CMS_DEV_AUTH_BYPASS=1`일 때만 성립하고 production에서는 플래그가 있어도 무시된다(fail-closed).

---

## 3. M7 신규 표면 점검

| 표면 | 확인 내용 | 결과 |
| --- | --- | --- |
| 공개 상세 2종 | 초안·보관·휴지통 404, 과거 주소 308, DB 오류 5xx(404 위장 없음) | 코드·단위 테스트로 확인 |
| 목록·랜딩·RSS·sitemap | `force-static` 0건, 전부 요청 시 조회, RSS `no-store` | 확인. CDN 헤더는 미확인 |
| slug OG 2종 | 404를 `Image()`에서만 throw(빌드 수집 단계 예외) | 확인(`6dc7306`) |
| SEO head | `canonicalUrl`은 `/...` 또는 http(s)만 통과(`javascript:`/`data:`/`ftp:`/`//host` → null) | `seo.ts` + 테스트 8건 |
| `/public/entries` 2종 | 세션 없이 동작, 관리자 필드는 타입 수준 부재, 초안 fail-closed, 오류 400/404/503만, 내부 메시지 비노출, `pageSize ≤ 100` | 계약 테스트 20건 |
| 미리보기 3종 | `/preview/start`(세션 확인 **후** `draftMode().enable()`), `layout.tsx`(`notFound()`), 서비스 2종(`canPreview()`); 쓰기 0건 | 테스트 17건 |
| `preview/start` 리다이렉트 | `to`를 파싱해 **같은 origin만** 허용 → 오픈 리다이렉트 차단 | 확인 |

---

## 4. 지적

| # | 등급 | 내용 | 처리 |
| --- | --- | --- | --- |
| F1 | **P2** | `NextAuthGateway.authorizeExecutor`가 `timingSafeEqual`이 아니라 `===`로 토큰을 비교했다. 라우트 2곳의 구현과 불일치 | **수정**: 길이 선검사 + `timingSafeEqual` + try/catch → false. 테스트 4케이스 추가(다른 길이·같은 길이 오타·공백 trim·토큰 미설정) |
| F2 | **P2** | `/preview/start`가 **상태를 바꾸는 GET**이다(`draftMode` 활성 + `ks-branch` 쿠키 설정). `branch` 파라미터는 무검증 | 위험 낮음: SameSite=Lax 쿠키는 교차 사이트 서브리소스 요청에 실리지 않고, 리다이렉트 대상도 같은 origin으로 제한된다. 영향은 “관리자 자신의 브라우저에서 미리보기 모드가 켜짐”뿐이다. **미수정**(Keystatic 경로라 배치 9 대상) · 권고: POST 전환 + `branch`를 `^[\w./-]+$`로 제한 |
| F3 | **P2** | 공개 API에 레이트 리밋이 없고 `no-store`라 CDN 캐시도 없다. 무인증 대량 조회가 DB 부하로 직결 | M7 범위 밖 · 운영 후속. `pageSize` 상한 100이 최소 방어 |
| F4 | 정보 | **MDX는 실행 형식이다.** 공개 렌더러는 `compileMDX`(next-mdx-remote/rsc, `mdx-content.tsx:86`)라 expressions가 서버에서 평가된다. 즉 관리자 권한은 서버 코드 실행 권한과 같다 | M7 이전 Keystatic과 동일하며 **M7이 만든 권한 상승이 아니다**. 완화: 쓰기 경계 `content-service.ts:225`의 `analyze()` 거부, 2MiB 상한, 관리자 세션 전용, `rehype-raw` 미사용(원시 HTML 통과 없음). 남는 우회는 out-of-band SQL 삽입 → 운영 통제 |
| F5 | 정보 | 보안 헤더(CSP·HSTS·`X-Frame-Options`) 설정이 없다(`next.config.ts`에 `headers` 없음, middleware 없음) | 전환 후 후속. 현재 XSS 방어는 React 이스케이프와 MDX 파이프라인에 의존 |
| F6 | P3 | `authorizeExecutor`는 프로덕션 호출자가 없다(라우트 2곳이 자체 구현). 죽은 표면 | M8 정리 후보. F1 수정으로 보안 문제는 해소 |
| F7 | P3 | 공개 API가 `body`로 MDX **원문**을 내보낸다 | 의도된 계약(§10.1). 소비자가 그대로 실행하면 소비자 책임이므로 문서에 명시 필요 |

**P0/P1 없음.**

---

## 5. 독립 확인이 필요하거나 미검증인 항목

1. 실DB에서 초안·보관·휴지통이 HTML·RSS·sitemap·OG·`/public/entries` 어디에도 없는지 **관통 관찰**(env 부재로 미실행).
2. DB 장애 주입 시 공개 라우트가 404가 아니라 5xx인지 실제 응답으로 확인.
3. 별칭 308·slug 변경 후 기존 주소 동작을 브라우저/`curl`로 확인.
4. SEO head 실측(`curl`로 canonical·OG 태그 대조).
5. 관리자 세션 위조 시도(만료 쿠키·타 계정 GitHub ID)에 대한 실제 거부 응답.
6. 위 F1 수정이 독립적으로 검토됐는지 — 자가 점검이므로 독립 검수 필수.
7. `next-auth` 5.0.0-beta.32 자체의 취약점·설정(Cookie `SameSite`, 세션 수명) 검토는 이번 범위 밖이다.

---

## 6. 수정 내역

| 커밋 | 내용 |
| --- | --- |
| (본 커밋) | `auth-gateway.ts` 타이밍 안전 비교 + 테스트 4케이스 / 이 문서 |
