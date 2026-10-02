import { createCmsRouteHandler } from "@bh2980/cms/next/route-handler";

/** 관리자 API(`/api/cms/v1/*`). 공개 API(`v1/public/*`)는 이 블로그의 라우트 파일이 먼저 받는다. */
export const { GET, POST, PATCH, PUT, DELETE } = createCmsRouteHandler();
