# CMS 확장 현황

이 문서는 현재 구현된 확장 메타데이터와 한계를 설명합니다. F07 범용 필드·블록 확장 API는 v1 범위가 아니며 [`CMS-SPEC.md` §8](../../CMS-SPEC.md)에 v2 검토 메모로 남겨두었습니다.

## 현재 상태

**컬렉션 필드는 v2 B1부터 코드 한 곳에서 정의합니다.** [`src/cms/schema/definitions.ts`](../../src/cms/schema/definitions.ts)의 `collection({ fields: { title: fields.text(...), ... } })` 정의 하나에서 타입, 서버 검증·저장, 속성 패널 입력, 목록 컬럼, 관계 참조 추적을 만듭니다. 입력을 바꾸려면 필드에 `input: "이름"`을 적고 [`field-inputs.tsx`](../../src/app/(admin)/admin/entries/field-inputs.tsx)의 입력 등록부에 컴포넌트를 둡니다. 자세한 규칙은 [`docs/cms/v2/b1-schema.md`](./v2/b1-schema.md)에 있습니다.

아래 `/meta`의 `extensions` 예제와 블록 확장은 아직 v1 상태이며, 블록은 v2 B3에서 정의 규격으로 바꿉니다.

**v1에는 범용 필드·블록 등록 API가 없습니다.** 저장소에는 `defineCustomField`, `defineFieldHelper`, `defineObjectField`, `defineCustomBlock` 같은 등록 함수나 실행 중인 확장 레지스트리가 없습니다. 기존 문서에 있던 해당 import 예제는 실제 API가 아니어서 제거했습니다.

현재 구현은 [`src/cms/core/extensions-example.ts`](../../src/cms/core/extensions-example.ts)에 정적 예제 네 개를 정의하고, 관리자 인증이 필요한 `GET /api/cms/v1/meta`에서 JSON으로 제공합니다.

- `colorFieldExample`: 색상 필드 메타데이터와 서버 코드의 검증 예제
- `slugHelperExample`: slug 입력 보조 동작 예제
- `linkObjectFieldExample`: 링크 객체 필드 메타데이터
- `calloutBlockExample`: 블록 메타데이터 예제

`getSerializableExtensionsSchema()`는 `validate`와 `onAction` 같은 함수를 응답에서 제외합니다. 이 메타데이터를 추가해도 컬렉션 편집 UI, 저장 검증, DB 저장, MDX 변환에 자동 등록되지는 않습니다. 실제 저장 필드는 [`src/cms/core/collections.ts`](../../src/cms/core/collections.ts)의 정적 정의를 따릅니다.

## API 응답 형태

`GET /api/cms/v1/meta`는 인증된 관리자에게 `version`, `collections`, `definitions`, `extensions`, `features`를 반환합니다. `extensions`는 아래와 같은 직렬화 가능한 예제 목록입니다.

```json
{
  "fields": [
    { "type": "custom:color", "label": "테마 색상", "defaultValue": "#3b82f6" },
    {
      "type": "custom:link",
      "label": "관련 링크",
      "properties": {
        "url": { "type": "string", "required": true },
        "label": { "type": "string", "required": true },
        "targetBlank": { "type": "boolean", "defaultValue": true }
      }
    }
  ],
  "helpers": [
    { "targetField": "slug", "actionName": "translateAndSlugify", "label": "영문 자동 생성" }
  ],
  "blocks": [
    {
      "name": "Callout",
      "component": "Callout",
      "props": {
        "type": { "type": "string", "options": ["info", "warning", "tip"], "default": "info" },
        "title": { "type": "string", "optional": true }
      },
      "hasChildren": true
    }
  ]
}
```

정확한 응답은 `src/cms/core/extensions-example.ts`와 [`docs/cms/openapi.yaml`](./openapi.yaml)을 기준으로 확인합니다. OpenAPI 계약 테스트는 `/meta`를 포함한 라우트 목록을 검사합니다.

## 서로 다른 확장 지점

- **저장할 컬렉션 필드:** `src/cms/schema/definitions.ts`만 고칩니다. 공개 블로그에 보이려면 공개 템플릿은 따로 고칩니다.
- **MDX 지시자:** `src/cms/mdx/directives.ts`, 편집기 변환, 공개 렌더러와 검증 테스트가 별도 계약을 이룹니다. 지시자 목록에 추가하는 것만으로 범용 필드가 등록되지는 않습니다.
- **`/meta` 예제:** `extensions-example.ts`만 바꾸면 직렬화된 설명 데이터가 바뀝니다. 입력 UI나 저장 기능은 바뀌지 않습니다.

v2에서 F07을 구현하기로 결정하면 필드·블록 정의를 실제 편집기와 서버 검증/저장 경로에 연결하고, 입력→저장→재열기 및 MDX 왕복 테스트를 추가해야 합니다.

## 보안과 공개 반영

- `/meta`는 관리자 인증 뒤에만 반환됩니다. 클라이언트로 전달하는 값은 JSON 직렬화 가능한 데이터뿐이어야 합니다.
- 공개 메타데이터에는 `src/cms/services/export-service.ts`의 `PUBLIC_METADATA_KEYS`와 공개 DTO allowlist를 적용합니다. 관리자 전용 필드를 공개 응답에 그대로 전달하지 마세요.
- API 경로를 추가하거나 변경하면 [`docs/cms/openapi.yaml`](./openapi.yaml)과 `src/cms/__test__/openapi-contract.test.ts`를 함께 갱신합니다.
- 사용자 정의 React 컴포넌트나 함수를 JSON 메타데이터 응답에 넣지 마세요.

## 개발 참고

`CMS-SPEC.md` §8은 v2 검토 범위를 기록합니다. 위 동작을 v1 완료 조건이나 현재 사용할 수 있는 API로 간주하지 마세요.
