# CMS Content Inventory (M0-INV-3, 읽기 전용)

- 생성: 2026-09-16, 브랜치 cms/wt/Junior-m0. Lead가 파일 수·이슈 후보를 재집계해 병합함
- 범위: src/contents posts/memos MDX + categories/tags/collections YAML (읽기만, DB 미접촉)
- 검증: find src/contents -name '*.mdx' | wc -l = 49 (post 7 + memo 42)

## 개수 요약

| 구분 | 수 |
|---|---|
| posts | 7 |
| memos | 42 |
| MDX 합계 | 49 |
| categories YAML | 3 (development, essay, review) |
| tags YAML | 22 |
| collections YAML | 1 (type-challenges, memo 22개 참조) |

## 관계/이슈 요약

- publishedDateTimeISO: 49/49 보유 (날짜 없음 0). 단 memos/js의-비동기-처리-메커니즘.mdx는 status 필드 없음.
- 빈 tags: memos/533-concat.mdx (tags: []) 1건.
- category: posts 7개만 보유 (development 5, essay 2). memos 42개는 category 없음 (기존 패턴).
- 상대 이미지(/assets/...): 5개 파일 22장. memos/정규표현식-정리 8장, posts/블로그라면-seo는-해봐야지 8장, posts/블로그를-검색하는-벡터-rag-만들기 2장, posts/왜-내-블로그는-ssg가-안될까 2장, posts/코드-블럭에-툴팁을-띄우고-싶었을-뿐인데 2장. 22장 모두 alt="" 빈 alt.
- 외부 이미지 ![](http...): 0건 (외부 URL은 일반 마크다운 링크로만 존재, 이미지 아님).
- 표(마크다운 테이블): 4개 파일 — posts/내가-만든-rag의-성능-측정하기, memos/정규표현식-정리, memos/load-file, memos/download-file. (memos/43-exclude.mdx의 `|` 행은 코드블럭 내 TS 조건식이라 제외.)
- 수식($$ ... $$): 2개 파일 — posts/블로그를-검색하는-벡터-rag-만들기, memos/js의-비동기-처리-메커니즘.
- JSX: Collapsible 34개 파일, Tooltip 8, Callout 6, Tabs/Tab 3, Columns/Column 1 (Tabs·Columns는 posts 3종에 집중: 블로그라면-seo는-해봐야지, 왜-내-블로그는-ssg가-안될까, 코드-블럭에-툴팁을-띄우고-싶었을-뿐인데). 요약 숫자는 파일별 표와 일치시킴.

## 파일별 표

