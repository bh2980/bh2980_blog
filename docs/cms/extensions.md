# CMS 확장 가이드 (Extensions)

이 문서는 코어를 수정하지 않고 필드와 블록을 확장 등록하는 방법(명세 §4.3, F07)을 기술합니다.

---

## 1. 아키텍처 원칙 (Separation of Schema & Component)

- **순수 직렬화 계약**: `/api/cms/v1/meta` 응답에는 오직 직렬화 가능한 JSON 스키마(필드명, 타입, 기본값, 라벨)만 노출됩니다. React 컴포넌트, 렌더러 함수, 클로저는 결코 `/meta` JSON 응답에 포함되지 않습니다.
- **클라이언트 렌더러 분리**: 실제 입력 UI(색상 피커, slug 보조 버튼 등)는 클라이언트 레지스트리에서 필드 타입 식별자(`custom:color` 등)에 매핑되어 지연 바인딩됩니다.

---

## 2. 필드 확장 예제 3종

### 2.1 색상 필드 (Color Field)

16진수 HEX 색상 코드를 저장하는 커스텀 필드입니다.

```ts
import { defineCustomField } from "@/cms/core/extensions-example";

export const colorField = defineCustomField({
  type: "custom:color",
  label: "테마 색상",
  defaultValue: "#3b82f6",
  validate: (val: unknown) => /^#[0-9a-fA-F]{6}$/.test(String(val)),
});
```

### 2.2 Slug 보조 버튼 (Slug Helper Button)

기존 기본 `slug` 입력창 위에 추천 생성 및 검증 액션을 부착하는 확장입니다 (`renderDefault` 패턴).

```ts
import { defineFieldHelper } from "@/cms/core/extensions-example";

export const slugHelper = defineFieldHelper({
  targetField: "slug",
  actionName: "generateFromEnglishTitle",
  label: "영문 번역 생성",
});
```

### 2.3 링크 Object 복합 필드 (Link Object Field)

URL과 텍스트 라벨을 하나의 구조화된 객체로 저장하는 복합 필드입니다.

```ts
import { defineObjectField } from "@/cms/core/extensions-example";

export const linkObjectField = defineObjectField({
  type: "custom:link",
  label: "관련 외부 링크",
  properties: {
    url: { type: "string", required: true },
    label: { type: "string", required: true },
    targetBlank: { type: "boolean", defaultValue: true },
  },
});
```

---

## 3. 블록 확장 예제 (Custom Block)

### 3.1 코드 Fence 커스텀 블록

Tiptap 및 MDX에서 사용할 수 있는 특수 코드 펜스 블록 정의입니다.

```ts
import { defineCustomBlock } from "@/cms/core/extensions-example";

export const calloutBlock = defineCustomBlock({
  name: "Callout",
  component: "Callout",
  props: {
    type: { type: "string", options: ["info", "warning", "tip"], default: "info" },
    title: { type: "string", optional: true },
  },
  hasChildren: true,
});
```

---

## 4. 검증 및 보안

- 저장 시 JSON 바이트 상한(메타데이터 256KB)을 준수합니다.
- 서버 컴파일 시 허용되지 않은 임의의 JSX 실행은 차단되며 허용된 컴포넌트 화이트리스트만 MDX 렌더러에 공급됩니다.

---

## 5. 공개 반영 (Public Projection)

필드를 추가할 때 **어디까지 공개로 내보낼지**에 따라 손대는 곳이 다릅니다. 저장만 하려면 한 곳, 공개 API까지 내보내려면 네 곳입니다.

| 목적 | 손대는 곳 |
| --- | --- |
| 저장만 (관리자 전용) | `src/cms/core/collections.ts`의 해당 컬렉션 `fields` |
| 공개 metadata로 내보내기(아카이브·이전) | `src/cms/services/export-service.ts`의 `PUBLIC_METADATA_KEYS` |
| 블로그 head·sitemap에 반영 | `src/libs/contents/seo.ts`(해석) + `src/libs/contents/repositories/postgres.ts`(도메인 매핑) + 해당 페이지 `generateMetadata` |
| 공개 HTTP API 응답에 반영 | `src/libs/contents/public-api.ts`의 `PublicEntryDto`와 매퍼 |

주의할 점:

- `COLLECTION_DEFINITIONS`에 없는 키는 `content-service`가 `invalid_metadata_key`로 **저장을 거부**합니다.
- `PUBLIC_METADATA_KEYS`에 없는 키는 공개 아카이브에서 조용히 빠집니다(관리자 아카이브에는 남습니다).
- 공개 HTTP 응답은 `PublicEntryDto`로만 직렬화하세요. 도메인 타입을 그대로 내보내면 나중에 관리자 필드가 따라 나갈 수 있습니다.
- 공개 DTO·allowlist를 바꾸면 계약 테스트(`src/libs/contents/__test__/public-api.test.ts`, `src/cms/services/__test__/export-service.test.ts`)를 함께 갱신하세요.
- 새 경로를 만들면 `docs/cms/openapi.yaml`을 갱신해야 합니다. `src/cms/__test__/openapi-contract.test.ts`가 문서와 실제 라우트 목록을 비교합니다.

