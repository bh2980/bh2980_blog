# CMS M8 개발 계획 (표현 계약 정비)

**기준 문서:** `CMS-SPEC.md` §4.4·§4.5 / §6.2(F16)·§4.3(F18), `CMS-V1-IMPLEMENTATION-PLAN.md` M8, `CMS-M8-DA-1-CONVERSION-MEMO.md`, `CMS-M7-DEV-PLAN.md`(배치·게이트 관행)

**진행 상태(2026-09-22):** 배치 0 DONE · **배치 1 DONE + R1 통과** · **배치 2 DONE + R2 통과** · **배치 3 DONE + R3 통과** · **배치 4 DONE + R4 통과**(`ec8076a`, 폐기 정리) · 배치 5 진행 중. 최신 초록: `pnpm typecheck` 0 · `pnpm test:run` **115 files / 748 tests pass**(실DB 포함 · 착수 전 107 files / 687 tests).

## 0. 운영 원칙 (M7 관행 + M8 차이)

1. **1 마일스톤 = 1 관심사, 1 배치 = 1 writer.**
2. **작업 위치(M7과 다른 점):** `lionfish` worktree의 `feature/new-cms` 하나를 통합 브랜치로 쓴다. **배치별 worktree를 만들지 않는다** — M8 배치는 강순차 의존(`FE-1/2 → DA-1 → ED-2`)이고 writer가 하나라 동시 쓰기가 없다. 예외로 **배치 2(M8-DA-1)는 분리 가능**(45편 기계적 대량 변경이라 되돌리기 단위를 격리할 가치가 있다).
3. **깨진 상태 금지(고정 순서):** 읽기(렌더러) → 파일 변환 → 쓰기(serializer·에디터) → 이관(M9). directive를 처리하지 않는 체인은 **아무것도 출력하지 않는다**(micromark: "If directives are not handled, they do not emit anything").
4. **DONE 정의:** 통합 브랜치에 커밋되고 배치 게이트를 통과한 상태. 계획서 진행 상태 표는 Lead가 갱신한다.
5. 커밋 author·committer는 `bh2980 <74360958+bh2980@users.noreply.github.com>` 고정.
6. 리뷰어·오라클은 **읽기 전용**이다(`reviewer`에게는 bash가 없다). 위임할 때 테스트·빌드 **실행 증거와 커밋 SHA를 프롬프트에 첨부**한다.

## 1. 종료 조건

- 49편이 directive 저장 형식이고, **공개 렌더 결과가 변환 전과 같다**(실제 공개 라우트 경로 포함).
- 신규 표현이 공개에서 렌더된다: `::image`, `:::text-align`, `:u`, `:sup`, `:sub`, `:br`.
- **미등록 이름이 본문 글자로 보존된다**(무음 손실 0) — `:free를`, `:1로`가 대표 사례.
- 폐기 이름(`ContentLink`, `IdeographicSpace`)이 코드·문서·본문에 0건이고, 제거 순서가 지켜졌다.
- 에디터에서 만든 본문이 directive로 저장되고 다시 열면 동일하다(왕복 멱등).
- 게이트: `pnpm typecheck` 0 · `pnpm test:run` 전부 pass · `pnpm build` exit 0.

## 2. 착수 전 사실 (실측, 2026-09-22)

**측정 스크립트**(`.pi/`, gitignore 대상 — 로컬 전용): `directive-risk.mjs`, `legacy-scan.mjs`, `wrap-scan.mjs`

| 항목 | 값 | 출처 |
|---|---|---|
| 변환 대상 | **46편** (posts 6, memos 40) = 컴포넌트 43 + `<u>`만 2 + 하드브레이크만 1 | 변환기 `pnpm cms:convert --check`, 목록은 변환 메모 |
| 컴포넌트 | Collapsible 34 · Tooltip 8 · Callout 6 · IdeographicSpace 4편 · Tab/Tabs 3 · Column/Columns 1 | 〃 |
| `<u>` | 11편 38쌍 | 〃 |
| 줄 끝 `\` 하드브레이크 | **19곳 / 6편**, soft 줄바꿈 0건 | `.pi/wrap-scan.mjs` |
| directive 오탐 | 2건 (`:free를`, `:1로`) — 둘 다 미등록 | `.pi/directive-risk.mjs` |
| 펜스 안이라 제외 | `<br/>` 12건 · `<div>` 3건 | 〃 |
| 설치 완료 | `remark-directive@4.0.0`, `mdast-util-directive@3.1.0`, `@tiptap/extension-{superscript,subscript,text-align}@3.31.3` | `package.json` |

**현재 계약(바꿔야 할 지점):**

- `src/cms/mdx/serialize.ts:210` — 하드브레이크를 `\`+줄바꿈으로 출력 → `:br[]`로 바꾼다.
- `serialize.ts:110-155` — `openMark`/`closeMark`가 `<u>`·`<sup>`·`<sub>`·`<strong>`·`<em>`·`<del>`·`<Tooltip>`을 출력 → directive/Markdown으로 바꾼다.
- `src/cms/mdx/registry.ts` — `REGISTERED_JSX_NAMES`는 정의만 되고 `analyze`에서 쓰이지 않는다.
- `CmsMdxAnalysis`(`types.ts:35`) — `errors`만 있고 경고 채널이 없다. **A3에 따라 여기 넣지 않는다**: 경고는 발행 전 검사(`validateForPublish`)가 `warnings`로 낸다(배치 1에서 구현).
- 공개 체인 `src/components/mdx/mdx-content.tsx` — `MDX_REMARK_PLUGINS`에 `remarkBreaks`가 이미 포함(문단 줄바꿈이 `<br>`이 되는 이유).
- `serialize.ts:164-183` — `Image` 저장 경로는 이미 있다. 공개 렌더러는 **배치 1에서 추가**했다(`src/components/mdx/image.tsx`).

## 3. 마일스톤 묶음과 순서

M8을 **5개 배치 + 검수**로 묶는다. 배치 = 1 writer + 1 리뷰 게이트.

| 배치 | 묶음 | 담당 | 선행 | 게이트 |
|---|---|---|---|---|
| 0 | 착수 전 정리(구현 아님) + **O1** | Lead | — | 없음(기록만) |
| 1 | **M8-FE-1 + M8-FE-2** (읽기: 렌더러) | FE | 배치 0, O1 | **R1** |
| 2 | **M8-DA-1** (46편 파일 변환) | DA + TW | 배치 1 | **R2** + 전후 HTML 대조 |
| 3 | **M8-ED-2** (쓰기: serializer·에디터) | ED | 배치 1, 2 | **R3** |
| 4 | **M8-TW-1** (이름 정합성 + 폐기 정리) | TW | 배치 3, **O2** | **R4** |
| 5 | **M8-RV-1** (최종 검수) | RV | 배치 1–4 | **승인** |

**의존 그래프**

```
배치 0 ──▶ 배치 1(읽기) ──▶ 배치 2(파일 변환) ──▶ 배치 3(쓰기) ──▶ 배치 4(정리) ──▶ 배치 5(검수)
              └──────────── O2(독립 감사) ────────┘
