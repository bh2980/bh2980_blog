# @bh2980/cms-text-check

`@bh2980/cms` 편집기의 맞춤법·문장 검사 확장 틀(`@bh2980/cms-text-check`, `/extension`, `/server`)과 검사기 모음. 검사기마다 따로 불러오는 경로가 있어 쓰는 것만 설치된다. 관리자 패키지는 검사기를 싣지 않는다.

| 검사기 | 플러그인 | 언어 | 키 |
| --- | --- | --- | --- |
| 바른(Bareun) | `bareun()` (`@bh2980/cms-text-check/bareun`) | 한국어 | `BAREUN_API_KEY` |

## 검사 확장 틀

본체 편집기는 검사기를 모르고, 확장이 준 버튼·창을 그리기만 한다. 사이트·확장이 검사기(유료 API, 브라우저에서 도는 npm 패키지
등)를 만들어 `textCheckExtension({ checkers })`를 관리자 확장(`editorExtensions`)에 넣으면, 글의 언어를 검사하는 검사기마다
도구 모음 버튼(이름 `label`, 아이콘 `icon`)이 생기고 결과는 물결 밑줄·결과 창·목록으로 보인다. 확장을 여럿 넣어도 밑줄은
겹치지 않는다.

```tsx
"use client";
import { defineTextChecker } from "@bh2980/cms-text-check";
import { textCheckExtension } from "@bh2980/cms-text-check/extension";

const myChecker = defineTextChecker({
	id: "my-words",
	label: "금지어 검사", // 도구 모음 버튼 이름
	icon: "ban", // lucide 이름이나 컴포넌트. 없으면 맞춤법 아이콘
	locales: ["ko"], // 없으면 모든 언어
	limits: { maxChars: 10_000, maxSegments: 50 }, // 넘으면 나눠 보낸다
	// auto: true, // 입력을 멈추면 바뀐 문단만 저절로 검사(기본은 끔)
	check: async (segments, { signal }) => [
		// { segmentId, start, end, message, suggestions: [], severity: "error" | "warning" | "info", ruleId?, category?, source?, url? }
	],
});

const components = { editorExtensions: [textCheckExtension({ checkers: [myChecker] })] };
```

- 검사 단위는 문단(제목·목록 항목·표 칸 등 글이 든 블록) 하나다: `{ id, text, locale }`. 결과의 `start`·`end`는 그 문단 안의
  UTF-16 위치(JS 문자열 인덱스, `end` 미포함)다.
- 코드 블록·수식·코드 펜스 블록·블록 속성은 보내지 않는다. 인라인 코드와 주소는 `￼` 한 글자로 바꿔 보내고, 그 글자에 걸친
  결과는 버린다. 링크는 글자만 보낸다.
- 검사기 버튼은 고른 글자가 있으면 그 범위에 걸친 문단만, 없으면 문서 전체를 그 검사기로 검사한다. 결과는 물결 밑줄로 보이고,
  밑줄을 누르면 설명·바꿀 글 후보·"무시"가 뜬다. 버튼 옆 숫자를 누르면 결과 목록이다. 결과 범위 안을 고치면 그 결과는 사라진다.
- 같은 검사기·언어·글자의 문단은 다시 보내지 않는다(편집 화면을 여는 동안). 다시 검사하거나 화면을 닫으면 진행 중인 요청을
  `signal`로 끊는다.
- `auto: true`는 유료·호출 제한 API면 비용이 들 수 있어 기본으로 끈다. 켜면 입력을 1.5초 멈춘 뒤, 연 뒤로 바뀐 문단만 보낸다.

### 키가 필요한 API

API 키는 브라우저에 두지 않는다. 브라우저는 `remoteTextChecker`로 사이트 경로에 `{ segments }`를 보내고, 경로가 키로 API를
불러 `{ issues }`를 돌려준다. `textCheckRoute`는 관리자 로그인·같은 출처를 확인하고 요청 크기(기본 100문단·20,000자)를 막는다.

```ts
// 관리자 컴포넌트(브라우저)
import { remoteTextChecker } from "@bh2980/cms-text-check";
const checker = remoteTextChecker({ id: "bareun", label: "바른", locales: ["ko"], url: "/api/text-check" });

// app/api/text-check/route.ts(서버)
import { textCheckRoute } from "@bh2980/cms-text-check/server";
export const POST = textCheckRoute({
	limits: { maxChars: 20_000 },
	check: async (segments, { signal }) => callProvider(segments, process.env.MY_API_KEY, signal), // TextIssue[]
});
```

### 검사기를 붙일 때

