# CMS 라이브러리화 개발 계획

- 작성: 2026-10-03
- 브랜치: `feature/cms-library` (기준 `main` @ `c261f80b`)
- 목표: 이 블로그의 CMS를 **다른 블로그가 설치해 자기 CMS를 꾸릴 수 있는 라이브러리**로 만든다. 지금 레포 안에서 패키지로 떼어 경계를 굳힌 뒤 새 레포로 옮긴다.
- 지금 상태: 1단계(본체 분리와 설정화) 커밋 6개 완료. 타입 검사 0 오류 · 테스트 1248개 통과 · `next build` 성공.

---

## 1. 지금까지 정한 것

| # | 정한 것 | 이유 |
| --- | --- | --- |
| D1 | **같은 레포에서 먼저 떼고, 경계가 굳으면 새 레포로 옮긴다.** 레포를 옮길 때는 `git subtree split`·`git filter-repo`로 커밋 기록째 옮긴다 | 블로그가 첫 사용자이자 시험대다. 레포가 나뉘면 경계를 고칠 때마다 배포·연결을 반복해야 한다 |
| D2 | **패키지를 셋으로 나눈다.** 본체 `@bh2980/cms`(꼭 설치), 관리자 화면 `@bh2980/cms-admin`(선택), AI `@bh2980/cms-ai`(선택 플러그인) | 화면을 직접 만들거나 AI가 필요 없는 블로그도 쓸 수 있게 한다 |
| D3 | **API 처리 코드(`/api/cms/v1/*`)는 본체가 가진다** | 공식 관리자 화면도 직접 만든 화면도 같은 API를 부른다 |
| D4 | **설정 파일을 둘로 나눈다.** 사이트 설정 `cms.config.ts`(브라우저도 읽음, JSON으로 담을 수 있는 값만)와 서버 설정 `cms.server.ts`(비밀 값, 서버 전용). 본체는 `@cms-config`·`@cms-server` 별칭으로 읽는다 | 비밀 값이 브라우저로 새지 않게 한다. Payload의 `@payload-config`와 같은 방식이다 |
| D5 | **본체는 컬렉션 이름을 직접 알지 않는다.** 필요한 규칙은 컬렉션 정의에서 끌어낸다(관계 필드, `path`, `workflow`) | 다른 블로그는 컬렉션 이름이 다르다. `typecheck:other-site`가 이를 지킨다 |
| D6 | **AI 기능은 이름(key)으로 정의하고 이름으로 부른다.** 기능 정의에 입력·지시문·결과 모양을 적고, 화면은 `useAiAction("summary").run(입력)`으로 부른다. 입력·결과·지시문 속 `{{이름}}`을 타입으로 검사한다 | 지금은 붙는 곳·대상·입력이 고정 목록이라 기능을 늘릴 때마다 여러 곳을 고쳐야 한다 |
| D7 | **AI 전용 자리 대신 일반 화면 확장점을 연다.** AI 버튼은 확장점에 넣는 평범한 컴포넌트(`<AiButton>`)다. CMS는 프리셋만 준다 | 확장점은 AI가 아니어도 일반 CMS에 필요하다. 사용자가 원하는 곳에 버튼을 둘 수 있다 |
| D8 | **AI는 플러그인이다.** 설정에 `aiPlugin(...)`을 등록하면 사이드바 항목·AI 설정 화면·API·DB 표·버튼이 생기고, 빼면 모두 사라진다 | 본체가 AI SDK 같은 무거운 의존성을 갖지 않는다. 같은 구조로 다른 플러그인도 붙인다 |
| D9 | **기능 정의는 설정(코드)에, DB에는 사용자가 고친 값만 둔다.** 켜기·연결·모델·지시문·기준값·공통 문구 | 지금 `withBuiltin`이 이미 고정 부분은 코드, 바뀌는 부분은 DB로 나눈다. 시드 단계만 없앤다 |
| D10 | **새 AI 기능(초안 생성·문체 다듬기)도 같은 틀에 넣는다.** 필요한 것은 흘려받기(stream), 미리보기 후 적용, 공통 문구(문체 가이드) | 기능마다 다른 것은 화면 쪽(부르는 곳·넣는 방식)뿐이다 |