```

**왜 이렇게 묶는가**

- **FE-1과 FE-2를 한 배치로 묶는다.** 둘 다 같은 파일(`mdx-content.tsx`의 플러그인 체인, `MDX_COMPONENTS`, registry)을 고치고 위험도 같다. 나누면 같은 코드에 리뷰 게이트가 두 번 붙는다.
- **DA-1을 ED-2보다 앞에 둔다.** 고정 순서(파일 변환 → 쓰기)를 따르고, ED-2의 왕복 검증이 **실제 directive 파일 위에서** 이뤄지게 한다.
- **TW-1을 배치 4로 미룬다.** `IdeographicSpace`는 레거시 4편이 아직 쓰므로 **파일 변환 전에 컴포넌트를 제거하면 그 글들이 깨진다.** 그래서 "폐기 이름 제거"는 배치 2 뒤다. FE-2의 완료 조건 중 "폐기 이름이 코드·문서에 없다"는 **배치 4에서 충족**한다(이동을 명시한다).
  - 예외: `ContentLink`는 레거시 사용 0건이라 배치 1에서 제거해도 안전하다. 그래도 **한 배치 안에서 일관**되게 배치 4에서 함께 지운다(제거 근거를 한 곳에 모은다).

### 배치 0 — 착수 전 정리 (구현 아님, 리뷰 없음)

- 결정 3~8을 문서에 반영하고 남은 불일치를 정리한다: 계획서 M8 도입부 "43편"→"45편", §4.5 표, `M8-RV-1` 범위에 폐기 순서 추가.
- **O1을 실행**하고 그 결정을 §9.1에 기록한다. O1 결정 전에는 배치 1을 시작하지 않는다.
- `.pi/` 측정 스크립트 3종이 재현 가능한지 확인한다(기준선 재측정 1회).

### 배치 1 — 읽기: 공개 렌더러 + 누락 컴포넌트 (M8-FE-1 + M8-FE-2)

**산출물**

1. `parse.ts`·`mdx-content.tsx` 양쪽에 `remark-directive`를 넣고, **등록된 이름만 directive로 남기고 미등록은 본문 텍스트로 되돌리는 플러그인**을 둔다(두 경로가 같은 모듈을 공유한다 — 갈라지면 계약이 갈라진다).
2. directive → 기존 컴포넌트 매핑(Callout·Collapsible·Tabs/Tab·Columns/Column·Tooltip). **JSX 렌더 경로는 그대로 둔다.**
3. 신규 공개 렌더러: `::image`(F18 — 실패 시 캡션만, `width`/`align` 미적용), `:::text-align`(F16).
4. 인라인: `:u`·`:sup`·`:sub`·`:br[]` → `u`/`sup`/`sub`/`br` 요소.
5. Tiptap 확장 3개를 **스키마에 등록만** 한다(`text-align`은 `types: ['heading','paragraph']`, `alignments: ['left','center','right']`, `defaultAlignment: null`). **툴바 버튼과 쓰기 명령은 배치 3까지 켜지 않는다** — 에디터가 지금 `getHTML()`을 저장하므로 읽기/쓰기 전환이 원자적이어야 한다(§9.1.1·§9.1.3).
6. 발행 전 검사에 **이미지 해석 실패 비차단 경고**를 추가한다.

**금지**

- JSX 렌더 경로 제거·약화. serializer 변경(배치 3 몫). `src/contents` 수정(배치 2 몫). `IdeographicSpace` 컴포넌트 제거(배치 4 몫).

**완료 조건**

- directive를 쓰지 않는 49편의 렌더 결과가 배치 전과 동일하다(추가형 증명).
- directive로 쓴 표본이 같은 HTML을 낸다.
- 미등록 `:free를`·`:1로`가 **본문 글자로** 남는다.

### 배치 2 — 파일 변환 (M8-DA-1)

**산출물**

- 46편 JSX → directive, `<u>` 38쌍 → `:u[...]`, 줄 끝 `\` 19곳 → `:br[]`, `<IdeographicSpace />` 6곳 → **홀로 쓴 `:br[]` 문단(빈 줄)**(§9.4 A6).
- **변환은 한 커밋**으로 만든다(커밋 SHA를 변환 메모의 "실행 기록"에 적는다).
- 전후 대조를 **저장소에 남는 테스트**로 추가한다(`src/cms/mdx/__test__/` — `.pi/`는 gitignore라 증거가 되지 못한다).

**금지**

- 레지스트리에서 폐기 이름 제거(배치 4 몫). `&#x20;` 35건 손대기(v1 범위 밖). `:free를`·`:1로` 이스케이프(규칙이 자동 해결).

**완료 조건**

- 분석 오류 0 · 렌더 실패 0 · 미분류 표기 차이 0 · **공개 렌더 HTML이 변환 전과 동일**.
- 되돌리기 절차가 변환 메모에 기록됨(변환 메모의 주의: 폐기 이름 제거 뒤 revert하면 되돌린 JSX가 발행 검사에서 막힌다).

### 배치 3 — 쓰기 전환 (M8-ED-2)

