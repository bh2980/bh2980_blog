# CMS M11 구현·검증 기록

- 상태: 완료 — R11-C 최종 독립 판정 OK with notes; 미해결 P0/P1 0건.
- 브랜치/기준 커밋: `feature/new-cms` / `c0e973c0 fix(cms): finish M10 editor browser verification`
- 안전 범위: 현재 브랜치만 수정. `main` 병합·배포·운영 DB 쓰기 없음.

## 시작 기준선 (변경 전)

| 검사 | 결과 |
|---|---|
| `TZ=UTC pnpm test:run` | 통과 — 116 test files, 768 tests. 기존 pg SSL 호환 경고 및 의도된 테스트 stderr 있음. |
| `pnpm typecheck` | 통과 |
| `CMS_PUBLIC_REPOSITORY=postgres pnpm build` | 통과 — Next.js 16.1.1 |
| raw `<select>` | 관리자 7곳, 4파일 (아래 목록) |
| 로컬 shadcn UI 모듈 | `src/components/ui/` 20파일; `native-select`, `select`, `badge`, `button`, `input` 존재 |

## 인벤토리 및 초기 결정 후보

| 위치 / 수 | 기존 동작 | 후보 / 예외 |
|---|---|---|
| `admin-entries-table.tsx` ×2 | 상태 필터, 페이지 크기. controlled native `onChange`, 페이지 크기는 `Number(...)` 변환 | `NativeSelect`로 유지: 네이티브 키보드/모바일 및 기존 change-event 계약 보존. 상태 배지도 `Badge` 후보 |
| `entries/bulk-bar.tsx` ×3 | bulk action, category, folder 선택; 조건부 렌더·동적 옵션 | 모두 `NativeSelect` 후보. `BulkOp` 등의 기존 string cast/선택 값을 보존 |
| `entries/inspector-panel.tsx` ×1 | 게시글 category 필드, `aria-invalid`/`aria-describedby`, nullable 값 변환 | `NativeSelect` 후보. 현재 오류 접근성 속성·레이아웃 유지 |
| `templates/template-manager.tsx` ×1 | `post`/`memo` target 컬렉션, controlled change | `NativeSelect` 후보. 동일 타입 cast 보존 |
| 관리자 검색/일반 텍스트 입력 | 목록 검색 등 | 공용 `Input` 후보는 표준 text 입력에만 적용. checkbox/color/date/file 등 전문 입력은 제외 |
| 관리자 반복 버튼 | 목록 작업 및 bulk 주요/보조 동작 | `Button` 후보는 반복 역할에 한정, 각 버튼의 기존 톤/크기/submit 동작을 className/variant로 보존 |
| 테이블 / breadcrumb / pagination / sidebar | 정렬·선택·폴더 탐색·URL/page-state callback·collection 이동 | 로컬 컴포넌트 부재를 전제로 공식 제공 여부/복잡도 확인. 현재는 기능 특화가 강해 교체 비용이 이득보다 큰 것으로 보여 보류 후보 |

### 공식 shadcn 확인

착수 조사에서 공식 컴포넌트 인덱스 및 Native Select, Badge, Input, Breadcrumb, Pagination, Table/Data Table 문서를 확인했다. 공식 Native Select 문서는 native browser behavior, performance, mobile dropdowns를 이유로 native primitive를 제시한다. 공식 라이브러리는 Badge/Button/Sidebar와 구조 요소 후보를 제공하지만, 공식 제공 여부만으로 이 저장소의 도메인 UI 교체 근거가 되지는 않는다.

- https://ui.shadcn.com/docs/components
- https://ui.shadcn.com/docs/components/base/native-select
- https://ui.shadcn.com/docs/components/base/badge
- https://ui.shadcn.com/docs/components/base/input
- https://ui.shadcn.com/docs/components/base/breadcrumb
- https://ui.shadcn.com/docs/components/base/pagination
- https://ui.shadcn.com/docs/components/aria/table
- https://ui.shadcn.com/docs/components/base/data-table

## 진행 로그

