# bh2980.dev

[![Blog](https://img.shields.io/badge/blog-bh2980.dev-0f172a?style=flat-square)](https://bh2980.dev)
![Next.js](https://img.shields.io/badge/Next.js-16.1.1-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.3-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![MDX](https://img.shields.io/badge/MDX-Content-1B1F24?style=flat-square&logo=mdx&logoColor=white)
![Keystatic](https://img.shields.io/badge/Keystatic-CMS-1F6FEB?style=flat-square)

개인 학습 기록과 지식 공유를 위한 기술 블로그 레포지토리입니다.  
Next.js와 Keystatic을 기반으로 콘텐츠 관리 효율성과 구현 제어 범위를 함께 확보하는 방향으로 구성했습니다.

## Tech Stack

| 구분 | 기술 스택 |
| :--- | :--- |
| Framework | Next.js (App Router), React |
| Language | TypeScript |
| CMS | Keystatic |
| Content | MDX, Mermaid |
| Interaction | giscus |
| Metadata | RSS, Sitemap, Open Graph |

## Project Structure


```text
.
├── public
├── src
│   ├── app             # App Router 페이지, RSS, sitemap, OG 이미지
│   ├── components      # UI와 MDX 렌더링 컴포넌트
│   ├── contents        # 게시글, 메모, 태그, 카테고리 원본 데이터
│   ├── keystatic       # 콘텐츠 편집기와 컬렉션 설정
│   ├── libs            # 콘텐츠 조회, MDX, Mermaid 관련 로직
│   └── utils           # 공통 유틸 함수
├── keystatic.config.ts
└── package.json
```

## Content Management

콘텐츠는 성격에 따라 두 계층으로 나뉘어 관리됩니다.

- **게시글 (Posts)**: 비교적 긴 호흡의 기술 문서와 정리 글. 카테고리 기반으로 분류합니다.
- **메모 (Memos)**: 짧은 기록, 문제 해결 메모, 코드 스니펫. 태그 기반으로 탐색합니다.
- **메타 데이터**: 태그, 카테고리, 발행일, OG 이미지, RSS, sitemap 정보를 함께 관리합니다.
- **Admin UI**: Keystatic을 통해 로컬과 원격 환경 모두에서 GUI 기반으로 콘텐츠를 다룰 수 있습니다.

## Key Implementations

- **하이브리드 탐색 구조**: 게시글은 카테고리 기준, 메모는 다중 태그 기준으로 탐색할 수 있도록 분리했습니다.
- **MDX 확장 렌더링**: Mermaid와 커스텀 MDX 컴포넌트를 지원해 글 안에서 표현 범위를 넓혔습니다.
- **커스텀 주석 파서와 에디터 연동**: 코드 블록 주석 정보를 별도 구조로 파싱하고, 이를 Keystatic 코드 블록 에디터와 연결해 편집 흐름 안에서 다룰 수 있게 구성했습니다.
- **콘텐츠 메타 자동화**: RSS, sitemap, Open Graph 이미지와 같은 배포 메타 정보를 코드 레벨에서 함께 생성합니다.
- **콘텐츠 관리 흐름 분리**: 공개 페이지와 별도로 Keystatic 관리 화면 및 preview 흐름을 구성했습니다.

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

## Chart DSL 문법

차트는 MDX에서 ```` ```chart ```` 코드펜스로 작성합니다.  
v1에서는 `bar`, `line`, `area`, `pie`만 지원합니다.

### Cartesian 차트 (`bar`, `line`, `area`)

```txt
chart bar
x month
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
- `series <key> | <label> | <theme-token>`은 1개 이상 필요
- 빈 줄 뒤에 `data`
- 다음 줄은 테이블 헤더
- 데이터 값은 `|`로 구분

색상 토큰은 `chart-1`부터 `chart-5`까지만 허용합니다.

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
