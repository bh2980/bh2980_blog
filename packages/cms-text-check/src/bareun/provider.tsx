"use client";

import { cmsApiUrl } from "@bh2980/cms/client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@bh2980/cms-admin";
import type { ReactNode } from "react";
import { textCheckExtension } from "../extension";
import { remoteTextChecker } from "../index";
import { readBareunOptions } from "./config";
import { BAREUN_CHECKER_ID, BAREUN_ROUTE } from "./options";

const options = readBareunOptions();

/** 바른 검사기. 브라우저는 사이트 서버 경로로 문단만 보낸다(키는 서버가 가진다). */
export const bareunChecker = remoteTextChecker({
	id: BAREUN_CHECKER_ID,
	label: options.label,
	url: cmsApiUrl(`/${BAREUN_ROUTE}`),
	locales: ["ko"],
	auto: options.auto,
	limits: options.limits,
});

const components: CmsAdminComponents = {
	editorExtensions: [textCheckExtension({ checkers: [bareunChecker] })],
};

/** 편집기 도구 모음에 바른 검사 버튼을 넣는다(결과는 물결 밑줄·결과 창). */
export function BareunProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