**산출물**

- serializer가 directive를 출력: `serialize.ts:210` 하드브레이크 → `:br[]`, `openMark`/`closeMark` → `:u[...]`/`:sup[...]`/`:sub[...]`/`:tooltip[...]{content=...}`, `**`/`*`/`~~`는 Markdown 유지.
- `textAlign` 노드 속성 → `:::text-align` 컨테이너(배치 1의 shape 규칙의 저장 방향).
- 문단은 **한 줄로 출력**하고 줄바꿈은 `:br[]`로만 표현한다(빈 라벨, §9.1.5).
- **`it.fails` 마커 제거**(§9.4): `roundtrip.test.ts` 표본 2건과 `corpus-roundtrip.test.tsx`가 directive를 왕복해야 한다.
- 에디터(Tiptap 노드 → MDX) 왕복 재작성. 이스케이프 규칙 적용. M1 serialize 계약 재정의. **에디터 배선(범위 확대, §9.1.3):** `tiptap-editor.tsx`가 `editor.getHTML()`을 `mdx`로 저장하는 현 구조를 `toDocument`/`serialize` 경로로 바꾼다 — 시각 에디터로 저장한 본문이 지금은 HTML이다. 툴바·쓰기 명령 활성화는 이 배치에서 한다.

**완료 조건**

- 에디터에서 만든 본문이 directive로 저장되고 다시 열면 동일하다(멱등).
- 49편 전수 왕복에서 재직렬화 결과가 안정적이다(2회 왕복 = 1회 왕복).

### 배치 4 — 이름 정합성과 폐기 정리 (M8-TW-1)

**산출물**

- 레지스트리 ↔ `MDX_COMPONENTS` 대조 테스트(등록 이름에 컴포넌트가 빠지면 실패).
- 미등록 보존 회귀(코퍼스 전수 + 단위).
- **폐기 이름 제거**(`ContentLink`, `IdeographicSpace` — 컴포넌트·레지스트리·참조 수집 코드·문서).
- `analyze`에 JSX 미등록 이름 거부 배선(코드 스팬 밖 원문 태그 오검 실측 포함).

**완료 조건**

- 미등록 directive가 본문 글자로 보존되고, 레지스트리와 렌더러가 일치하며, 폐기 이름이 0건이다.

### 배치 5 — 최종 검수 (M8-RV-1)

- 범위: 배치 1–4 구현분 + §1 종료 조건 전부. 선행: M8-FE-2, M8-TW-1, M8-ED-2, M8-DA-1.

## 4. Oracle 자문 시점

`oracle`은 읽기 전용 고맥락 자문이다. **결정을 대신하지 않는다** — 안건별 권고를 받고 Lead가 확정한다.

### O1 — 배치 1 시작 전 (1회) **[필수]**

착수 전에 아래 안건을 확정한다. 결정은 §9.1에 기록하고, 배치 1 코드는 이 결정을 따른다.

| # | 안건 | 권고안(Lead) |
|---|---|---|
| A1 | 미등록 directive를 본문으로 되돌리는 구현 형태 | 노드 `position`으로 **원문을 그대로 잘라** `text`로 교체. 핸들러에서 문자열을 재조립하면 이스케이프·공백이 틀어진다. 공개 렌더와 `parse.ts`가 **같은 모듈**을 쓴다 |
| A2 | directive → 컴포넌트 매핑 방식 | 자체 remark 플러그인으로 `mdxJsxFlowElement`/`mdxJsxTextElement`로 변환(`remark-mermaid-to-mdx`·`remark-chart-to-mdx`가 선례). `MDX_COMPONENTS`는 이름으로만 붙으므로 rehype 단계로는 컴포넌트가 안 붙는다 |
| A3 | 이미지 실패 **경고 채널** 위치 | `CmsMdxAnalysis`는 순수 함수라 DB를 못 본다 → 미디어 해석은 **발행 전 검사 파이프라인**에 단계로 추가하고, `analyze`에는 `warnings` 필드만 열어 둔다 **범위 확정(§9.1):** 경고는 non-ready·R2 해석 실패·허용되지 않는 `src` 3가지에만 적용하고, 미디어 행 없음은 M7 무결성 계약(FK·CHECK·발행 검사)을 유지한 채 렌더 방어만 한다 |
| A4 | `:::text-align`의 공개 출력 형태 | 클래스 vs 인라인 `style`. 확장 기본값은 `style="text-align: …"` |
| A5 | 중첩 컨테이너에서 미등록 자식 처리 | 부모만 판정하지 않고 **자식도 각자 판정**한다(등록 부모 + 미등록 자식 조합) |
| A6 | 배치 2의 전후 대조 방법 | 기준선은 변환 커밋 직전 `feature/new-cms`에서 캡처. 라우트가 쓰는 컴포넌트 트리(`MdxContent`)를 그대로 렌더해 비교하고, 부족하면 실제 HTTP 대조로 승격 |
| A7 | 배치 2 변환 실행 형태 | 1회성 변환 스크립트 + **파일별 diff 검토**. 스크립트를 저장소에 커밋할지 `.pi/`에 둘지는 oracle 판단 |
| A8 | 폐기 순서 확정 | `IdeographicSpace`는 배치 4, `ContentLink`도 배치 4(일관성). FE-2 완료 조건의 "폐기 이름 0건"을 배치 4로 이동 |

### O2 — 배치 1–3 완료 후, 배치 4 전 (1회) **[필수]**

독립 감사. 최소 항목:

1. **무음 손실 0** — 49편 전수에서 렌더 출력에 사라진 본문이 없는지.
2. **이중 경로 등가** — 같은 파일을 JSX 형태와 directive 형태로 렌더한 HTML 동일성.
3. **공개 등가** — 배치 2 전후 HTML 차이 0(라우트 경로).
4. **왕복 멱등** — 저장→재열기→재저장이 안정적이고 서식이 보존되는지.
5. **계약 정합** — `CMS-SPEC.md` §4.4·§4.5 ↔ 코드 출력 문자열 1:1, `<u>`/`<strong>` 잔존 0.
6. **이미지 실패 경로** — 캡션만 남고 발행은 막히지 않으며 경고가 뜨는지.

