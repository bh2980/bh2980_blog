# 예시 앱: other-site

`@bh2980/cms`를 블로그와 다른 컬렉션(Article·Topic)·언어(영어)로 붙인 최소 Next 앱이다. 내장 블록 일부(탭·단·Mermaid)를
끄고 사용자 블록(`quote-card`)을 더했다. 패키지는 저장소의 소스가 아니라 **빌드한 묶음**(`vendor/*.tgz`)으로 설치한다.

```sh
# 저장소 루트에서: 패키지를 빌드해 vendor/에 묶는다
pnpm example:pack

# 이 폴더에서
pnpm install --ignore-workspace
cp .env.example .env.local   # CMS_DATABASE_URL 등을 채운다
pnpm cms:db:migrate
pnpm dev                     # http://localhost:3000/admin
```

`CMS_DEV_AUTH_BYPASS=1`이면 `next dev`에서 로그인 없이 관리자 화면을 연다.