---

## 2. 완료한 것 (1단계)

| 커밋 | 내용 |
| --- | --- |
| `d4f2d721` | pnpm 워크스페이스. 화면 코드가 없는 본체(adapters·ai·blocks·core·mdx·schema·services)를 `packages/cms`로 옮김. 사이트 설정 `cms.config.ts`(`defineConfig`·`defineCollection`), `withCms` |
| `f67eab3e` | 관계 참조 종류를 `entry`·`media` 둘로 줄임(`category`·`tag` 제거). 예전 행은 읽을 때 바꾸고 마이그레이션이 고침 |
| `efd634d2` | 관리자 목록 필터·목록 줄·일괄 작업을 관계 필드 기준으로 바꿈(`relation=필드:ID`, `relations[필드]`, `relation.add/remove/set`) |
| `d59f2f7d` | 메타데이터 타입(`MetadataFor<C>`)과 공개 내보내기 allowlist를 정의에서 만듦. 이름이 다른 예시 사이트로 본체를 타입 검사하는 `typecheck:other-site` |
| `1cb558f4` | 본문 내부 링크 규칙을 컬렉션 `path`·`site.url`에서 만듦(`core/links.ts`). 운영 도메인(`HOST_URL`)으로 적은 전체 주소 링크도 이제 검사한다 |
| `d3bae3f8` | 서버 설정 `cms.server.ts`(`postgres()`·`r2Storage()`·`githubAuth()`·`secret`·`schedulerToken`). 본체가 환경 변수를 직접 읽지 않음 |

검증 방법(이후 단계에서도 같다):

- `pnpm typecheck` (블로그 + 본체) · `pnpm --filter @bh2980/cms typecheck:other-site`
- `pnpm test:run` (DB 테스트는 `CMS_TEST_DATABASE_URL`의 격리 스키마)
- `pnpm build`
- 화면 확인은 테스트 DB에 임시 스키마를 만들어 개발 서버를 띄우고, 끝나면 스키마를 지운다. **운영 DB는 쓰지 않는다**

---

## 3. 남은 블로그 전용 지점 (인벤토리)

### 3.1 본체 `packages/cms`

| 지점 | 위치 | 처리 단계 |
| --- | --- | --- |
| AI 판단 선택지가 태그·카테고리로 고정(`loadRecords("tag"/"category")`). `typecheck:other-site`가 실패하는 유일한 곳 | `ai/run.ts` | M2 |
| 기본 AI 기능 11개가 필드 이름·컬렉션 이름·"기술 블로그" 지시문을 가짐 | `ai/builtins.ts`, `ai/run.ts`(`SYSTEM_FRAME`) | M2 |
| 마이그레이션 SQL에 AI 기능 이름표(`summary`·`mediaAlt` 등), 기본 AI 기능 시드 | `adapters/postgres/store/schema.ts` | M2 |
| 초기 본문 템플릿 시드("알고리즘 풀이", "Type Challenge 풀이") | 같은 파일 | M1 |
| 본문 블록 목록이 내장 고정. 사이트가 블록을 더하거나 뺄 수 없음 | `blocks/definitions.ts` | M6 |
| 공개 진입점이 `./*`로 내부 파일 전부(테스트 포함)를 내보냄 | `package.json` `exports` | M1 → M7 |
| 저장소 계약이 Postgres 구현 그대로(`ContentStore`). 다른 DB를 쓰려면 계약이 너무 큼 | `adapters/postgres` | 범위 밖(결정 필요, §6 Q5) |
| 예전 오류 코드 `missing_category`(필드 이름이 `categoryId`일 때만 나옴) | `schema/derive.ts` | 그대로 둠(무해) |

### 3.2 관리자 화면 (아직 블로그 안: `src/app/(admin)`, `src/cms/editor`, `src/cms/slots`, 약 25,000줄)

