# CMS v2 — B1. 중앙 스키마 작업 계획

작성일: 2026-09-27 · 상태: **구현 완료(2026-09-27)** · 브랜치: `feature/cms-v2`

> v2 범위는 [`CMS-V2-SPEC.md`](../../../CMS-V2-SPEC.md) §3.1에 있다. 이 문서는 B1의 구체적인 설계와 작업 순서다.

## 1. 지금 상태 (2026-09-27 조사)

필드 하나를 더하려면 아래를 모두 고쳐야 한다.

| 위치 | 하는 일 |
| --- | --- |
| `src/cms/core/collections.ts` | 필드 이름과 저장 형식(`string`·`string[]`), 관계 목록 |
| `src/cms/core/types.ts` | 컬렉션별 메타데이터 타입(`PostMetadata` 등) |
| `src/cms/core/snapshot.ts` | 값 검증(정책 값, 날짜, UUID), 참조 수집, 발행 필수값(제목·카테고리) |
| `admin/entries/entry-form.ts` | 폼 모양, 메타데이터 ↔ 폼 변환, 빈 값 지우기 규칙 |
| `admin/entries/inspector-panel.tsx` | 필드마다 직접 쓴 입력 UI(677줄) |
| `admin/list-columns.ts` | 목록 컬럼·필터 표, 컬렉션별 쓸 수 있는 컬럼 |
| `admin/record-dialog.tsx` | 카테고리·태그·모음집 폼 |

## 2. 설계

### 2.1 파일

```
src/cms/schema/
  fields.ts        fields.* 빌더와 필드 타입
  collection.ts    collection() 빌더, 레이아웃·목록 설정 타입
  definitions.ts   게시글·메모·카테고리·태그·모음집 정의(이 저장소의 스키마)
  derive.ts        정의에서 저장 필드 목록, 서버 검증, 참조 수집, 발행 필수값, 폼 변환을 만든다
src/app/(admin)/admin/entries/schema-fields.tsx   정의를 읽어 속성 패널 입력을 그린다
src/app/(admin)/admin/entries/field-inputs.tsx    입력 등록부(이름 → 컴포넌트)
```

### 2.2 필드 종류

| 빌더 | 저장 | 기본 입력 | 주요 옵션 |
| --- | --- | --- | --- |
| `fields.text` | 문자열 | 한 줄·여러 줄 | `multiline`, `max`, `placeholder` |
| `fields.slug` | `entries.working_slug`(메타데이터 아님) | 한 줄 + `제목에서` | `from` |
| `fields.relation` | UUID 또는 UUID 배열 | 한 개: 선택/검색, 여러 개: 다중 선택 | `to`, `many`, `createInline`, `publishedOnly`, `allowUnpublished` |
| `fields.datetime` | ISO 문자열 | 서울 시간 `datetime-local` | `pastOnly` |
| `fields.select` | 문자열(옵션 중 하나) | 선택 | `options`, `defaultValue` |
| `fields.conditional` | 선택 값 + 선택에 딸린 필드 | 선택 + 딸린 입력 | 두 번째 인자 `{ 값: { 필드 } }` |

모든 필드의 공통 옵션: `label`, `description`, `required`(`true`는 항상, `"publish"`는 발행 때만), `localized`(B4), `actions`, `input`(입력 교체), `hidden`(저장만 하고 입력을 그리지 않음).

### 2.3 규칙

- **스키마는 직렬화할 수 있는 값만 가진다.** 함수·React 컴포넌트·비밀 값을 넣지 않는다. `input`·`actions`는 이름만 적고, 구현은 클라이언트 입력 등록부와 서버 액션 등록부(D1)에 둔다. 테스트가 JSON 왕복으로 확인한다.
- **저장 형식은 바꾸지 않는다.** 메타데이터 키·값 모양·해시가 v1과 같아서 기존 데이터를 다시 옮길 필요가 없다.
- **빈 값 규칙:** 필수 텍스트(제목)는 입력 그대로 저장하고, 선택 텍스트는 앞뒤 공백을 지운 뒤 비면 키를 지운다. 선택(`select`)은 기본값이면 새로 쓰지 않되 이미 저장된 값은 갱신한다. 조건부 필드에 딸린 값은 조건이 맞을 때만 남긴다.
- **발행 필수값의 문제 코드:** 새 필드는 `missing_field`(`path`=필드 이름)다. v1 API가 쓰던 `missing_title`·`missing_category`는 그 필드에서 그대로 낸다.
- **관계:** `to`가 참조 종류와 기대 컬렉션을 정한다(`category`→category, `tag`→tag, `post`→entry). `allowUnpublished`는 모음집 `itemIds`처럼 공개되지 않은 대상을 허용하고, 다른 컬렉션 대상은 `invalid_item_collection`으로 알린다.
- **상태는 필드가 아니다.** 초안·발행·보관·휴지통은 발행 흐름이 관리한다.
- **목록:** `list.columns`가 기본 표시 컬럼이다. 쓸 수 있는 컬럼은 시스템 컬럼(상태·주소·생성일·수정일·폴더)과 정의에 있는 필드에서 만든다. 컬럼 필터는 필드 종류에서 정한다(관계→체크 목록, 날짜→날짜 범위). 목록 API의 필터 매개변수는 v1 그대로다.
- **`/meta`**는 `schemas`(직렬화한 정의)를 함께 돌려준다. 기존 `definitions`는 정의에서 만들어 모양을 유지한다.

