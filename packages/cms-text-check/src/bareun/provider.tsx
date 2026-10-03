"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@bh2980/cms-admin";
import { remoteTextChecker } from "@bh2980/cms-admin/text-check";
import type { ReactNode } from "react";
import { readBareunOptions } from "./config";
import { BAREUN_CHECKER_ID, BAREUN_ROUTE } from "./options";

const options = readBareunOptions();

const components: CmsAdminComponents = {
	textCheckers: [
		remoteTextChecker({
			id: BAREUN_CHECKER_ID,
			label: options.label,
			url: `/api/cms/${BAREUN_ROUTE}`,
			locales: ["ko"],
			auto: options.auto,
			limits: options.limits,
		}),
	],
};

/** 바른 검사기를 편집기의 맞춤법 검사에 넣는다. 브라우저는 사이트 서버 경로로 문단만 보낸다(키는 서버가 가진다). */
export function BareunProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