| 지점 | 규모 | 처리 단계 |
| --- | --- | --- |
| 블로그 UI 부품 의존: `@/components/ui/*` 209곳, `@/utils/cn` 36곳, `@/libs/i18n` 11곳, `@/libs/contents` 5곳 | 큼 | M3 |
| 태그·카테고리 전용 화면: 목록 열(`category`·`tags`), 필터, 일괄 작업 메뉴, `useTaxonomy("tag"/"category")`, `isContent = post \|\| memo` 등 컬렉션 이름 24곳 | 중간 | M4 |
| 사이트 이름 `bh2980.dev` 고정(사이드바, SEO 패널) | 작음 | M4 |
| 로그인 화면이 GitHub 고정(`signIn("github")`) | 작음 | M4 |
| 필드 입력 등록부(`FIELD_INPUTS`)가 화면 코드에 고정. 사용자가 컴포넌트를 등록할 수 없음 | 작음 | M5 |
| AI 자리(`slots.tsx`)와 AI 설정 화면(`admin/ai/*`, 641줄 + 391줄)이 관리자 레이아웃에 박혀 있음 | 중간 | M5·M2 |

### 3.3 API (아직 블로그 안: `src/app/api/cms/v1`, 라우트 38개, 약 1,600줄)

- 라우트 파일이 블로그 앱에 있다. 다른 블로그가 쓰려면 같은 파일을 다 복사해야 한다 → M3에서 본체로 옮긴다(D3).

---

## 4. 목표 구조

### 4.1 패키지와 진입점

| 패키지 | 진입점 | 내용 |
| --- | --- | --- |
| `@bh2980/cms` | `.` | 저작 API: `defineConfig`, `defineCollection`, `fields`, `defineBlock`, `definePlugin` |
| | `/server` | `defineServerConfig`, `postgres()`, `r2Storage()`, `githubAuth()` |
| | `/next` | `withCms`, API 처리기 `createCmsRouteHandler()`, 로그인 처리기 |
| | `/client` | 관리자·직접 만든 화면이 부르는 API 클라이언트와 타입 |
| `@bh2980/cms-admin` | `.` | `<CmsAdmin />`(관리자 화면 전체), 확장점 등록, 훅(`useEntryForm`·`useField`·`useEditor`) |
| `@bh2980/cms-ai` | `.` | `aiPlugin()`, `aiAction()`, 입력·결과 만들기(`text()`·`mdx()`…), `aiPresets` |
| | `/server` | 실행기, 연결(OpenAI 호환·System One), 마이그레이션 |
| | `/admin` | `<AiButton>`, `useAiAction()`, AI 설정 화면 |

### 4.2 블로그(호스트 앱)가 갖는 파일

```text
src/cms.config.ts                       사이트 설정 (컬렉션·언어·site·plugins)
src/cms.server.ts                       서버 설정 (DB·미디어·로그인·비밀 값)
next.config.ts                          withCms(..., { config, server })
tsconfig.json                           paths: @cms-config, @cms-server
app/(admin)/admin/[[...path]]/page.tsx  <CmsAdmin />
app/api/cms/[...path]/route.ts          createCmsRouteHandler()
app/api/auth/[...nextauth]/route.ts     로그인 처리기
(공개 화면)                              블로그가 직접 만든다. 본체의 공개 읽기 API를 쓴다
```

### 4.3 플러그인 구조

```ts
definePlugin({
  name: "ai",
  config: { /* 사이트 설정에 더하는 값 (JSON) */ },
  server: () => import("@bh2980/cms-ai/server"),   // API 경로·마이그레이션·실행기
  admin: () => import("@bh2980/cms-ai/admin"),     // 페이지·사이드바·표면 버튼·필드 입력
});
```

- 사용자는 `cms.config.ts`의 `plugins`에 **한 번만** 등록한다.
- 서버 코드와 화면 코드는 진입점을 나눠, 서버 코드가 브라우저로 새지 않게 한다.
- Next에서 이 방식(설정에 적힌 진입점을 서버·화면이 각자 불러오기)이 되는지는 **시제품(M5-P1)으로 먼저 확인**한다. 안 되면 `cms.server.ts`와 관리자 페이지에 한 줄씩 더 적는 방식으로 물러선다.

### 4.4 관리자 확장점

