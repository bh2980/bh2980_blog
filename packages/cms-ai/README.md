# @bh2980/cms-ai

`@bh2980/cms`의 AI 플러그인. 이름으로 부르는 AI 기능(생성·판단), 필드 옆 AI 버튼, 번역본 편집기의 AI 번역,
관리자 AI 화면(`/admin/ai`)과 AI API(`/api/cms/v1/ai/*`), AI 표(`ai_action_overrides`·`ai_settings`)를 더한다.
등록하지 않으면 이것들이 모두 없다.

## 등록

사이트 설정의 `plugins`에 `aiPlugin()`을 적는다. 기능은 이름(key)으로 적고, 기본 기능은 `aiPresets`로 고른다.

```ts
import { aiPlugin, aiPresets } from "@bh2980/cms-ai";

plugins: [
	aiPlugin({
		siteDescription: "개인 기술 블로그", // 모든 기능의 맨 앞 지시에 들어간다
		actions: {
			summary: aiPresets.summary({ collections: ["post"] }),
			tags: aiPresets.tags({ choices: "tag", collections: ["post"] }),
			translate: aiPresets.translate(),
		},
	}),
],
```

- 기능 하나는 입력(재료)·지시문·결과 모양·검사·붙을 곳(`attach`)이다. `aiAction()`으로 직접 정의할 수 있다.
- 재료(제목·본문·이미지…)는 지시문에 끼우지 않고 따로 보낸다. 지시문의 `{{이름}}`에는 언어 입력만 넣을 수 있다.
- 붙을 곳은 관리자 화면의 정해진 자리다(필드 옆·본문 이미지·미디어·코드 블록·번역·선택 영역 메뉴·삽입 메뉴·본문 블록).
  자리가 필수 입력을 채울 수 있어야 한다.
- 관리자 AI 화면에서는 켜기·요청 받기·연결·모델·보낼 입력·지시문·기준값·검사 값만 고친다. 고친 값만 DB(`ai_action_overrides`)에 둔다.
- 실행: `POST /api/cms/v1/ai/run { action, input | inputs, env }`. 관리자 화면에서는 `useAiAction("summary").run({ title, body })`나
  `<AiButton action="summary" input={() => ({ title, body })} onResult={…} />`(`@bh2980/cms-ai/admin`)처럼 이름으로 부르고,
  이름·입력·결과 타입은 설정에서 나온다.
- 판단 방식(`engine: "decide"`, System One)은 선택지(`choices`)마다 확률을 받아 기준 이상만 후보로 낸다.

## 결과 검사

- **정해진 검사(`checks`)**: 형식(`pattern`)·길이(`maxLength`)·중복 없음(`unique`)·있는 값만(`exists`)·선택지 안
  (`oneOf`, 정해 둔 목록 중 하나)·정규식 실행(`regexRuns`)·구조 유지(`structure`). 관리자 AI 화면에서 켜고 끄며 값을 고치고,
  어느 기능에든 형식·길이·선택지 안 검사를 더하거나 뺀다(정의가 정한 검사는 끄기만 한다).
- **코드 검사(`validate`)**: 정해진 검사로 안 되는 것은 함수로 본다. 정해진 검사 다음에 서버에서 값 하나(후보 하나, 글·MDX
  결과 전체)마다 부른다. `undefined`·`true`면 통과, 글자면 그 이유로 버리고(글·MDX는 실패), `{ detail }`이면 통과하면서
  후보 옆에 설명을 붙인다.

```ts
aiAction({
	label: "다이어그램 만들기",
	// …
	validate: (value, { input, collection, choices }) =>
		value.trim().startsWith("```mermaid") ? undefined : "```mermaid 코드 펜스 하나가 아닙니다.",
});
```

## 새 기능 (M8)

- **흘려받기**: 기능 정의 `stream: true`(생성 방식의 글·MDX 결과)면 결과가 조금씩 보인다. 화면에서는
  `useAiAction("이름").stream(입력, { onText })`. API는 `/ai/run`에 `stream: true`(한 줄에 사건 하나인 JSON).
- **공통 문구**: `aiPlugin({ shared: { styleGuide: { label: "문체 가이드", text: "…" } } })`. 지시문에
  `{{shared.styleGuide}}`로 넣고, 관리자 AI 화면 "공통 문구" 탭에서 고친다.
- **문체 다듬기·초안 쓰기**: `aiPresets.polish()`(본문에서 글자를 고르면 뜨는 메뉴, 바뀐 곳을 보인 뒤 바꾸기),
  `aiPresets.draft()`(슬래시 메뉴·빈 문서 툴바, 커서 자리에 넣기). `styleGuide: "공통 문구 이름"`으로 문체 가이드를 넣는다.
- **화면 기능**: 관리자 AI 화면의 "새 기능"으로 코드 없이 기능을 만든다. 오른쪽 칸에서 이름·붙을 곳(필드 옆·선택 영역
  메뉴·삽입 메뉴·본문 블록·본문 이미지·미디어)·결과 모양·방식과 연결·지시문·보낼 내용·검사를 함께 고치고, 저장 전에
  시험한 뒤 한 번에 만든다. 관계·선택 필드(태그·카테고리 등)는 판단 방식(System One)도 고른다. DB(`ai_custom_actions`)에 둔다.

## 블록에 붙는 기능 (M9)

`attach: [{ slot: "block", block: "블록 이름" }]`이면 그 블록의 손잡이 옆에 버튼이 생긴다. 블록 원문(MDX, 예: ` ```mermaid … ``` `)을
`block` 입력으로 보내고, 결과(MDX)가 같은 종류의 블록 하나면 바뀐 곳을 보인 뒤 그 블록을 바꾼다. 블록 이름은 사이트가 쓰는
블록이어야 한다(설정을 만들 때 확인한다). 블록 확장이나 사이트 블록 모두 같은 방법으로 붙는다.

```ts
import { mermaidAi } from "@bh2980/cms-blocks/mermaid/ai";

aiPlugin({
	actions: {
		diagramDraft: mermaidAi.draft(), // 슬래시 메뉴: 요청을 받아 커서 자리에 Mermaid 블록을 넣는다
		diagramEdit: mermaidAi.edit(), // Mermaid 블록 손잡이 옆: 요청대로 고친다
		graphvizEdit: aiAction({
			label: "그래프 고치기",
			input: { block: aiInput.mdx({ label: "그래프", required: true }) },
			prompt: "```graphviz 코드 펜스를 요청대로 고친다. 답은 고친 펜스 하나만 쓴다.",
			result: "mdx",
			stream: true,
			askInstruction: true,
			attach: [{ slot: "block", block: "graphviz" }],
		}),
	},
});
```

흘려받은 MDX 결과는 답 전체를 감싼 ` ```mdx ` 펜스만 벗긴다. 블록 원문인 다른 언어의 펜스는 그대로 둔다.

## 진입점

| 진입점 | 내용 |
| --- | --- |
| `@bh2980/cms-ai` | `aiPlugin`, `aiAction`, `aiInput`, `aiPresets` (사이트 설정용, 서버·브라우저 공용) |
| `@bh2980/cms-ai/server` | 서버 쪽(API 경로·표 만들기). 본체가 불러 쓴다. 브라우저 묶음에서는 빈 진입점이다 |
| `@bh2980/cms-ai/admin` | 관리자 쪽(AI 화면·공급자), `useAiAction`, `AiButton` |
