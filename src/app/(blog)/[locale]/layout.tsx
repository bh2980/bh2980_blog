import type { ReactNode } from "react";
import { type LocaleParams, prefixedLocale } from "./locale-param";

/** 언어 접두사 주소의 뿌리(v2 B4). 알 수 없는 언어는 여기서 404로 끝낸다. */
export default async function LocaleLayout({ children, params }: LocaleParams & { children: ReactNode }) {
	prefixedLocale((await params).locale);
	return children;
}