| 확장점 | 하는 일 |
| --- | --- |
| 페이지 + 사이드바 항목 | 플러그인 화면(`/admin/ai` 등) |
| 필드 입력 | 필드를 사용자 컴포넌트로 그린다(지금 `input: "auto-summary"`를 사용자 등록으로 연다) |
| 편집기 표면 | `field`(필드 옆) · `editor.selection`(선택 영역 메뉴) · `editor.insert`(슬래시 메뉴·빈 문서) · `editor.block`(블록 메뉴) · `document`(문서 전체) · `media`(미디어 상세) |
| 패널 | 편집 화면 옆 패널, 미디어 상세 패널 |
| 훅 | `useEntryForm()`(지금 글), `useField(name)`, `useEditor()`(선택 영역·블록), `useCmsApi()` |
| API·마이그레이션 | 본체 API 처리기와 마이그레이션이 플러그인 것을 함께 돈다 |

표면마다 "주는 재료"(예: 필드 옆 = 제목·본문·현재 값, 선택 영역 = 선택한 글·앞뒤 문단)를 타입으로 밝힌다.

### 4.5 AI 플러그인

**3층**

1. **기능 정의** (무엇을 할지) — 설정 파일 + DB의 고친 값
2. **표면** (어디서 부르고 결과를 어떻게 넣을지) — 관리자 확장점
3. **실행** (서버) — 입력 검사 → 서버 재료 읽기 → 지시문 채우기 → 연결 호출 → 결과 검사

**기능 정의**

```ts
aiPlugin({
  shared: { styleGuide: "'~다'체, 짧은 문장" },            // 공통 문구. 관리자 화면에서 고칠 수 있다
  actions: {
    summary: aiAction({
      input: { title: text(), body: mdx() },               // 부르는 쪽이 주는 값
      prompt: "{{shared.styleGuide}}\n제목: {{title}}\n본문: {{body}}\n1~2문장으로 요약하라.",
      result: text({ maxLength: 160 }),
    }),
    suggestTags: aiAction({
      input: { title: text(), body: mdx() },
      choices: relationOptions("post", "tagIds"),         // 서버가 직접 읽는 재료
      result: pickMany({ threshold: 0.6, max: 5 }),
      engine: "decide",
    }),
    translateBlock: aiAction({
      input: { block: mdx(), from: locale(), to: locale() },
      prompt: "…",
      result: mdx({ sameStructureAs: "block" }),          // 구조 유지 검사
    }),
  },
});
```

| 항목 | 종류 |
| --- | --- |
| 입력 | `text()` · `mdx()` · `image()` · `locale()` · `list()` |
| 서버 재료 | `relationOptions(컬렉션, 필드)` · `selectOptions(컬렉션, 필드)` · `mediaImage()` · `takenSlugs()` |
| 결과 | `text()` · `mdx({ stream, sameStructureAs })` · `candidates()` · `pickOne()`/`pickMany()` · `note()` |
| 검사 | 형식 · 길이 · 중복 없음 · 있는 값만 · 정규식 실행 · 구조 유지 (지금 것 그대로) |
| 방식 | 생성(`generate`, OpenAI 호환) · 판단(`decide`, System One — 선택) |

**타입으로 잡는 것**: 없는 기능 이름, 빠진 입력·틀린 입력 타입, 결과 모양, 지시문 속 없는 `{{이름}}`, 표면이 채울 수 없는 입력을 가진 기능을 그 표면에 붙이기. 서버는 같은 정의에서 만든 zod 스키마로 다시 검사한다.

**부르는 길 두 가지**

- 코드 없이: `fields.text({ ..., ai: ["summary"] })`, `editor: { selectionMenu: ["polish"], insertMenu: ["draft"], blockMenu: ["translateBlock"] }`
- 코드로: 확장점에 넣은 컴포넌트에서 `useAiAction("summary")` 또는 `<AiButton action="summary" input={…} onApply={…} />`

**DB**

| 표 | 내용 |
| --- | --- |
| `ai_settings` (유지) | 연결 목록(주소·암호화한 키·기본 모델) |
| `ai_action_overrides` (새로, `ai_features`에서 이전) | 기능 이름(key)별로 사용자가 고친 값: 켜기·연결·모델·지시문·기준값·최대 개수·검사 값 |
| `ai_shared` (새로) | 공통 문구 |

