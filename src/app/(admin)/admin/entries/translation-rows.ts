"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type AlignedUnit,
	alignUnits,
	buildTranslatedDoc,
	flattenUnits,
	ignoreChange,
	toStoredUnits,
	withTarget,
} from "@/cms/core/translation/units";
import { analyze, serialize, toDocument } from "@/cms/mdx";
import {
	type EntryForm,
	type EntryFormPatch,
	type FormValue,
	storedUnitsFromForm,
	stringifyTranslation,
	TRANSLATION_FORM_KEY,
} from "./entry-form";

/**
 * 번역 화면의 줄 상태(v3 §3.2·§4.2). 원문 최신 초안과 저장된 번역 단위를 맞추고,
 * 줄을 고칠 때마다 번역본 본문(원문 뼈대 + 번역)과 번역 상태를 폼에 넣어 자동 저장이 보내게 한다.
 */
export function useTranslationRows({
	sourceMdx,
	form,
	setForm,
}: {
	sourceMdx: string;
	form: EntryForm;
	setForm: (patch: EntryFormPatch) => void;
}) {
	const sourceDoc = useMemo(() => {
		const analysis = analyze(sourceMdx);
		return analysis.errors.length > 0 ? null : toDocument(analysis);
	}, [sourceMdx]);
	const units = useMemo(() => (sourceDoc ? flattenUnits(sourceDoc) : []), [sourceDoc]);

	const formValue = form[TRANSLATION_FORM_KEY];
	const [rows, setRows] = useState<AlignedUnit[]>(() => alignUnits(units, storedUnitsFromForm(formValue)));
	/** 마지막으로 폼에 넣은 번역 상태. 바깥에서 바뀌면(복구본 불러오기 등) 다시 맞춘다. */
	const committedRef = useRef<FormValue | undefined>(formValue);
	const rowsRef = useRef(rows);
	rowsRef.current = rows;

	const commit = useCallback(
		(next: AlignedUnit[]) => {
			setRows(next);
			if (!sourceDoc) return;
			const value = stringifyTranslation(toStoredUnits(next));
			committedRef.current = value;
			setForm({
				mdx: serialize(
					buildTranslatedDoc(
						sourceDoc,
						next.map((row) => row.target),
					),
				),
				[TRANSLATION_FORM_KEY]: value,
			});
		},
		[setForm, sourceDoc],
	);

	// 처음 맞춘 결과(원문에 블록이 더해지거나 빠졌을 때)나 바깥에서 바뀐 값을 폼과 맞춘다.
	useEffect(() => {
		if (!sourceDoc) return;
		const aligned =
			formValue === committedRef.current ? rowsRef.current : alignUnits(units, storedUnitsFromForm(formValue));
		const value = stringifyTranslation(toStoredUnits(aligned));
		const mdx = serialize(
			buildTranslatedDoc(
				sourceDoc,
				aligned.map((row) => row.target),
			),
		);
		if (aligned !== rowsRef.current) setRows(aligned);
		committedRef.current = value;
		if (value !== formValue || mdx.trimEnd() !== form.mdx.trimEnd()) {
			setForm({ mdx, [TRANSLATION_FORM_KEY]: value });
		}
	}, [formValue, form.mdx, setForm, sourceDoc, units]);

	const setTarget = useCallback(
		(index: number, target: string | null) => {
			const current = rowsRef.current;
			const row = current[index];
			if (!row) return;
			commit(current.map((item, i) => (i === index ? withTarget(row, target) : item)));
		},
		[commit],
	);

	const ignore = useCallback(
		(index: number) => {
			const current = rowsRef.current;
			const row = current[index];
			if (!row) return;
			commit(current.map((item, i) => (i === index ? ignoreChange(row) : item)));
		},
		[commit],
	);

	return { rows, sourceDoc, sourceError: sourceDoc === null, setTarget, ignoreChange: ignore };
}
