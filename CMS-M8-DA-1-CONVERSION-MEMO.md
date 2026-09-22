# CMS M8-DA-1 변환 메모 (레거시 JSX → directive)

**성격:** 나중에 되짚어야 할 때 보는 기록이다. 결정 로그(`CMS-V1-IMPLEMENTATION-PLAN.md` §계획 변경)와 M8-DA-1 본문을 보완하며, 변환을 되돌리거나 M9 이관을 준비할 때 먼저 읽는다.

## 결정

- **2026-09-22 사용자 결정(a): 변환 결과를 `src/contents`에 커밋한다.**

## 왜 (a)로 갔나

- 저장 형식을 directive 하나로 만든다(`CMS-SPEC.md` §4.4).
- M9의 `src/cms/migrate-from-files` 이관 입력이 그대로 준비된다 — 이관 시점에 다시 변환하지 않는다.
- M8-ED-2(저장 왕복)와 M8-TW-1(폐기 이름 제거)을 **실제 directive 파일 위에서** 검증한다. 커밋하지 않으면 합성 fixture로만 검증하게 된다.

## 왜 위험한가 — 순서를 어기면 조용히 사라진다

- **directive를 처리하지 않는 파이프라인은 아무것도 출력하지 않는다.** micromark 문서: "If directives are not handled, they do not emit anything". 파일만 먼저 바꾸면 공개 글이 조용히 비어 보이고, 오류도 나지 않는다.
- 공개 경로: `src/contents`의 MDX → `src/components/mdx/mdx-content.tsx`의 `compileMDX` 체인(Keystatic 경로, M9까지 유지).
- 그래서 순서를 **읽기(렌더러 M8-FE-1·FE-2) → 파일 변환(M8-DA-1) → 쓰기(M8-ED-2)** 로 고정한다. M8-DA-1의 선행은 M8-FE-1이다.

## 무엇을 바꾸나

- 대상 **45편**(posts 6, memos 39). 컴포넌트 기준으로는 **43편**이고(계획서 숫자와 일치), 컴포넌트 없이 `<u>`만 쓰는 **2편**이 더 있다 — `memos/정규표현식-정리.mdx`, `posts/블로그를-검색하는-벡터-rag-만들기.mdx`. 전체 목록은 아래 "대상 45편"에 있다.
- `<u>`는 Tiptap StarterKit의 `underline` mark에 대응한다. **추가 설치가 필요 없다**(StarterKit v3에 포함). 저장은 `:u[...]`.
- 산문의 `<u>` 38쌍 → `:u[...]`.
- `<IdeographicSpace />` 6곳(4편)은 **삭제**하고 레지스트리에서도 뺀다.
- 코드·머메이드 펜스 안의 `<br/>`(12건)·`<div>`(3건)는 변환 대상이 아니다(펜스 안이라 산문이 아님).
- 산문의 `:free를`·`:1로` 2건은 **본문을 고치지 않는다.** 등록된 이름만 지시자로 인식하는 규칙이 자동으로 해결한다(이스케이프 불필요).
- `&#x20;`(공백 인코딩) 35건은 `IdeographicSpace`와 같은 범주지만 v1에서 건드리지 않고 기록만 남긴다.

## 대상 45편

실측 스크립트: `.pi/legacy-scan.mjs`(gitignore 대상이라 저장소에는 없다). 산문의 코드 펜스·인라인 코드 안은 제외했다 — `<br/>` 12건·`<div>` 3건이 변환 대상이 아닌 이유다.

총 45편 (posts 6, memos 39)

### posts
- `posts/ai가-뱉어낸-코드의-숲에서-길을-잃지-않으려면.mdx` — Tooltip
- `posts/내가-만든-rag의-성능-측정하기.mdx` — Callout, IdeographicSpace, u
- `posts/블로그라면-seo는-해봐야지.mdx` — Callout, Column, Columns, IdeographicSpace, Tab, Tabs, Tooltip, u
- `posts/블로그를-검색하는-벡터-rag-만들기.mdx` — u
- `posts/왜-내-블로그는-ssg가-안될까.mdx` — Tab, Tabs, u
- `posts/코드-블럭에-툴팁을-띄우고-싶었을-뿐인데.mdx` — Tab, Tabs, Tooltip, u