기존 `ai_features` 행은 이름표(`builtin`)가 곧 key라서 그대로 옮긴다. 사용자가 고친 지시문·모델·켜기 상태를 잃지 않는다.

**지금 기능 → 새 모양**

| 지금 기능 | 새 key (프리셋) | 표면 | 결과 |
| --- | --- | --- | --- |
| 주소 추천 | `slug` | 필드(`slug`) | 후보 · 형식/중복 검사 |
| 요약 만들기 | `summary` | 필드 | 글 |
| 태그 추천 | `suggestTags` | 필드(관계, 여러 개) | `pickMany` |
| 카테고리 추천 | `suggestCategory` | 필드(관계, 하나) | `pickOne` |
| 검색 제목 / 설명 추천 | `seoTitle` / `seoDescription` | 필드 | 후보 / 글 |
| 대체 텍스트 / 캡션 추천 | `imageAlt` / `imageCaption` | 이미지 블록, 미디어 상세 | 후보 |
| 파일 이름 추천 | `mediaFilename` | 미디어 상세 | 후보 · 형식 검사 |
| 코드 블록 정규식 | `codeFold` | 코드 블록 패널 | 후보 · 정규식 실행 검사 |
| 번역 | `translateBlock` | 블록 메뉴 + 번역 화면의 "전부 번역"(블록마다 반복) | MDX · 구조 유지 |
| (새) 문체 다듬기 | `polish` | 선택 영역 메뉴 | MDX · 미리보기 후 교체 |
| (새) 초안 생성 | `draft` | 슬래시 메뉴·빈 문서 | MDX · 흘려받기 · 커서에 삽입 |

---

## 5. 개발 계획

원칙

1. **블로그 동작을 그대로 둔다.** 단계마다 타입 검사·테스트·빌드를 통과하고, 화면이 바뀌면 격리 스키마에서 브라우저로 확인한다
2. **운영 DB는 쓰지 않는다.** 운영 마이그레이션·`main` 병합·push·레포 분리는 사용자 승인 뒤에 한다
3. **DB 모양을 바꾸면 기존 데이터를 그대로 읽을 수 있게 한다.** 예전 값은 읽을 때 바꾸고, 마이그레이션은 여러 번 돌려도 결과가 같게 한다
4. **한 단계 = 한 관심사 = 커밋 여러 개.** 단계를 마칠 때 이 문서의 진행 상태를 고친다

### M1. 본체 마무리 (작음)

| ID | 할 일 | 완료 조건 |
| --- | --- | --- |
| M1-1 | 초기 본문 템플릿 시드를 설정(`cms.config.ts`의 `seed.templates` 등)으로 옮김 | 마이그레이션에 블로그 문구가 없다. 이 블로그는 같은 템플릿이 들어간다 |
| M1-2 | 블로그가 본체에서 import하는 경로 목록을 조사해 공개 진입점 후보를 정함 | 진입점 목록 문서화. `./*` 제거는 M7 |

### M2. AI 재설계 (블로그 안에서, 화면 자리는 지금 것 유지)

AI 설계(D6·D9·D10)를 실제 기능으로 먼저 검증한다. 화면 확장점·플러그인 포장은 M5에서 한다.

| ID | 할 일 | 완료 조건 |
| --- | --- | --- |
| M2-P1 | **시제품**: `aiAction`·입력/결과 만들기·지시문 `{{}}` 타입 검사·`useAiAction` 타입을 `summary` 하나로 끝까지 연결 | 없는 이름·빠진 입력·틀린 `{{}}`가 타입 에러. 서버 zod 검사 테스트. 관리자 화면 요약 버튼이 새 경로로 동작 |
| M2-1 | 실행 API를 `{ key, input }`으로 바꾸고 서버 재료(`relationOptions` 등)를 이름으로 읽음. 태그·카테고리 고정 제거 | `typecheck:other-site` 통과 → 기본 `typecheck`에 넣음 |
| M2-2 | 기본 기능 11개를 프리셋으로 다시 정의. 블로그 설정이 프리셋을 고름 | 기존 기능이 같은 결과를 낸다(기존 AI 테스트 통과) |
| M2-3 | DB: `ai_features` → key별 고친 값. 기능 시드 제거, 마이그레이션의 이름표 SQL 정리 | 격리 스키마에 운영과 같은 모양의 데이터를 넣고 이전 → 고친 지시문·모델·켜기 유지 |
| M2-4 | 번역을 일반 기능(`translateBlock`)으로. 전용 경로(`/ai/translate`)·`builtin === "translate"` 제거, "전부 번역"은 블록마다 반복 호출 | 번역 화면 동작 동일. 구조 유지 검사 동일 |
| M2-5 | 지금 자리(`slots.tsx`)가 key 방식 기능을 붙이도록 연결. 기능 쪽 `attach`(임시)로 필드 자리에 붙임 | 관리자 화면 모든 AI 버튼 동작(브라우저 확인) |
| M2-6 | AI 설정 화면을 key·고친 값 모양으로 고침 | 켜기·연결·모델·지시문·시험이 동작 |

