# bh2980.dev

[![Blog](https://img.shields.io/badge/blog-bh2980.dev-0f172a?style=flat-square)](https://bh2980.dev)
![Next.js](https://img.shields.io/badge/Next.js-16.1.1-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.3-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![MDX](https://img.shields.io/badge/MDX-Content-1B1F24?style=flat-square&logo=mdx&logoColor=white)
![Keystatic](https://img.shields.io/badge/Keystatic-CMS-1F6FEB?style=flat-square)

개인 학습 기록과 지식 공유를 위한 기술 블로그 레포지토리입니다.  
Next.js와 Keystatic을 기반으로 콘텐츠 관리 효율성과 구현 제어 범위를 함께 확보하는 방향으로 구성했습니다.

## Tech Stack

| 구분 | 기술 스택 |
| :--- | :--- |
| Framework | Next.js (App Router), React |
| Language | TypeScript |
| CMS | Keystatic |
| Content | MDX, Mermaid |
| Interaction | giscus |
| Metadata | RSS, Sitemap, Open Graph |

## Project Structure


```text
.
├── public
├── src
│   ├── app             # App Router 페이지, RSS, sitemap, OG 이미지
│   ├── components      # UI와 MDX 렌더링 컴포넌트
│   ├── contents        # 게시글, 메모, 태그, 카테고리 원본 데이터
│   ├── keystatic       # 콘텐츠 편집기와 컬렉션 설정
│   ├── libs            # 콘텐츠 조회, MDX, Mermaid 관련 로직
│   └── utils           # 공통 유틸 함수
├── keystatic.config.ts
└── package.json
```

## Content Management

콘텐츠는 성격에 따라 두 계층으로 나뉘어 관리됩니다.

- **게시글 (Posts)**: 비교적 긴 호흡의 기술 문서와 정리 글. 카테고리 기반으로 분류합니다.
- **메모 (Memos)**: 짧은 기록, 문제 해결 메모, 코드 스니펫. 태그 기반으로 탐색합니다.
- **메타 데이터**: 태그, 카테고리, 발행일, OG 이미지, RSS, sitemap 정보를 함께 관리합니다.
- **Admin UI**: Keystatic을 통해 로컬과 원격 환경 모두에서 GUI 기반으로 콘텐츠를 다룰 수 있습니다.

## Key Implementations

- **하이브리드 탐색 구조**: 게시글은 카테고리 기준, 메모는 다중 태그 기준으로 탐색할 수 있도록 분리했습니다.
- **MDX 확장 렌더링**: Mermaid와 커스텀 MDX 컴포넌트를 지원해 글 안에서 표현 범위를 넓혔습니다.
- **커스텀 주석 파서와 에디터 연동**: 코드 블록 주석 정보를 별도 구조로 파싱하고, 이를 Keystatic 코드 블록 에디터와 연결해 편집 흐름 안에서 다룰 수 있게 구성했습니다.
- **콘텐츠 메타 자동화**: RSS, sitemap, Open Graph 이미지와 같은 배포 메타 정보를 코드 레벨에서 함께 생성합니다.
- **콘텐츠 관리 흐름 분리**: 공개 페이지와 별도로 Keystatic 관리 화면 및 preview 흐름을 구성했습니다.
