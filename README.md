# bh2980.dev

[![Blog](https://img.shields.io/badge/blog-bh2980.dev-0f172a?style=flat-square)](https://bh2980.dev)
![Next.js](https://img.shields.io/badge/Next.js-16.1.1-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.3-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![MDX](https://img.shields.io/badge/MDX-Content-1B1F24?style=flat-square&logo=mdx&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-CMS-4169E1?style=flat-square&logo=postgresql&logoColor=white)

개인 학습 기록과 지식 공유를 위한 기술 블로그입니다. Next.js 기반 공개 사이트와 PostgreSQL(Neon) 기반 자체 CMS를 함께 개발합니다.

## Tech Stack

| 구분 | 기술 스택 |
| :--- | :--- |
| Framework | Next.js (App Router), React |
| Language | TypeScript |
| CMS | 자체 CMS (Next.js Route Handlers, `/admin`) |
| Database | PostgreSQL (Neon), `pg` |
| Editor | Tiptap, MDX |
| Media | Cloudflare R2 어댑터 |
| Content | MDX, Mermaid, KaTeX, 차트 DSL |
| Interaction | giscus |
| Metadata | RSS, Sitemap, Open Graph |

## Project Structure

```text
.
├── public              # 정적 에셋
├── src
│   ├── app             # 공개 페이지, /admin, CMS API, RSS, sitemap
│   ├── cms             # 인증·PostgreSQL·R2 어댑터, 편집기, MDX, 서비스
│   ├── components      # 공통 UI와 MDX 렌더러
│   └── libs            # 공개 콘텐츠 조회, 주석, 차트, Mermaid 등
└── package.json
```

## Content Management

콘텐츠는 성격에 따라 두 계층으로 나뉘어 관리됩니다.

- **게시글 (Posts)**: 비교적 긴 호흡의 기술 문서와 정리 글. 카테고리 기반으로 분류합니다.
- **메모 (Memos)**: 짧은 기록, 문제 해결 메모, 코드 스니펫. 태그 기반으로 탐색합니다.
- **메타 데이터**: 태그, 카테고리, 발행일, OG 이미지, RSS, sitemap 정보를 함께 관리합니다.
- **Admin UI**: `/admin`의 자체 관리자 화면에서 콘텐츠를 작성·정리·발행합니다. PostgreSQL이 CMS 데이터의 원본이고, 이미지 같은 파일은 R2에 둡니다.

## Key Implementations

- **콘텐츠 흐름 분리**: 초안·발행본을 구분하고 명시적 발행으로 공개 콘텐츠를 갱신합니다.
- **MDX 시각 편집**: Tiptap 편집기와 MDX 변환·검증 경로를 제공하며 원문 편집도 지원합니다.
- **콘텐츠 조회**: 공개 글·메모는 PostgreSQL 저장소에서 읽습니다. RSS, sitemap, SEO 메타데이터도 같은 공개 데이터를 사용합니다.
- **미디어**: R2 어댑터를 통해 관리자 미디어 라이브러리와 업로드 흐름을 제공합니다.
- **표현 기능**: Mermaid, KaTeX, 차트 DSL, 코드 주석과 커스텀 MDX 지시자를 렌더링합니다.

## CMS 현황

- **컬렉션 정의**: 게시글·메모·카테고리·태그·모음집의 필드를 `src/cms/schema/definitions.ts` 한 곳에서 정의하고, 입력 화면·검증·목록이 이 정의를 따릅니다.
- **편집기**: 블록 끌기, 이미지 크기·크롭·회전, 커스텀 블록(콜아웃·탭·단·Mermaid·차트·수식), 코드 블록 주석, 표 셀 병합을 지원합니다.
- **다국어**: 글·메모는 언어별 번역본을 따로 발행하고, 분류 항목은 이름을 언어별로 둡니다. 기본 언어(`ko`)는 접두사 없는 주소, 그 밖은 `/en`·`/ja` 주소입니다.
- **AI 보조**: 관리자 `AI` 화면에서 서비스 연결과 기능(주소·요약·태그·alt 추천, 본문 번역)을 정의합니다. 버튼을 눌렀을 때만 호출하고 결과는 제안으로만 보입니다.
- **발행일**: 처음 발행한 시각을 서버가 기록하고 다시 발행해도 바꾸지 않습니다. 발행 메뉴의 "오늘 날짜로 다시 발행"으로만 바꿉니다.
- **발행 예약**: 확장(`@bh2980/cms-schedule`)으로 뺐고 이 블로그는 쓰지 않습니다. 실행기를 정하면 다시 넣습니다.

## Development

`CMS_DATABASE_URL`에 Neon PostgreSQL 연결 문자열을 설정한 뒤 실행합니다. `CMS_SCHEMA`는 선택 항목이며, 생략하면 `public` 스키마를 사용합니다. 별도의 `CMS_PUBLIC_REPOSITORY` 설정은 필요하지 않습니다. 비밀값은 `.env.local`에 두고 저장소에 커밋하지 마세요. R2 업로드와 관리자 인증을 검증하려면 각 서비스의 서버 환경값도 필요합니다.

```bash
pnpm install
pnpm cms:db:migrate   # CMS 테이블 생성·최신 스키마 반영(추가 전용, 여러 번 실행해도 안전)
pnpm dev
```

주요 검증 명령(PostgreSQL 테스트는 운영 DB와 분리된 `CMS_TEST_DATABASE_URL`만 사용합니다):

```bash
TZ=UTC pnpm test:run
pnpm typecheck
pnpm build
```

## Custom Annotation 문법

코드 블록 안에서는 별도 주석 문법으로 라인 강조, wrapper, 인라인 렌더를 지정할 수 있습니다.

### 주석 prefix

언어에 따라 annotation 주석 prefix가 달라집니다.

| 언어 | 주석 문법 |
| :--- | :--- |
| `ts`, `tsx`, `js`, `jsx` 등 기본값 | `// @...` |
| `python`, `yaml`, `toml`, `bash` | `# @...` |
| `sql` | `-- @...` |
| `postcss` | `/* @... */` |

### 기본 형태

```txt
@line <name> {start-end} attr="value"
@char <name> {start-end} attr="value"
@document <name> {start-end} attr="value"
```

- `@line`: 줄 단위 annotation
- `@char`: 한 줄 안의 문자 범위 annotation
- `@document`: 코드 블록 전체 기준 absolute range annotation
- `{start-end}`는 닫힌 구간입니다. 예를 들어 `{0-4}`는 내부적으로 `0`부터 `4`까지 포함합니다.

### 자주 쓰는 line annotation

```ts
// @line plus
const added = 1

// @line minus
const removed = 2

// @line highlight {0-1}
const first = 1
const second = 2
```

- `plus`: 추가된 줄처럼 초록 강조
- `minus`: 삭제된 줄처럼 빨강 강조
- `highlight`: 중립 강조
- `warning`, `error`: 물결 밑줄 강조

연속 구간은 시작/종료 marker로도 쓸 수 있습니다.

```ts
// @line collapse
const first = 1
const second = 2
// @line collapse end
```

### 자주 쓰는 inline/document annotation

```ts
// @char Tooltip {6-10} content="설명"
const value = hello
```

```ts
// @document fold {0-4}
hello world
```

- `Tooltip`: 지정 범위를 툴팁으로 감쌉니다.
- `fold`: 지정 범위를 접힘 형태로 렌더링합니다.
- `strong`, `em`, `del`, `u`도 document/inline 범위에서 사용할 수 있습니다.

쉽게 말하면, 코드 안에 “이 줄은 강조해”, “이 글자는 툴팁 붙여”, “이 구간은 접어”를 주석으로 적는 방식입니다.

### regex selector

숫자 범위 대신 정규표현식으로 범위를 지정할 수도 있습니다.

```ts
// @char fold {re:/foo/g}
const value = "foo foo"
```

```ts
// @document fold {re:/foo/}
foo bar foo
```

규칙은 이렇습니다.

- `@char ... {re:/.../flags}`: 바로 아래 한 줄에서만 매치를 찾습니다.
- `@document ... {re:/.../flags}`: 코드 블록 전체에서 매치를 찾습니다.
- `g` 플래그가 없어도 내부에서 전체 매치를 모두 수집합니다.
- 줄바꿈을 가로지르는 정규식도 사용할 수 있습니다.

예를 들면 JSX의 `className` 값만 접고 싶을 때도 이런 식으로 쓸 수 있습니다.

```ts
// @document fold {re:/(?<=className\s*=\s*")[^"]+(?=")/g}
const a = <div className="alpha beta" />
const b = <span className="gamma" />
```

## Chart DSL 문법

차트는 MDX에서 ```` ```chart ```` 코드펜스로 작성합니다.  
v1에서는 `bar`, `line`, `area`, `pie`만 지원합니다.

### Cartesian 차트 (`bar`, `line`, `area`)

```txt
chart bar
x month
show-values
hide-grid
hide-y-axis
y-range 0 2400
series views | 조회수 | chart-1
series likes | 좋아요 | chart-2

data
month | views | likes
Jan | 1200 | 180
Feb | 1680 | 220
Mar | 1940 | 260
```

규칙은 이렇습니다.

- 첫 줄은 `chart <type>`
- `x <field>`는 필수
- `show-values`를 넣으면 각 데이터 값이 차트 위에 표시됩니다.
- `hide-grid`를 넣으면 배경 격자선을 숨깁니다.
- `hide-y-axis`를 넣으면 y축 숫자와 축 표시를 숨깁니다.
- `y-range <min> <max>`를 넣으면 y축 범위를 고정합니다.
- `series <key> | <label> | <theme-token>`은 1개 이상 필요
- 빈 줄 뒤에 `data`
- 다음 줄은 테이블 헤더
- 데이터 값은 `|`로 구분

색상 토큰은 `chart-1`부터 `chart-5`까지만 허용합니다.

쉽게 말하면, 기본 문법은 그대로 두고 필요할 때만 `show-values`, `hide-grid`, `hide-y-axis`, `y-range` 같은 줄을 추가해서 차트 모양을 조절하는 방식입니다.

### Pie 차트

```txt
chart pie
label browser
value visitors

data
browser | visitors
Chrome | 412
Safari | 248
Edge | 132
```

규칙은 이렇습니다.

- `label <field>`는 항목 이름 필드
- `value <field>`는 숫자 값 필드
- 색상은 행 순서대로 `chart-1` ~ `chart-5`가 자동 배정
- `show-values`, `hide-grid`, `hide-y-axis`, `y-range`는 pie 차트에서 지원하지 않습니다.

### 오류 처리

문법이 잘못되면 차트가 조용히 깨지지 않고, 본문과 에디터 모두에서 오류 카드가 표시됩니다.

예를 들어 이런 경우 에러가 납니다.

```txt
chart bar
x month
series views | 조회수 | chart-1

data
month | views
Jan | nope
```

- 지원하지 않는 차트 타입
- 필수 헤더 누락
- `series`와 `data` 헤더 불일치
- 숫자 필드에 숫자가 아닌 값 입력
- 허용되지 않은 색상 토큰 사용
- pie 차트에서 cartesian 전용 옵션 사용
