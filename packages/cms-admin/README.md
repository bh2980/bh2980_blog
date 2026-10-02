# @bh2980/cms-admin

`@bh2980/cms`의 관리자 화면. 설치하면 `/admin` 화면을 통째로 쓸 수 있고, 쓰지 않으면 본체 API로 화면을 직접 만든다.

아직 비어 있다. 블로그 저장소의 아래 코드가 이리로 옮겨 온다.

- `src/app/(admin)/admin` — 관리자 화면
- `src/cms/editor` — tiptap 편집기
- `src/cms/slots` — 입력 옆 AI 버튼 자리
- 위 코드가 쓰는 UI 부품(`src/components/ui/*`)

관리자 화면은 본체의 HTTP API(`/api/cms/v1/*`)만 부른다. API 처리 코드는 본체 패키지가 가진다.