### memos
- `memos/1-implement-curry.mdx` — Collapsible
- `memos/10-tuple-to-union.mdx` — Collapsible
- `memos/106-trim-left.mdx` — Collapsible
- `memos/108-trim.mdx` — Collapsible
- `memos/11-tuple-to-object.mdx` — Collapsible
- `memos/11-what-is-composition-create-a-pipe.mdx` — Collapsible
- `memos/110-capitalize.mdx` — Collapsible
- `memos/12-chainable-options.mdx` — Collapsible
- `memos/14-first-of-array.mdx` — Collapsible
- `memos/15-implement-a-simple-dom-wrapper-to-support-method-chaining-like-jquery.mdx` — Collapsible
- `memos/15-last-of-array.mdx` — Collapsible
- `memos/16-pop.mdx` — Collapsible
- `memos/167-intersection-of-unsorted-arrays.mdx` — Collapsible
- `memos/18-improve-a-function.mdx` — Collapsible
- `memos/18-length-of-tuple.mdx` — Collapsible
- `memos/189-awaited.mdx` — Collapsible
- `memos/2-get-return-type.mdx` — Collapsible
- `memos/20-promiseall.mdx` — Collapsible
- `memos/268-if.mdx` — Collapsible
- `memos/28-implement-clearalltimeout.mdx` — Collapsible
- `memos/3-omit.mdx` — Collapsible, Tooltip, u
- `memos/3057-push.mdx` — Collapsible
- `memos/3060-unshift.mdx` — Collapsible
- `memos/3312-parameters.mdx` — Collapsible
- `memos/4-pick.mdx` — Collapsible
- `memos/43-exclude.mdx` — Collapsible
- `memos/533-concat.mdx` — Collapsible
- `memos/6-implement-basic-debounce.mdx` — Collapsible, u
- `memos/62-type-lookup.mdx` — Collapsible
- `memos/7-readonly.mdx` — Collapsible
- `memos/8-can-you-shuffle-an-array.mdx` — Collapsible
- `memos/8-readonly-2.mdx` — Collapsible
- `memos/898-includes.mdx` — Collapsible
- `memos/9-deep-readonly.mdx` — Tooltip
- `memos/js의-데이터-타입-및-메모리-관리.mdx` — Callout, IdeographicSpace, u
- `memos/js의-비동기-처리-메커니즘.mdx` — Callout, Tooltip, u
- `memos/js의-코드-실행-메커니즘.mdx` — Callout, Tooltip, u
- `memos/xxx-equal.mdx` — Callout, Collapsible, IdeographicSpace, Tooltip
- `memos/정규표현식-정리.mdx` — u

## 되돌리는 방법

- 변환은 **한 커밋**으로 만든다(변환과 무관한 정리를 섞지 않는다). 커밋 SHA를 아래 "실행 기록"에 적는다.
- 되돌리기: `git revert <변환커밋>`.
- **주의:** M8-TW-1에서 레지스트리의 폐기 이름(`ContentLink`, `IdeographicSpace`)을 지운 **뒤에** 되돌리면 되돌린 JSX 파일이 발행 검사에서 막힌다. 폐기 이름 제거도 함께 되돌려야 한다.
- 변환 전 상태를 보고 싶으면 `refs/backup/pre-noreply/feature/new-cms`를 쓴다. **히스토리 재작성 이전 스냅샷이라 해시 체계가 다르다** — 내용 비교용으로만 쓰고 cherry-pick 하지 않는다.

## 파생 의존

- M8-TW-1의 **폐기 이름 제거는 M8-DA-1 뒤**에 한다. 먼저 지우면 레거시 본문이 발행 검사에서 막힌다.
- M9에서 Keystatic을 제거한 뒤 `src/contents` 파일을 남길지는 **미정**이다(별도 결정). 남기지 않더라도 변환 결과는 이관 입력으로 쓰이므로 (a) 결정은 낭비가 아니다.

## 실행 기록

| 항목 | 값 |
|---|---|
| 변환 커밋 | (M8-DA-1 착수 시 기록) |
| 변환 편수 | (확정 시 기록) |
| 전후 HTML 대조 | (M8-DA-1 검증 시 기록) |

## 확인 명령

```bash
pnpm test:run    # 코퍼스 왕복 회귀
pnpm typecheck
```
