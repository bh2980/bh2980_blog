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
- 붙을 곳은 관리자 화면의 정해진 자리다(필드 옆·본문 이미지·미디어·코드 블록·번역). 자리가 필수 입력을 채울 수 있어야 한다.
- 관리자 AI 화면에서는 켜기·요청 받기·연결·모델·보낼 입력·지시문·기준값·검사 값만 고친다. 고친 값만 DB(`ai_action_overrides`)에 둔다.
- 실행: `POST /api/cms/v1/ai/run { action, input | inputs, env }`. 관리자 화면에서는 `useAiAction("summary").run({ title, body })`나
  `<AiButton action="summary" input={() => ({ title, body })} onResult={…} />`(`@bh2980/cms-ai/admin`)처럼 이름으로 부르고,
  이름·입력·결과 타입은 설정에서 나온다.
- 판단 방식(`engine: "decide"`, System One)은 선택지(`choices`)마다 확률을 받아 기준 이상만 후보로 낸다.

## 진입점

| 진입점 | 내용 |
| --- | --- |
| `@bh2980/cms-ai` | `aiPlugin`, `aiAction`, `aiInput`, `aiPresets` (사이트 설정용, 서버·브라우저 공용) |
| `@bh2980/cms-ai/server` | 서버 쪽(API 경로·표 만들기). 본체가 불러 쓴다. 브라우저 묶음에서는 빈 진입점이다 |
| `@bh2980/cms-ai/admin` | 관리자 쪽(AI 화면·공급자), `useAiAction`, `AiButton` |