### M3. API·관리자 화면을 패키지로 이동

| ID | 할 일 | 완료 조건 |
| --- | --- | --- |
| M3-1 | API 라우트 38개를 본체 `createCmsRouteHandler()`로 옮기고, 블로그는 catch-all 라우트 하나만 둠(AI 라우트는 M5까지 블로그에 남김) | API 테스트 전부 통과. 블로그 `app/api/cms`에 파일 하나 |
| M3-2 | 관리자 화면이 쓰는 UI 부품(`components/ui` 등)을 관리자 패키지로 복사 | 관리자 코드가 `@/components/ui`를 import하지 않는다 |
| M3-3 | 편집기(`src/cms/editor`)·자리(`src/cms/slots`)를 관리자 패키지로 이동 | 편집기 테스트 통과 |
| M3-4 | 관리자 화면(`src/app/(admin)`)을 `<CmsAdmin />`으로 옮기고 블로그는 catch-all 페이지 하나만 둠 | 모든 관리자 화면이 같은 주소로 동작(브라우저 확인) |
| M3-5 | 블로그 의존을 주입으로 바꿈: 언어 이름(`LOCALE_INFO`), 사이트 이름, 미리보기 렌더러 | 관리자 패키지가 `@/`를 하나도 import하지 않는다(패키지 타입 검사) |

### M4. 관리자 화면 일반화

| ID | 할 일 | 완료 조건 |
| --- | --- | --- |
| M4-1 | 목록 열·필터·일괄 작업을 컬렉션의 관계 필드에서 만듦(태그·카테고리 전용 코드 제거). 저장된 열 설정(`category`·`tags`)은 읽을 때 필드 이름으로 바꿈 | 이 블로그 화면 동일. 예시 사이트 설정으로 관리자 화면이 뜬다 |
| M4-2 | `post`·`memo`·`tag`·`category` 이름 고정 24곳 제거(`isContent` 등은 `workflow`·`body`로) | 관리자 패키지를 예시 사이트 설정으로 타입 검사 통과 |
| M4-3 | 사이트 이름·로그인 방식(제공자 목록)을 설정에서 읽음 | 하드코딩 없음 |

### M5. 확장점·플러그인 구조, AI를 플러그인으로

| ID | 할 일 | 완료 조건 |
| --- | --- | --- |
| M5-P1 | **시제품**: `definePlugin` + 서버/화면 진입점 분리가 Next(Turbopack)에서 되는지 확인 | 플러그인 하나가 사이드바 항목·페이지·API 경로를 더한다. 서버 코드가 브라우저 묶음에 없다 |
| M5-1 | 관리자 확장점(페이지·사이드바·필드 입력·편집기 표면·패널)과 훅 | 필드 입력을 블로그가 직접 등록할 수 있다 |
| M5-2 | 본체 API 처리기·마이그레이션이 플러그인 것을 함께 돎 | 플러그인 표가 마이그레이션으로 생긴다 |
| M5-3 | AI를 `@bh2980/cms-ai`로 옮기고 `aiPlugin()`으로 등록. 자리(`slots.tsx`)를 표면 + `<AiButton>`으로 대체, 기능 쪽 `attach`를 필드 쪽 `ai: [...]`·편집기 메뉴 설정으로 바꿈 | 플러그인을 빼면 AI 흔적이 없다(사이드바·API·버튼). 넣으면 지금과 같다. 본체가 AI SDK에 의존하지 않는다 |