- 위치 단위가 다르면 검사기 쪽에서 UTF-16으로 바꾼다. 바이트(UTF-8)·코드 포인트·문장 기준 위치를 그대로 쓰면 이모지·한글 뒤에서
  밑줄이 어긋난다.
- 바른(Bareun): 요청에 `encoding_type: UTF16`을 주면 `begin_offset`·`length`를 그대로 쓸 수 있다. 중첩 결과(`nested`)는 펼친다.
- LanguageTool·Yahoo 같은 위치 기반 API: 문단을 이어 보낼 때는 돌아온 위치를 문단별로 다시 나눈다. 요청 크기·분당 호출 한도는
  `limits`와 서버 경로에서 맞춘다.
- textlint: `range`(`[start, end]`)를 그대로 쓴다. `fix.text`는 후보로 쓰되 `fix.range`가 표시 범위보다 넓을 수 있다.
- hunspell 계열(nspell·typo-js): 낱말 단위라 `Intl.Segmenter({ granularity: "word" })` 등으로 낱말을 나눠 검사하고 위치를 직접
  센다. 띄어쓰기·문법은 보지 못한다.
- 위치 없이 틀린 낱말만 주는 검사기는 문단 글자에서 낱말을 찾아 위치를 정한다(같은 낱말이 여럿이면 차례대로).

`examples/other-site`의 `app/(admin)/studio/admin-components.tsx`가 브라우저에서 도는 작은 금지어 검사기 예시다.

### 스타일

결과 밑줄은 CSS가 필요하다. 앱의 Tailwind 입력 CSS에서 관리자 스타일 다음에 불러온다.

```css
@import "@bh2980/cms-admin/styles.css";
@import "@bh2980/cms-text-check/styles.css";
```

## 바른

```ts
// cms.config.ts
import { bareun } from "@bh2980/cms-text-check/bareun";

export default defineConfig({
	// …
	plugins: [bareun()],
});
```

```sh
# .env.local (서버 전용)
BAREUN_API_KEY=…
```

- 등록하면 편집기 도구 모음에 "맞춤법 검사" 버튼이 생긴다. 한국어 글에서만 보인다. 밑줄을 보려면 앱 CSS에서 `@bh2980/cms-text-check/styles.css`를 불러온다.
- 브라우저는 사이트 경로 `/api/cms/v1/text-check/bareun`로 문단만 보내고, 이 경로가 키로 바른을 부른다. 키는 브라우저에
  보내지 않는다. 관리자만 부를 수 있다. 키가 없으면 503(`text_check_unavailable`)을 돌려주고 바른을 부르지 않는다.
- 보내는 글: 문단(제목·목록 항목·표 칸 등) 글자만 보낸다. 코드 블록·수식·블록 속성은 빼고, 인라인 코드·주소는 편집기가
  `￼` 한 글자로 바꿔 보낸다. 그 자리에 걸친 결과는 버린다.
- 자동 검사는 기본으로 끈다. 바른 API는 쓴 만큼 요금이 든다(무료 사용량은 한 달 약 5만 어절). 버튼을 누를 때만 검사하고,
  같은 문단은 다시 보내지 않는다.

```ts
bareun({
	apiKeyEnv: "BAREUN_API_KEY", // 키를 담은 환경 변수 이름
	baseUrl: "https://api.bareun.ai", // 직접 띄운 바른 서버면 바꾼다
	label: "바른 맞춤법 검사", // 도구 모음 버튼 이름
	auto: false, // true면 입력을 멈출 때 바뀐 문단만 저절로 검사
	customDictNames: ["blog"], // 바른에 올려 둔 사용자 사전
	limits: { maxSegments: 100, maxChars: 10_000 }, // 한 번에 보낼 양(넘으면 나눠 보낸다)
});
```

결과는 바른의 가장 작은 고침 단위로 보인다(여러 고침을 합친 블록은 낱낱으로 펼친다). 분류는 띄어쓰기·표준어·오타·문법 등이고,
띄어쓰기·표준어·오타·문법·낱말 오류는 "오류", 나머지(문장 다듬기·외래어·헷갈리는 말·확인 필요)는 "주의"다.

## 검사기 더하기

새 검사기는 이 패키지에 새 경로로 더한다(예: `./languagetool`, `./languagetool/server`, `./languagetool/admin`).
키가 필요한 API는 바른처럼 서버 경로(`textCheckRoute`)와 브라우저 쪽 `remoteTextChecker`로 나누고, 키 없이 브라우저에서
도는 검사기는 관리자 쪽에서 `defineTextChecker`만 등록한다. 검사기 모양은 위 "검사 확장 틀"을 본다.
