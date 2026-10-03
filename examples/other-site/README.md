# 예시 앱: other-site

`@bh2980/cms`를 블로그와 다른 컬렉션(Article·Topic·Author)·필드·언어(영어)로 붙인 최소 Next 앱이다. 블록 확장(`@bh2980/cms-blocks`)에서
차트만 설치하고 사이트 블록(`quote-card`·코드 펜스 `map`)을 더했다. SEO 필드는 SEO 확장(`@bh2980/cms-seo`)의 `seoFields`를
다른 이름·`Search` 탭으로 넣었다. 패키지는 저장소의 소스가 아니라 **빌드한 묶음**(`vendor/*.tgz`)으로 설치한다.

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