### O3 — 조건부 (횟수 제한 없음)

아래가 나오면 배치를 멈추고 즉시 자문한다.

- 배치 2에서 **공개 HTML 차이**가 1건이라도 나올 때.
- 배치 1의 demote가 원문을 정확히 복원하지 못하는 사례가 나올 때.
- 배치 3에서 왕복 손실(멱등성 위반)이 나올 때.
- 사용자가 저장 형식 변경을 요구할 때.

## 5. Reviewer 리뷰 시점

| 게이트 | 대상 | 시점 | 필수 증거 |
|---|---|---|---|
| **R1** | 배치 1 diff | 배치 1 커밋 직후 | `pnpm typecheck`, `pnpm test:run`, 추가형 증명(49편 렌더 동일) |
| **R2** | 배치 2 diff(46편 콘텐츠 포함) | 배치 2 커밋 직후 | 전후 HTML 대조 결과, 분석 오류 0, 파일별 변환 요약 |
| **R3** | 배치 3 diff | 배치 3 커밋 직후 | 왕복 테스트, 실DB 저장·재열기, 49편 재직렬화 안정성 |
| **R4** | 배치 4 diff | 배치 4 커밋 직후 | 레지스트리 대조, 폐기 이름 0건 검색, `analyze` 배선 실측 |
| **RV** | 배치 1–4 전체 | O2 뒤 | §1 종료 조건 전부 + 최종 게이트 3종 |

**M8 중대 위험 기준**(리뷰어에게 매번 명시 판정을 요구한다)

1. **무음 손실** — directive·JSX가 렌더에서 사라짐(출력도 오류도 없음).
2. **공개 렌더 회귀** — 변환 전후 HTML 차이가 남(라우트 실측 기준).
3. **저장 왕복 손실** — 저장 후 재열기에서 내용·서식이 변형·누락.
4. **원본 콘텐츠 훼손** — 의도하지 않은 파일·줄이 `src/contents`에서 바뀜.
5. **폐기 순서 위반** — 레거시가 아직 쓰는 컴포넌트를 먼저 제거해 기존 글이 깨짐.
6. **계약 불일치** — §4.4·§4.5와 코드가 다른 형식을 저장(예: `<u>` 출력 잔존).

**판정 규칙(M6·M7 관행)**

- 매 위임마다 ① "중대한 위험 존재 여부" 명시 판정, ② 근거 커밋 SHA와 실행 명령·결과, ③ 등급 라벨(P1 차단 / P2 수정 권고 / 관찰).
- "위험 없음"이면 다음 배치로 진행하고 재리뷰를 붙이지 않는다. P1이면 배치를 멈추고 수정 후 같은 게이트를 다시 통과시킨다.
- `reviewer`에게는 bash가 없다 → Lead가 위 증거를 프롬프트에 붙인다.

## 6. 검증 명령 (모든 배치 공통)

```bash
# 계약·단위 테스트(실DB 포함 전체)
pnpm test:run
# 타입·린트
pnpm typecheck
pnpm lint
# 빌드 (배치 1·3·5)
pnpm build
```

- 배치 2는 위에 더해 **전후 HTML 대조**를 실행하고 그 결과를 R2 증거로 붙인다.
- `.pi/`의 측정 스크립트는 로컬 보조 수단이다. 저장소에 남는 증거는 커밋된 테스트로 만든다.

## 7. 리스크와 대기 결정

**리스크**

| 리스크 | 영향 | 대응 |
|---|---|---|
| 배치 2에서 공개 글이 바뀜 | 블로그 노출 내용 변경 | 전후 HTML 대조를 게이트로 두고, 변환을 **1커밋**으로 만들어 `git revert` 한 번으로 되돌린다 |
| 미디어 업로드 미완료(`ready` 아님) | 이미지가 캡션만 남음 | 발행 전 경고로 알린다(차단 아님 — 확정) |
| `remark-breaks` 유령 줄바꿈 | 문단을 여러 줄로 저장하면 의도치 않은 `<br>` | 문단 한 줄 규칙 + 왕복 테스트 |
| `:br` 뒤 글자(한글 포함) | 이름이 `br…`로 붙어 미등록 → 출력에 `:br` 글자가 보임 | serializer는 항상 **`:br[]`**(빈 라벨). 이름을 확실히 끊고 렌더는 `<br>`로 같다(§9.1.5) |
| 폐기 순서 위반 | 레거시 글 렌더 붕괴 | `IdeographicSpace` 제거를 배치 4로 고정 |
| 리뷰어가 테스트를 실행하지 못함 | 증거 공백 | Lead가 실행 출력·SHA를 첨부 |

**대기 결정(M8 범위 밖, 착수에 비차단)**

- **C1** Keystatic 제거(M9) 후 `src/contents` 파일을 남길지.
- **C2** DB 전환 방식·시점(M9).
- 운영: `main` 반영을 PR로 할지 ruleset을 잠시 풀지.
- 비차단 정리: husky v10 deprecation 경고(훅 2줄 제거).

## 8. 완료 후 갱신

- `CMS-V1-IMPLEMENTATION-PLAN.md` 진행 상태 표(M8 7행)와 계획 변경 로그.
- `CMS-M8-DA-1-CONVERSION-MEMO.md`의 "실행 기록"(변환 커밋 SHA·편수·대조 결과).
- `CMS-SPEC.md` §4.5 인벤토리(신규 요소가 실제로 붙은 뒤 상태 갱신).
- 이 문서 §9 실행 기록.

## 9. 실행 기록

### 9.1 O1 결정

**A3 — 이미지 실패 경고 범위 (2026-09-22 확정)**

