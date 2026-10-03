# @bh2980/cms-text-check

`@bh2980/cms` 편집기의 맞춤법·문장 검사기 모음. 검사기마다 따로 불러오는 경로가 있어 쓰는 것만 설치된다.

| 검사기 | 플러그인 | 언어 | 키 |
| --- | --- | --- | --- |
| 바른(Bareun) | `bareun()` (`@bh2980/cms-text-check/bareun`) | 한국어 | `BAREUN_API_KEY` |

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

- 등록하면 편집기 도구 모음에 "맞춤법 검사" 버튼이 생긴다. 한국어 글에서만 보인다.
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
	label: "바른", // 결과 창에 보이는 이름
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
도는 검사기는 관리자 쪽에서 `defineTextChecker`만 등록한다. 검사기 모양은 `@bh2980/cms-admin`의 "맞춤법·문장 검사 확장"을 본다.
