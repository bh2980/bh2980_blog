import { defineConfig } from "@bh2980/cms";
import base from "../../cms/test/other-site.config";
import { aiPlugin } from "../../cms-ai/src";
import { seo } from "../src";

/** 본체 패키지의 다른 사이트 설정(SEO 필드 이름 `metaTitle`… · `Search` 탭)에 SEO·AI 플러그인을 더한 설정. */
export default defineConfig({
	...base,
	plugins: [seo(), aiPlugin({ siteDescription: "Example site" })],
});