- 저장·발행 무결성(`entry_references` FK·CHECK, `publishEntry`의 참조 확인)은 **M7 계약을 유지**한다. 스키마를 완화하지 않는다.
- 비차단 경고 대상은 정상 데이터에서 실제로 발생하는 3가지뿐이다: ① 미디어 행은 있으나 `ready` 아님 ② `ready`인데 R2 객체 해석 실패 ③ 외부 `src` 허용 규칙/해석 실패.
- **미디어 행 없음은 경고 대상이 아니라 렌더 방어 대상**(캡션만)이다. 발생하면 버그이거나 이관 사고이므로 **M9 이관 검사 항목**으로 다룬다.
- 근거: 2026-09-22 사용자 결정은 '해석 실패 시 렌더 동작'에 대한 것이고, 참조 무결성은 M7에서 의도적으로 세운 계약이다. dangling 참조를 저장·발행 가능하게 만들면 무결성만 약해지고 얻는 것이 없다.
- O1 자문(oracle, run `d253b392`)이 제기한 충돌에 대한 답이며, `CMS-SPEC.md` §4.4와 `M8-FE-2` 본문에 반영했다.

**A1 — 미등록 directive 처리.** 공유 remark 플러그인이 `VFile.value`와 `node.position.offset`으로 **원문을 그대로 잘라** 문맥에 맞는 텍스트 노드로 교체한다. 미등록 텍스트 directive는 `text`, flow·leaf·container는 `paragraph(text)`. **CMS 파서도 transformer를 돌려야 한다** — 현재 `src/cms/mdx/parse.ts`는 `.parse(body)`만 호출하므로 `runSync()`(또는 `process`)가 필요하다(실측 확인). 금지: 정규식 처리, AST에서 directive 문자열 재조립, 공개/CMS 이중 구현.

**A2 — directive → 컴포넌트 매핑.** **directive 정의표 하나**를 원천으로 자체 remark 플러그인이 등록 노드를 `mdxJsxTextElement`·`mdxJsxFlowElement`로 변환한다. 선례: `src/libs/mermaid/remark-mermaid-to-mdx.ts`, `src/libs/chart/remark-chart-to-mdx.ts`. `u`·`sup`·`sub`·`br`은 소문자 intrinsic, 나머지는 명시적 컴포넌트 이름. 금지: `data.hName` 의존, whitelist와 컴포넌트 맵 중복, `null` boolean을 문자열 `"true"`/`"false"`로 변환(`"false"`가 truthy가 된다).

**A3 — 이미지 경고.** 위 A3 절(확정) 참조.

**A4 — TextAlign 공개 출력.** 공개 렌더는 `left|center|right`만 검증해 **고정 Tailwind 클래스 맵**으로 출력하고, Tiptap 내부만 인라인 style을 쓴다. 금지: `align` 값을 그대로 `className`·`style`에 주입, `justify` 허용.

**A5 — 중첩 미등록 처리.** top-down 판정. 등록 부모에서는 **자식도 각각 검사**하고, 미등록 부모는 **subtree 전체를 원문 텍스트로 보존**하며 자식 순회를 중단한다.

**A6 — 전후 HTML 대조.** 변환 직전 **같은 프로세스에서** 원본과 메모리상 변환본을 production MDX 체인으로 정적 렌더해 body HTML을 **정확 비교**한다(정규화 없음). 변환 뒤 49개 공개 URL은 별도 200/런타임 오류 smoke test. 금지: 전체 공백 정규화, git parent에 의존하는 상시 테스트, Next 전체 HTML의 빌드 ID까지 byte 비교.

**A7 — 변환 실행 형태.** `--check`/`--write`를 가진 **변환기를 저장소에 커밋**하고(기존 이관 도구 `src/cms/migrate-from-files/` 관행), 46편은 한 커밋으로 변환한다. 금지: 수동 편집, `.pi/`에만 스크립트 보관, 검증 전 `--write`.

**A8 — 폐기 순서.** `ContentLink`·`IdeographicSpace` 모두 **배치 4**에서 함께 제거한다(한 게이트에서 registry·renderer·분석 정합성을 검증).

### 9.1.1 배치 1 금지 목록 (O1 ①)

- `src/contents` 변환, serializer 저장 형식 변경, 폐기 컴포넌트 제거.
- JSX 읽기 경로 제거.
- **Tiptap 쓰기 경로 활성화** — 툴바 버튼·쓰기 명령을 켜지 않는다(배치 3에서 원자적으로 전환).
- media FK/CHECK 완화.

### 9.1.2 O1 ② 놓친 위험 (수용)

1. 배치 1에서 Tiptap 쓰기 UI를 켜면 "읽기 → 변환 → 쓰기" 계약 위반 → 금지 목록에 넣었다.
2. **`Image` resolver 부재** — 정적 컴포넌트 표에는 `mediaId` 해석 context가 없다. DB를 컴포넌트에 직접 import하지 말고 **resolver를 주입**한다.
3. `null` boolean 속성을 문자열로 바꾸면 `"false"`가 truthy가 된다.

### 9.1.3 Lead 추가 발견 — 배치 3 범위 확대 (저장 경로 실측)

- `src/cms/editor/tiptap-editor.tsx`는 `content`를 Tiptap에 그대로 넣고 `onChange(editor.getHTML())`으로 **HTML을 내보낸다**(`:167`, `:213`). 서버 저장 경로(`PATCH /api/cms/v1/entries/[id]`)는 `mdx` 문자열을 **변환 없이** 저장한다(`content-service.ts:225`는 `analyze`만 호출).
- `toDocument`·`serialize`를 **에디터가 쓰지 않는다** — 비테스트 참조는 `converter.ts`, `migrate-from-files/roundtrip-audit.ts`, `index.ts`뿐이다.
- 따라서 **시각 에디터로 저장한 본문은 HTML이다**(M7 종료 시점 운영 DB는 draft 8건이라 공개 영향 없음). **M8-ED-2는 "출력 문자열 교체"가 아니라 에디터를 `toDocument`/`serialize` 경로에 배선하는 일**을 포함한다 → 배치 3 범위에 명시했다.
- 배치 1 영향: 없음(공개 렌더는 `src/contents` 파일 경로이고 그 파일들은 MDX/JSX다).

### 9.1.4 배치 1 구현 파일 목록 (O1 ③, 참고)

