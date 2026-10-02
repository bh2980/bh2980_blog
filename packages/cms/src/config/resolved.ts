import config from "@cms-config";
import { unwrapDefault } from "./interop";

/**
 * 호스트 앱의 사이트 설정(`cms.config.ts`)을 읽는 유일한 자리. 앱은 `@cms-config` 별칭을 자기 설정 파일로 잇는다
 * (`withCms`·tsconfig `paths`·테스트 설정). CMS 코드는 설정 파일을 직접 import하지 않고 여기를 거친다.
 *
 * 저작 API(`@bh2980/cms` 진입점)는 이 파일을 import하지 않는다. 설정 파일이 저작 API를 import하므로 순환이 생긴다.
 */
export const cmsConfig = unwrapDefault(config);

export type ResolvedConfig = typeof config;