## 3. 작업 순서

1. `fields.ts`·`collection.ts`·`definitions.ts`를 만들고, 기존 `COLLECTION_DEFINITIONS`와 메타데이터 타입을 정의에서 만든다.
2. `snapshot.ts`의 메타데이터 검증·참조 수집·발행 필수값을 `derive.ts`로 옮긴다. 기존 서비스·저장소 테스트가 그대로 통과해야 한다.
3. 폼 변환(`entry-form.ts`)과 속성 패널을 정의에서 그린다. 편집 화면 테스트를 갱신한다.
4. 목록 컬럼 표와 record 대화상자를 정의에서 만든다.
5. `/meta` `schemas`, OpenAPI·계약 테스트, 문서를 갱신한다.

## 4. 완료 조건

- 필드를 더할 때 `definitions.ts`만 고치면 타입·서버 검증·저장·속성 패널 입력·목록 컬럼·참조 추적이 동작한다(공개 화면에 보이려면 공개 템플릿을 따로 고친다).
- 기존 저장 데이터를 그대로 읽고 쓴다. 전체 테스트·타입 검사·Biome·빌드가 통과한다.
- 편집 화면·record 대화상자를 브라우저에서 확인한다.

## 5. 구현 결과 (2026-09-27)

| 항목 | 결과 |
| --- | --- |
| 정의 | `src/cms/schema/definitions.ts`에 게시글·메모·카테고리·태그·모음집. `COLLECTION_DEFINITIONS`(v1 모양)와 `PostMetadata` 등 메타데이터 타입은 여기서 만든다 |
| 서버 | `snapshot.ts`의 허용 키·값 규칙(정책 값, 날짜, UUID, 글자 수), 참조 수집, 발행 필수값, 관계 대상 검사를 `derive.ts`가 정의에서 만든다. 저장 형식·해시·오류 코드는 v1과 같다 |
| 편집 화면 | `schema-fields.tsx`가 배치 묶음(기본·분류·발행·SEO)을 그린다. SEO처럼 `collapsed` 묶음은 값이나 발행 문제가 없을 때만 접는다. 요약은 입력 등록부의 `auto-summary`, 대체 글은 게시글 대상 한 개 관계(`EntryPicker`) |
| 폼 | `EntryForm`은 제목·주소·본문 + 필드 이름을 키로 한 평평한 값이다(발행일은 2026-10-02부터 필드가 아니다). 변환 규칙은 `entry-form.ts` 한 곳 |
| record 대화상자 | 카테고리·태그·모음집도 같은 렌더러를 쓴다. 모음집 항목은 순서 있는 여러 개 관계(`OrderedEntryList`) |
| 목록 | `columnsFor`가 정의의 필드와 `list.columns`에서 컬럼을 만든다. 필드 컬럼은 목록 API가 아는 것(제목·주소·카테고리·태그·발행일)만 된다 |
| `/meta` | `schemas`를 추가했다. OpenAPI 갱신 |

**계획과 다르게 한 것.**

- `required`는 `"publish"`만 둔다. record 컬렉션은 저장이 곧 발행이라 `true`와 구분할 일이 없었다.
- 태그·카테고리 선택지 훅(`useTaxonomy`)을 record 컬렉션 전체(모음집 포함)로 넓혔다. B2의 "없으면 바로 만들기" 일반화가 이 위에서 동작한다.
- OG 이미지(`ogImageId`)는 `hidden`으로 두었다. 저장·내보내기는 되지만 입력 UI와 head 반영은 아직 없다(v1과 같음).

**검증.** 스키마 테스트(JSON 왕복, v1 모양, 검증·참조·필수값, 폼 변환, 타입 추론) 추가. 타입 검사·Biome·전체 테스트 통과. 격리 스키마(`cms_m6_v2b`)에서 편집 화면의 묶음 배치, 정책 → 대체 글 조건부 입력, 자동 저장 후 메타데이터(조건이 풀리면 대체 글 삭제), 모음집 대화상자의 항목 추가·순서 변경·저장을 브라우저로 확인했다.