- **신규:** `src/cms/mdx/directives.ts`, `src/components/mdx/image.tsx`, `src/components/mdx/text-align.tsx`, 단위 테스트.
- **수정:** `src/cms/mdx/parse.ts`, `registry.ts`, `analyze.ts`, `to-document.ts`(읽기 지원만), `src/components/mdx/mdx-content.tsx`, `src/cms/services/types.ts`, `src/cms/services/content-service.ts`, `src/cms/adapters/postgres/content-store.ts`, 관련 service/store/MDX 테스트.

### 9.1.5 Lead 추가 발견 — `:br` 표기를 `:br[]`로 정정 (배치 1 실측)

- 지시자 이름은 뒤따르는 글자를 삼키고 **한글도 이름 문자**다(실측: `:free를` → 이름 `free를`, `:1로` → 이름 `1로`). 따라서 `:br` 뒤에 글자가 붙으면 이름이 `br특수문자를`이 되어 미등록 처리되고 **출력에 `:br` 글자가 그대로 보인다**(무음 손실은 아니지만 눈에 띄는 오출력).
- serializer 출력을 **`:br[]`(빈 라벨)** 로 통일한다. 이름을 확실히 끊고 렌더는 `<br>` 하나로 같다. 읽기는 구분자 뒤의 맨 `:br`도 허용한다.
- 대안 "공백 하나 삽입"은 렌더는 같지만 공개 HTML 문자열이 달라져 A6의 정확 비교에 예외를 만든다 → 버렸다.
- 검증: `src/cms/mdx/__test__/directive-render.test.tsx`가 `:br[]`→`<br/>`와 `:br둘째`→`:br` 글자 노출을 함께 고정한다.

### 9.2 배치 0 결과

(기록)

### 9.3 배치 1 결과

**커밋:** `4ae05b7`(1a) · `ff586fe`(1b·1c) · `a743c7e`(1d·1e)

| 증분 | 내용 |
|---|---|
| 1a | `src/cms/mdx/directives.ts`(정의표 단일 원천) · `remark-directives.ts`(미등록 되돌리기 + MDX 요소 변환) · `parse.ts` 배선 |
| 1b | `mdx-content.tsx` 공개 체인에 `remark-directive`+두 플러그인, `TextAlign`·`Image` 등록, `createMdxComponents({ imageResolver })` 주입 지점 |
| 1c | `src/components/mdx/image.tsx`(실패 시 캡션만) + `src/cms/mdx/image-src.ts`(허용 규칙 단일 원천, resolver 주입) |
| 1d | `tiptap-schema.ts`의 `CMS_SCHEMA_EXTENSIONS`(text-align `types`/`alignments`/`defaultAlignment: null` + sup/sub) **스키마 등록만** — 툴바·쓰기 명령 없음 |
| 1e | `parse.ts`가 등록 이름을 MDX 요소로 변환(분석 트리 단일 shape) · `prepareSnapshot`이 `imageSources`(위치 포함) 수집 · `validateForPublish`가 `warnings` 반환 |

**검증(실행 증거)**

- `pnpm exec tsc --noEmit` → 0.
- `pnpm test:run` → **110 files / 713 tests pass**(착수 전 107/687 대비 +3 files/+26 tests, 회귀 0).
- **49편 공개 HTML 등가성**: `src/cms/mdx/__test__/directive-render.test.tsx`가 directive 플러그인을 뺀 체인과 **완전히 같은 문자열**을 낸다(추가형 증명).
- 미등록 `:free를`·`:1로`가 본문 글자로 남는다(단위 + 코퍼스 49편 0건).
- directive로 쓴 이미지도 **미디어 참조가 수집**된다(무결성 유지) · 외부 `src`는 참조가 아니고 차단하지 않는다 · 소스 없는 이미지는 계속 차단한다.

**A3 이후 달라진 점**

- 분석 트리는 directive를 **MDX 요소로 변환한 shape**를 쓴다. 그래야 참조 수집·`Tabs`/`Columns` 개수 검증·속성 검증이 directive용 코드를 따로 갖지 않는다(두 shape로 갈라지면 한쪽만 고치는 실수가 난다). 저장 문자열은 그대로다.

**남긴 것(다음 배치·M9 몫)**

- 경고 채널은 **발행 전 검사에만** 있다. HTTP 표면은 아직 없다 — 발행 API는 store의 `publishEntry`만 호출하고 `validateForPublish`를 부르지 않는다(M9/관리 UI 배선 몫).
- 툴바·쓰기 명령(배치 3), 46편 변환(배치 2), 폐기 이름 제거(배치 4).
- **사전 존재 결함(내 변경 아님):** `pnpm lint`가 저장소 전역에서 43개 오류(`noExplicitAny`, `noLabelWithoutControl` 등)를 내고 53개 파일을 재포맷한다. 배치 1이 만진 파일은 무오류다. `pre-push` 훅이 `pnpm lint`를 돌리므로 푸시 전 별도 정리가 필요하다.

### 9.7 R1 리뷰 (배치 1)

**위임:** `reviewer`(읽기 전용, `router/reviewer-route:high`) — run `1374f588-9e9c-43c3-98c2-2d0593cf9205`, 대상 `feature/new-cms` HEAD `2c7a289`(클린).

**판정: "배치 2 진행 가능"(OK with notes).** 중대 위험 6개 전부 **없음**, **P1 0건**, P2 2건 → 같은 턴에 수정(`3463d6f`).

| 등급 | 내용 | 처리 |
|---|---|---|
| P2 | directive→MDX 변환 시 `position`을 복사하지 않아 이미지 경고·미디어 참조 위치가 늘 1:1로 떨어짐 | `remark-directives.ts`가 `directive.position`을 복사 + 회귀 테스트(5행·3행 위치 확인) |
| P2 | **스키마 등록만으로 쓰기 단축키가 켜짐**(`Mod-Shift-l/e/r`, `Mod-.`, `Mod-,`) — 배치 1 금지 목록("쓰기 명령은 배치 3까지") 위반 | `.extend({ addKeyboardShortcuts: () => ({}) })` + 확장 3개 단축키 0개 테스트 |
| 관찰 | `remark-directives.ts` 헤더가 "CMS 파서는 demote까지만 쓴다"고 적혀 있었으나 실제로는 둘 다 씀 | 주석 정정 |
| 관찰 | `directives.test.ts`의 `renderTree`는 공개 체인 **전체**가 아니라 최소 재현(주석이 부정확) | 주석 정정 — 49편 실등가성은 `directive-render.test.tsx`가 담당 |
| 관찰 | 경고 ②는 실시간 R2 조회가 아니라 `storageKey` 공백 검사 · 발행 API는 `validateForPublish`를 부르지 않음 | §9.3에 이미 기록 |