- **O11 Oracle 자문 (구현 전):** 원시 select 7곳 모두 `NativeSelect` 권고. native change-event, 키보드/모바일, 기존 `Number(...)`, nullable, bulk sentinel 계약을 유지한다. 목록 `Badge`는 emerald/neutral 색을 보존. `Input`은 일반 텍스트에만, `Button`은 반복 작업에만 적용. table/breadcrumb/pagination/sidebar는 정렬·선택·폴더 트리·callback 상태 특화로 보류하고 근거를 남긴다.
- **A — 선택·상태:** 관리자 원시 `<select>` 7곳을 `NativeSelect`로 바꾸고 접근 가능한 이름을 추가했다. Inspector category의 full-width 필드가 wrapper의 `w-fit`로 줄어들지 않게 선택적 `wrapperClassName` 지원을 추가하고 `w-full` 적용. 목록 상태 pill은 shadcn `Badge`로 바꾸되 기존 공개 emerald/초안 neutral 스타일을 보존했다.
- A 자동 검증: 목록 필터/숫자 page size 및 두 Badge 색 테스트 2개, BulkBar tag/category `__none__`/folder `__root__` payload 및 파괴 작업 confirm 테스트 2개, 기존 editor 테스트 5개 통과. 세 테스트 파일 9/9 통과, `pnpm typecheck` 통과, 관리자 원시 `<select>` 0곳, `git diff --check` 통과.
- A 브라우저 파일럿: DB/API를 호출하지 않는 임시 fixture route에서 실제 `AdminEntriesTable` 컴포넌트를 Chromium으로 확인했다. 390px에서 `documentElement.scrollWidth=390`; 상태/페이지 크기 select 각각 150/127px, 기존 상태 색과 레이아웃 보존. 상태 select에 ArrowDown을 보내 `draft`로 값 변경 및 행 필터링(2→1)을 확인. 1280px에서도 page/body overflow 없음. 검사 후 fixture와 dev server를 제거한다. 이는 실제 DB-backed 관리자 화면 검수가 아닌 컴포넌트 browser harness임을 명시한다.
- **R11-A reviewer:** 독립 판정 **OK with notes**, P0/P1 0건. 원 실행은 180초 제한으로 timeout됐으나 동일 reviewer run을 resume해 최종 판정을 받았다. P2 note는 `NativeSelect`의 기본 shadow/dark input 배경/purple focus ring 차이였다. 7개 사용처에 shadow 제거, neutral dark/hover 색, 기존 키보드 focus 계약(목록 neutral border-only, Inspector 기존 blue 1px ring)을 명시해 조치했다. 이후 관련 9개 테스트와 typecheck 통과; 390px 실제 Chromium에서 neutral 배경·transparent shadow·중립 border와 가로 overflow 없음 재확인.
- **B — 버튼·입력:** 일반 텍스트 입력 10곳을 공용 `Input`(목록 검색·폴더 이름, Inspector 제목/slug/카테고리/SEO/canonical/tag, 템플릿 이름), 반복 동작 11곳을 `Button`(목록 생성/페이지 이동, bulk 해제·실행·재실행·확인, Inspector slug/category/tag 동작)으로 바꿨다. 기존 `type`, controlled callbacks, disabled 상태, 입력 오류 ARIA, dark-neutral 색·사이즈를 보존했다. 체크박스·날짜 입력, 태그 토글 칩, 폴더 트리 탐색/CRUD와 템플릿 에디터 도구 버튼은 의미/크기가 달라 raw native로 유지했다. 선택한 네 파일의 raw JSX button 수는 기준선 37→26, raw input 수 14→4로 줄었다(새 shared Button 11, Input 10 사용).
- **C — 구조 요소 보류:** table은 sticky sortable header, row selection, inline rename와 폴더 행을 함께 처리해 얇은 shadcn wrapper로는 중복이 줄지 않는다. Breadcrumb은 루트/폴더 callback 탐색 경로라 일반 링크 breadcrumb와 계약이 다르다. Pagination은 dashboard의 URL·page state callback으로 제어되어 anchor 기반 primitive와 맞지 않는다. Sidebar의 collection tabs·folder tree CRUD는 도메인 내비게이션이라 유지했다. 다만 현재 Sidebar는 `w-64 flex-shrink-0` 고정 폭이고 dashboard는 `overflow-hidden`이며 모바일 축소/접기 구현이 없다. 전체 화면 390px 확인에서 sidebar 256px가 고정돼 본문 컨트롤/테이블이 좁게 잘린다. 두 파일은 M11 diff에 포함되지 않아 기존 모바일 제약으로 기록하며, 별도 반응형 내비게이션 후속 항목으로 남긴다. 정렬 가능한 `<th onClick>`의 키보드 접근성도 별도 후속 점검으로 남긴다.
- **격리 DB 실제 관리자 브라우저 확인:** Vitest의 `loadEnv("test")`로 확인되는 `CMS_TEST_DATABASE_URL`만 사용하고 `CMS_DATABASE_URL`과 동일 DB면 중단하는 guard를 두었다. 새 `cms_test_m11_91cfa264` schema에 migration 후 draft fixture 1건을 넣어 실제 `/admin`을 열었다. 1280px에서 document/body 1280px, main 1024px로 정상 표시. 390px에서는 document/body overflow는 없지만 고정 sidebar로 본문이 압축되는 위 기존 제약을 관찰했다. Search `m11-no-such-entry`는 빈 목록으로, Tab 후 ArrowDown은 상태 필터를 `draft`로 바꾸고 URL/list를 갱신했다. page size·정렬·생성 등 쓰기 동작은 누르지 않았다. 검증 후 dev server를 종료하고 fixture schema(10 tables)를 삭제했다.
- **R11-B reviewer (읽기 전용, 최초 판정 BLOCK):** P0 0, P1 1, P2 2. P1은 pagination 이전/다음 및 bulk 실패 재실행 버튼의 dark hover 배경에 공용 outline Button의 light accent-foreground가 적용되는 대비 문제. 두 P2는 (a) `Input` 공용 `md:text-sm`가 기존 `text-xs`를 데스크톱에서 덮음, (b) sidebar의 “responsive 상태” 설명이 source와 맞지 않음(위 C 참조). 수정: 세 outline 버튼에 `hover:text-neutral-200`, 좁은 입력 7곳에 `md:text-xs`를 추가했고 C 설명을 실제 source/390px 검증에 맞게 고쳤다. R11-C에서 전체 diff를 독립 최종 확인한다.

