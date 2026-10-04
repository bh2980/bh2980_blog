import { createCmsRouteHandler } from "@monti-cms/core/next/route-handler";

/** 관리자 API(`/api/cms/v1/*`)와 공개 API(`v1/public/*`, 서버 설정 `publicApi`로 켠다). */
export const { GET, POST, PATCH, PUT, DELETE } = createCmsRouteHandler();
