import { defineConfig } from "@bh2980/cms";
import base from "../../cms/test/cms.config";
import { schedule } from "../src";

/** 본체 패키지의 예시 블로그 설정에 예약 확장을 더한 설정. 이 패키지의 테스트가 쓴다. */
export default defineConfig({
	...base,
	plugins: [schedule({ tokenEnv: "TEST_SCHEDULER_TOKEN" })],
});