## 최종 결과

R11-C 최종 독립 리뷰에서 OK with notes, 미해결 P0/P1 0건을 확인했다. main 병합·배포는 하지 않았고 운영 DB에 연결하거나 쓰지 않았다.

| 검증 | 결과 |
|---|---|
| `TZ=UTC pnpm test:run` | 통과 — 118 test files, 773 tests. 변경 전 116 files / 768 tests. 기존 Postgres SSL 호환 경고 및 일부 의도된 테스트 stderr는 기준선과 동일. |
| `pnpm typecheck` | 통과 |
| `CMS_PUBLIC_REPOSITORY=postgres pnpm build` | 통과 — Next.js 16.1.1 |
| `git diff --check` | 통과 |
| 관리자 raw `<select>` | 0곳. 기존 7곳은 모두 `NativeSelect`로 이전. |
| 집중 UI 테스트 | 통과 — AdminEntriesTable 3, BulkBar 2, editor 5; 합계 10/10. |

### 브라우저 증거 및 범위

- 변경된 목록 컴포넌트 fixture와 실제 관리자 화면을 Chromium에서 확인했다. 실제 `/admin`은 두 번의 별도 disposable `cms_test_m11_*` schema를 사용했다. 매번 Vite test mode의 `CMS_TEST_DATABASE_URL`만 앱의 `CMS_DATABASE_URL`로 전달했고, `sameDatabase` guard가 설정된 `CMS_DATABASE_URL`과 일치하면 진행하지 않도록 했다. 각 schema는 migration + 임시 초안 1건 후 확인했고 검사 종료 뒤 10개 테이블을 포함해 schema 전체를 삭제했다. 서버/fixture/임시 스크립트도 제거했다.
- 1280px 목록 화면에서 document/body 1280px, main 1024px. 검색 입력으로 일치하지 않는 제목을 찾으면 목록이 비고, 상태 select에 Tab 후 ArrowDown을 입력하면 `draft` 상태와 URL/list가 갱신됐다. page size·정렬·생성/수정/삭제 등 쓰기 동작은 누르지 않았다.
- 390px에서 document/body 폭은 390px이며 NativeSelect 목록 파일럿과 키보드 동작은 확인됐다. 전체 `/admin`은 별도 기존 제약이 관찰됐다: sidebar가 모든 폭에서 `w-64 flex-shrink-0`(256px)이고 dashboard가 `overflow-hidden`이라 본문이 압축·클리핑된다. 해당 레이아웃 파일은 이번 diff에 포함되지 않았고 R11-B reviewer도 기존 문제로 판정했다. 모바일 sidebar 재설계는 M11에서 하지 않았으며, 반응형 navigation 후속으로 남긴다.
- R11-B 지적 수정 후 실제 화면에서 pagination outline 버튼 hover 색은 neutral text `oklab(0.707999 …)` / neutral-800 배경 `oklab(0.205 …)`으로 확인했다. Editor Inspector의 작은 텍스트 `Input`은 1280px에서도 computed font-size 12px였고 제목 입력은 14px로 유지됐다.
- 이 브라우저 검증은 disposable 시험 schema에서 수행했다. 공개/운영 데이터 경로에는 쓰지 않았다.

### 독립 검수 상태

- **R11-A:** 독립 판정 OK with notes, P0/P1 0. NativeSelect 배경/shadow/focus 색 note 수정 및 재확인 완료.
- **R11-B:** 최초 판정 BLOCK — P0 0, P1 1, P2 2. P1 hover 텍스트 대비는 pagination 이전/다음 및 bulk 실패 재실행에 `hover:text-neutral-200`를 적용했다. Input `md:text-sm`의 기존 text-xs 덮어쓰기 P2는 좁은 입력 7곳에 `md:text-xs`를 적용했다. 문서의 sidebar responsive 설명 P2를 실제 소스와 390px 증거에 맞게 고쳤다. 집중 테스트/typecheck/full suite/build와 수정 후 브라우저 확인은 통과했다.
- **R11-C:** 최종 읽기 전용 검수 **OK with notes**, unresolved P0/P1 0건, 추가 finding 없음. 7개 select 계약, shared Button/Input와 R11-B 수정, 상태 색, 구조 보류 근거 및 모바일 caveat를 확인했다. reviewer는 test/typecheck/build/browser를 재실행하지 않았고 본 보고서의 검증 증거를 확인했다.

### 남은 별도 후속

- 기존 고정폭 관리자 sidebar의 모바일 navigation/본문 압축 문제. M11 diff로 유입된 회귀가 아니며 이번 범위에서는 Sidebar 재작성 대신 보류 사유를 기록했다.
- 기존 sortable `<th onClick>`의 키보드 접근성 후속 점검(M13 접근성 감사 대상).
- 로컬 test DB SSL mode 경고는 기존 기준선에도 있었으며 이번 작업에서는 connection/security 설정을 변경하지 않았다.