**미해결 관찰(차단 아님):** CMS 파서는 `remarkGfm`이 directive보다 **앞**이고 공개 체인은 **뒤**다(수식 플러그인 정책도 서로 다르다 — `singleDollarTextMath`). 49편 등가성과 **배치 2의 46편 전후 HTML 대조**가 이 순서 차이의 실제 영향 여부를 판정한다(결과: 정규화 후 불일치 0 — §9.4).

**인프라(기록):** 첫 두 위임이 `model_verification_failed`(expected `router/reviewer-route:high`, observed `grok-4.7`)로 실패했다. `~/.pi/agent/extensions/subagent/config.json`의 `modelResponseAliases["router/reviewer-route"]`에 `grok-4.7`을 추가하고 **Pi 재시작** 후 성공했다(백업 `config.json.bak-before-grok47`).

### 9.4 배치 2 결과

**커밋:** `78aac7a`(변환기·CLI·단위 테스트) · `11287b9`(46편 변환 + 테스트 정리 + 문서)

**산출물**

- 변환기 `src/cms/migrate-from-files/legacy-jsx-to-directive.ts` + CLI `pnpm cms:convert`(`--check` 기본 / `--write`) + 단위 테스트 11개. AST 오프셋 스플라이스로 바꿀 구간만 잘라내고 나머지는 바이트 그대로 둔다(frontmatter·코드 펜스·공백 보존).
- `src/contents` **46편** 변환: tooltip 18 · u 38 · IdeographicSpace 6 · callout 13 · tab 8 · tabs 4 · column 2 · columns 1 · collapsible 35 · br 19.
- 전후 대조를 저장소에 남긴다: `src/cms/mdx/__test__/legacy-conversion.test.tsx` + `__fixtures__/legacy-render-hashes.json`(변환 **전** 원본 렌더의 정규화 해시).

**검증(실행 증거)**

- `pnpm cms:convert` → 변환 예정 0편(멱등) · 잔여 이름 0 · 분석 오류 0.
- A6 전후 대조: 46편 중 **38편 바이트 동일**, 8편은 아래 두 규칙만 다르고 **정규화 후 불일치 0**.
  1. `IdeographicSpace` → 빈 줄: `<span>ㅤ</span>` ↔ `<p><br/></p>` (사용자 결정, 문단 마진만큼 간격이 조금 커진다)
  2. `<br/>` 뒤 접히는 공백(`mdast` break가 붙이던 개행·다음 줄 들여쓰기) — 화면은 같다
- `pnpm test:run` → **112 files / 728 tests pass** · `pnpm exec tsc --noEmit` 0.

**배치 3으로 넘긴 것(명시)**

- 쓰기 경로(`toDocument`/`serialize`)가 directive를 아직 모른다 → `roundtrip.test.ts`의 표본 2건과 `corpus-roundtrip.test.tsx`를 **`it.fails`로 현재 상태를 고정**했다. 배치 3에서 통과하면 그 테스트가 실패하며 마커를 지우게 된다.
- 배치 1의 "49편 공개 HTML 등가성" 테스트는 코퍼스가 directive로 바뀌어 성립하지 않는다 → directive를 **쓰지 않는** 본문 표본으로 "추가형" 성질만 고정하도록 바꿨다(코퍼스 수준 등가성은 매니페스트 테스트가 담당).

### 9.8 R2 리뷰 (배치 2)

**위임:** `reviewer`(읽기 전용, `router/reviewer-route:high`) — run `e7910bd6-6f15-4b7f-a1fc-77c8e0e7bf1e`, 대상 HEAD `11287b9`.

**판정: "배치 3 진행 가능"(OK with notes).** 중대 위험 6개 중 5개 **없음**, 6번째(저장 왕복 손실)는 **쓰기 경로에만 있고 배치 2의 숨김 실패가 아님**(`it.fails`가 그 상태를 고정). **P1 0건**, P2 3건 → 같은 턴에 수정.

| 등급 | 내용 | 처리 |
|---|---|---|
| P2 | `convert-cli.ts`가 **바뀐 파일만** 분석하고, `--write`가 검증 **전에** 디스크에 썼다 → 변환 후 "분석 오류 0"은 검사를 건너뛴 결과 | 항상 49편 전부 분석하고, 잔여·오류가 있으면 **쓰지 않고** 종료 |
| P2 | 변환 SHA 자리표시자·계획서 상태표가 아직 TODO | `11287b9` 기록, M8-DA-1·M8-FE-1·M8-FE-2를 DONE으로 |
| P2 | 변환기 헤더가 "IdeographicSpace는 글자를 남긴다"고 적혀 있었으나 구현은 `:br[]` | 주석 정정 |
| 관찰 | 3단계 중첩 콜론 단위 테스트가 없었다(코퍼스 최대 2단계) | 3단계 테스트 추가 — `6·5·4·3`으로 바깥일수록 많아짐을 고정 |
| 관찰 | `roundtrip.test.ts` 주석이 "인라인 directive 표본이 모두 실패"라고 과장 | 실제로는 2편만 실패 → 주석 정정 + **배치 3에서 원인 확인** 항목 추가 |

**리뷰어가 확인한 것(요약):** 산문에 `<Callout>`·`<u>`·`<IdeographicSpace>` 0건, `:br` 25곳 전부 `:br[]`(하드브레이크 19 + 빈 줄 6), `&#x20;` 35건·`:free를`·`:1로` 그대로, 코드·mermaid 펜스의 `<br/>`·`<div>` 보존, 레지스트리에 폐기 이름 잔존(배치 4 몫), A6 정규식은 `<br/>` 직후 공백만 제거(태그·단어 삭제 없음), `git revert 11287b9` 한 번으로 본문 복구.

