"use client";

import type { ReactNode } from "react";
import type { EntryForm, EntryFormPatch } from "./entry-form";
import { TranslationPairView } from "./translation-pair-view";
import { useTranslationRows } from "./translation-rows";

/**
 * 번역본 편집 화면(v3 §4.2). 제목 위 언어 탭·제목은 그대로 두고, 본문은 원문과 번역을 번역 단위마다 나란히 놓는다.
 * 서식 도구 줄과 MDX 보기는 두지 않는다. 줄을 고치면 번역본 본문과 번역 상태가 폼에 들어가 자동 저장된다.
 */
export function TranslationWorkspace({
	header,
	sourceMdx,
	sourceLocale,
	targetLocale,
	form,
	setForm,
	editable,
	onCompositionStart,
	onCompositionEnd,
}: {
	/** 언어 탭과 제목 입력. */
	header: ReactNode;
	sourceMdx: string;
	sourceLocale: string;
	targetLocale: string;
	form: EntryForm;
	setForm: (patch: EntryFormPatch) => void;
	editable: boolean;
	onCompositionStart?: () => void;
	onCompositionEnd?: () => void;
}) {
	const { rows, sourceError, setTarget, ignoreChange } = useTranslationRows({ sourceMdx, form, setForm });

	return (
		<div
			className="flex min-h-full w-full flex-col bg-background"
			onCompositionStart={onCompositionStart}
			onCompositionEnd={onCompositionEnd}
		>
			<div className="mx-auto w-full max-w-3xl border-border/60 border-b px-4 pt-12 pb-5">{header}</div>
			<TranslationPairView
				rows={rows}
				sourceLocale={sourceLocale}
				targetLocale={targetLocale}
				editable={editable}
				onChangeTarget={setTarget}
				onIgnoreChange={ignoreChange}
				sourceError={sourceError}
			/>
		</div>
	);
}