### M6. 본문 블록 설정화

| ID | 할 일 | 완료 조건 |
| --- | --- | --- |
| M6-1 | 사이트 설정에서 내장 블록을 고르고 블록을 더함. 공개 렌더러·편집기 NodeView 등록부를 주입으로 | 이 블로그는 같은 블록. 예시 사이트에서 블록 하나를 빼고 더할 수 있다 |

### M7. 배포 준비와 레포 분리

| ID | 할 일 | 완료 조건 |
| --- | --- | --- |
| M7-1 | 패키지 빌드(`dist`), 공개 진입점만 `exports`, peer 의존성 정리 | 빌드한 패키지로 블로그가 동작 |
| M7-2 | 예시 앱: 예시 사이트 설정(`test/other-site.config.ts`)으로 도는 최소 Next 앱 | 다른 컬렉션·언어로 관리자·API가 동작 |
| M7-3 | 설치 문서(README) | 빈 Next 앱에서 문서만 보고 설치 가능 |
| M7-4 | 새 레포로 기록째 옮기고 블로그는 설치한 패키지를 씀 | **사용자 승인 후** |

### M8. 새 AI 기능

| ID | 할 일 | 완료 조건 |
| --- | --- | --- |
| M8-1 | 흘려받기(stream) 결과와 실행 API | 긴 결과가 조금씩 보인다 |
| M8-2 | 문체 다듬기(`polish`): 선택 영역 메뉴, 바뀐 부분 미리보기 후 적용 | 브라우저 확인 |
| M8-3 | 초안 생성(`draft`): 슬래시 메뉴·빈 문서, 커서에 삽입 | 브라우저 확인 |
| M8-4 | 공통 문구(문체 가이드)를 관리자 화면에서 고침 | 고치면 모든 기능 지시문에 반영 |

### 순서

```text
M1 ─▶ M2 ─▶ M3 ─▶ M4 ─▶ M5 ─▶ M6 ─▶ M7
                                └─▶ M8 (M5 뒤 언제든)
```

M2(AI 재설계)를 패키지 이동(M3)보다 먼저 두는 이유: 가장 새로운 설계라 실제 기능으로 일찍 검증하는 편이 안전하다. 실행기·기능 정의는 어차피 패키지 코드이고, M5에서 바뀌는 것은 화면에 붙이는 방식뿐이다. 반대로 패키지 구조를 먼저 굳히고 싶다면 M3·M4를 M2 앞에 둔다(§6 Q1).

---

## 6. 사용자 결정이 필요한 것

| # | 질문 | 권고 |
| --- | --- | --- |
| Q1 | 순서: AI 재설계(M2)를 먼저 할까, 패키지 이동(M3·M4)을 먼저 할까 | AI 먼저 |
| Q2 | 판단 방식(System One: TypeSafe Jev·OpenRouter Decisions)을 계속 지원할까 | 지원하되 선택(연결이 없으면 판단 기능만 숨김) |
| Q3 | 관리자 화면에서 새 AI 기능을 만들게 할까 | 지금은 설정 파일에서만. 관리자 화면은 고치기만 |
| Q4 | 패키지 공개 범위와 이름(npm 공개·GitHub Packages·비공개), 라이선스 | M7 전에 결정 |
| Q5 | Postgres 말고 다른 DB를 지원할까 | 지금은 Postgres만. 계약이 커서 따로 큰 일이다 |
| Q6 | 이 브랜치를 언제 `main`에 합칠까 | M2를 마치면 한 번 합친다. 지금 커밋들은 기존 DB 데이터를 그대로 읽으므로 운영 마이그레이션 없이도 동작한다(마이그레이션을 돌리면 참조 종류 값이 정리된다) |

---

## 7. 진행 상태

| 단계 | 상태 |
| --- | --- |
| 1단계 (본체 분리·설정화) | 완료 (`d4f2d721` … `d3bae3f8`) |
| M1 | 대기 |
| M2 | 대기 (Q1 결정 후) |
| M3–M8 | 대기 |