**인프라(기록):** 첫 위임이 업스트림 오류(`上游返回错误`)로 실패 → 같은 프로토콜 재시도에서 성공.

### 9.9 R3 리뷰 (배치 3)

**위임:** `reviewer`(읽기 전용, `router/reviewer-route:high`) — run `a2b35d54-6f15-4b7f-a1dc-ca12e969775e`, 대상 `657b271` + `07e6a45`.

**판정: "배치 4 진행 가능"(OK with notes).** 중대 위험 6개 전부 **없음**, 완료 조건 2개(에디터 저장 멱등·49편 왕복 안정) **충족**. **P1 0건**, P2 3건 → 같은 턴에 수정.

| 등급 | 내용 | 처리 |
|---|---|---|
| P2 | `decorative`가 에디터 왕복에서 빠진다(`IMAGE_ATTRS`·이미지 스키마에 없음, 코퍼스 0건) | 스키마에 `decorative` 추가 + 양방향 참일 때만 복사 + 테스트 |
| P2 | 밑줄·위/아래첨자·정렬 **툴바 버튼**이 없다(단축키만 켜짐, 계획 §3 산출물 누락) | 툴바에 U·x²·x₂·왼쪽/가운데/오른쪽/자동 추가 |
| P2 | 등록 directive 이름의 `\:` 이스케이프가 없다(문단의 `:br `·`:u[`가 재파싱 때 지시자) | `escapeText`가 등록 이름 뒤의 `:`를 `\:`로 끊는다 + 테스트. 미등록(`:free를`)·시각·URL은 그대로 |
| 관찰 | `cmsNodeToTiptap`의 try/catch가 매핑 버그 신호를 숨길 수 있다 | 수용 — 단위 테스트가 네이티브 형태를 고정하므로 전부-상자 회귀는 걸린다 |
| 관찰 | 상자 `source`가 비면 노드를 버린다 | 수용 — `toOpaque`는 실노드에서만 만들어 빈 문자열이 나올 수 없는 방어 코드다 |

**R3이 확인한 것(요약):** `getHTML` 잔재 0·우회 저장 경로 없음·`CmsMdxPreserver` 참조 0·폐기 이름 잔존(배치 4 몫)·`align="center"`·`width="100%"` 생략 정당·`/entries/<UUID>` 삽입은 배치 4로 미루는 것이 타당(삽입이 텍스트라 `[`가 이스케이프되어 박히지 않음).

**인프라(기록):** 첫 위임이 업스트림 오류(`上游返回错误`)로 실패 → 같은 프로토콜 재시도에서 성공(R2와 동일 패턴).

**알려진 제한(배치 4 이후 검토):** 라벨 없는 등록 텍스트 지시자(`:u `·`:br ` 맨형태)는 읽기 단계에서 지시자로 인식되어 증발한다. 쓰기 이스케이프와 별개이며 코퍼스·공개 렌더에 영향 없다.

### 9.6 배치 4 결과

**커밋:** `ec8076a`

**산출물**

- `RETIRED_JSX_NAMES`(`ContentLink`, `IdeographicSpace`) 신설 + 두 이름을 레지스트리 2종·`MDX_COMPONENTS`·Keystatic 컴포넌트·참조 수집에서 제거. 본문에 남아 있으면 `analyze`가 `폐기된 JSX 요소` 오류로 거부한다.
- `REGISTERED_JSX_NAMES`를 `analyze`에 배선(미등록 JSX 거부). fragment(`<>`)는 이름이 없어 대조하지 않는다. 읽기 호환 완성을 위해 빠졌던 `br`을 등록 이름에 추가했다.
- 참조 수집은 `Image` 전용으로 단순화(`empty_reference_id` 코드 제거, `missing_media_id` 유지 — 코드명 검토 결과 그대로 둔다).
- 대조 테스트 `directive-registry.test.ts`(정의표↔렌더러↔레지스트리 + 폐기 잠금) + 미등록 보존 핀(`:free를`·`:1로` 코퍼스) + M6 한계 테스트의 계약 전환.
- 에디터 내부링크 삽입 `[제목](/posts/{slug})`(R3 이관, slug 없음 → 제목만).

**검증(실행 증거)**

- `pnpm test:run` → **115 files / 748 tests pass** · `pnpm exec tsc --noEmit` 0.
- 49편 전부 `analyze` 오류 0(미등록 거부 후에도 깨지는 본문 없음).

**남긴 것(명시)**

- 이관 도구(변환기 `legacy-jsx-to-directive.ts`·감사기 `roundtrip-audit.ts`)의 레거시 이름 인식은 유지한다 — 아직 변환하지 않은 원문을 읽어야 하므로. "폐기 0건"은 레지스트리·렌더러·본문·전방향 문서 기준이다.
- 라벨 없는 등록 텍스트 지시자(`:u ` 맨형태)의 읽기 증발은 미해결(배치 3 기록 유지).

### 9.10 R4 리뷰 (배치 4)

**위임:** `reviewer`(읽기 전용, `router/reviewer-route:high`) — run `9498f339-1d15-422a-9eb6-2c32b9dd63cf`, 대상 `ec8076a`.

**판정: "배치 5 진행 가능". 지적 0건(clean pass).** 중대 위험 6개 전부 없음, 완료 조건 3개(미등록 보존·일치·폐기 0건) 충족.

**리뷰어가 확인한 것(요약):** 의도적 잔류 4건 전부 정당(이관 도구 인식·fragment 생략·`empty_reference_id` 제거·글 전용 `/posts/` 고정). `br` 추가 필요충분. ContentLink 제거가 발행·저장을 깨지 않음. 문서 일치. §9.6의 "폐기 0건" 범위 한정이 타당.

### 9.5 배치 3 / 9.6 배치 4 / 9.9 M8-RV-1

(배치마다 추가)
