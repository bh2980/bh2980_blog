"use client";

import { isCollection } from "@bh2980/cms/client";
import type { ComponentType } from "react";
import { type FieldViewProps, useCmsAdminComponents } from "../../admin-components";
import { SeoPreview } from "./seo-panel";

/** 본체가 주는 보기 필드 화면. 다른 이름은 관리자 확장의 `fieldViews`로 더하거나 바꾼다. */
const BUILTIN_VIEWS: Readonly<Record<string, ComponentType<FieldViewProps>>> = {
	search: ({ collection, form, entry }) =>
		isCollection(collection) ? <SeoPreview collection={collection} form={form} entry={entry} /> : null,
};

/** 보기 필드(`fields.view({ view })`)의 화면. 등록하지 않은 이름이면 아무것도 그리지 않는다. */
export function FieldView({ view, ...props }: FieldViewProps & { view: string }) {
	const { fieldViews } = useCmsAdminComponents();
	const View = fieldViews?.[view] ?? BUILTIN_VIEWS[view];
	return View ? <View {...props} /> : null;
}