| 파일 | slug | 구분 | date | 카테고리 | 이미지 | 표 | 수식 | JSX | 이슈후보 |
|---|---|---|---|---|---|---|---|---|---|
| src/contents/memos/1-implement-curry.mdx | 1-implement-curry | memo | 2026-01-07 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/10-tuple-to-union.mdx | 10-tuple-to-union | memo | 2026-01-05 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/106-trim-left.mdx | 106-trim-left | memo | 2026-01-07 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/108-trim.mdx | 108-trim | memo | 2026-01-12 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/11-tuple-to-object.mdx | 11-tuple-to-object | memo | 2026-01-04 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/11-what-is-composition-create-a-pipe.mdx | 11-what-is-composition-create-a-pipe | memo | 2026-01-07 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/110-capitalize.mdx | 110-capitalize | memo | 2026-01-12 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/12-chainable-options.mdx | 12-chainable-options | memo | 2026-01-05 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/14-first-of-array.mdx | 14-first-of-array | memo | 2026-01-04 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/15-implement-a-simple-dom-wrapper-to-support-method-chaining-like-jquery.mdx | 15-implement-a-simple-dom-wrapper... | memo | 2026-01-07 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/15-last-of-array.mdx | 15-last-of-array | memo | 2026-01-05 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/16-pop.mdx | 16-pop | memo | 2026-01-05 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/167-intersection-of-unsorted-arrays.mdx | 167-intersection-of-unsorted-arrays | memo | 2026-01-12 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/18-improve-a-function.mdx | 18-improve-a-function | memo | 2026-01-09 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/18-length-of-tuple.mdx | 18-length-of-tuple | memo | 2026-01-04 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/189-awaited.mdx | 189-awaited | memo | 2026-01-04 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/2-get-return-type.mdx | 2-get-return-type | memo | 2026-01-05 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/20-promiseall.mdx | 20-promiseall | memo | 2026-01-06 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/268-if.mdx | 268-if | memo | 2026-01-04 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/28-implement-clearalltimeout.mdx | 28-implement-clearalltimeout | memo | 2026-01-09 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/3-omit.mdx | 3-omit | memo | 2026-01-05 | — | 0 | — | — | Collapsible,Tooltip | — |
| src/contents/memos/3057-push.mdx | 3057-push | memo | 2026-01-05 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/3060-unshift.mdx | 3060-unshift | memo | 2026-01-05 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/3312-parameters.mdx | 3312-parameters | memo | 2026-01-05 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/4-pick.mdx | 4-pick | memo | 2026-01-04 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/43-exclude.mdx | 43-exclude | memo | 2026-01-04 | — | 0 | — | — | Collapsible | 코드블럭 `|` 있음(표 아님) |
| src/contents/memos/533-concat.mdx | 533-concat | memo | 2026-01-04 | — | 0 | — | — | Collapsible | 빈tags |
| src/contents/memos/6-implement-basic-debounce.mdx | 6-implement-basic-debounce | memo | 2026-01-07 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/62-type-lookup.mdx | 62-type-lookup | memo | 2026-01-07 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/7-readonly.mdx | 7-readonly | memo | 2026-01-04 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/8-can-you-shuffle-an-array.mdx | 8-can-you-shuffle-an-array | memo | 2026-01-07 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/8-readonly-2.mdx | 8-readonly-2 | memo | 2026-01-05 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/898-includes.mdx | 898-includes | memo | 2026-01-04 | — | 0 | — | — | Collapsible | — |
| src/contents/memos/9-deep-readonly.mdx | 9-deep-readonly | memo | 2026-01-05 | — | 0 | — | — | Tooltip | — |
| src/contents/memos/download-file.mdx | download-file | memo | 2025-08-07 | — | 0 | O | — | — | — |
| src/contents/memos/js의-데이터-타입-및-메모리-관리.mdx | js의-데이터-타입-및-메모리-관리 | memo | 2026-04-06 | — | 0 | — | — | Callout | — |
| src/contents/memos/js의-비동기-처리-메커니즘.mdx | js의-비동기-처리-메커니즘 | memo | 2026-04-11 | — | 0 | — | O | Callout,Tooltip | status없음 |
| src/contents/memos/js의-코드-실행-메커니즘.mdx | js의-코드-실행-메커니즘 | memo | 2026-04-03 | — | 0 | — | — | Callout,Tooltip | — |
| src/contents/memos/load-file.mdx | load-file | memo | 2025-08-07 | — | 0 | O | — | — | — |
| src/contents/memos/tuple과-readonly.mdx | tuple과-readonly | memo | 2026-01-06 | — | 0 | — | — | — | — |
| src/contents/memos/xxx-equal.mdx | xxx-equal | memo | 2026-01-04 | — | 0 | — | — | Callout,Collapsible,Tooltip | — |
| src/contents/memos/정규표현식-정리.mdx | 정규표현식-정리 | memo | 2026-01-06 | — | 8 | O | — | — | 빈alt 8/8, 상대이미지 8 |
| src/contents/posts/ai가-뱉어낸-코드의-숲에서-길을-잃지-않으려면.mdx | ai가-뱉어낸-코드의-숲에서-길을-잃지-않으려면 | post | 2026-03-17 | essay | 0 | — | — | Tooltip | — |
| src/contents/posts/내가-만든-rag의-성능-측정하기.mdx | 내가-만든-rag의-성능-측정하기 | post | 2026-04-10 | development | 0 | O | — | Callout | — |
| src/contents/posts/블로그라면-seo는-해봐야지.mdx | 블로그라면-seo는-해봐야지 | post | 2026-02-13 | development | 8 | — | — | Callout,Columns,Column,Tabs,Tab,Tooltip | 빈alt 8/8, 상대이미지 8 |
| src/contents/posts/블로그를-검색하는-벡터-rag-만들기.mdx | 블로그를-검색하는-벡터-rag-만들기 | post | 2026-04-08 | development | 2 | — | O | — | 빈alt 2/2, 상대이미지 2 |
| src/contents/posts/블로그를-다시-만들면서.mdx | 블로그를-다시-만들면서 | post | 2026-01-02 | essay | 0 | — | — | — | — |
| src/contents/posts/왜-내-블로그는-ssg가-안될까.mdx | 왜-내-블로그는-ssg가-안될까 | post | 2026-03-18 | development | 2 | — | — | Tabs,Tab | 빈alt 2/2, 상대이미지 2 |
| src/contents/posts/코드-블럭에-툴팁을-띄우고-싶었을-뿐인데.mdx | 코드-블럭에-툴팁을-띄우고-싶었을-뿐인데 | post | 2026-03-21 | development | 2 | — | — | Tabs,Tab,Tooltip | 빈alt 2/2, 상대이미지 2 |
