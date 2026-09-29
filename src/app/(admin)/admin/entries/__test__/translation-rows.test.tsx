import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
	type EntryData,
	type EntryForm,
	type EntryFormPatch,
	formFromEntry,
	stringifyTranslation,
	TRANSLATION_FORM_KEY,
	translationPayload,
} from "../entry-form";
import { useTranslationRows } from "../translation-rows";

const source = "첫 문단\n\n둘째 문단\n";
const translation = (units: { source: string; target: string | null }[]) =>
	units.map((unit) => ({ key: "|block|paragraph", ...unit }));

const entry = (units: ReturnType<typeof translation> | null): EntryData => ({
	id: "en-id",
	collection: "post",
	locale: "en",
	translationGroupId: "ko-id",
	status: "draft",
	version: 3,
	folderId: null,
	workingSlug: "slug",
	publishedSlug: null,
	working: {
		metadata: { title: "Title" },
		mdx: "First\n",
		// 서버(JSONB)는 키 순서를 바꿔 돌려준다.
		translation: units ? ({ units, version: 1 } as never) : null,
	},
});

const useHarness = (initial: EntryForm, sourceMdx = source) => {
	const [form, setFormState] = useState(initial);
	const setForm = (patch: EntryFormPatch) => setFormState((current) => ({ ...current, ...patch }) as EntryForm);
	return { form, ...useTranslationRows({ sourceMdx, form, setForm }) };
};

describe("번역 화면 폼 연결(v3)", () => {
	it("번역본 폼은 번역 상태를 고정된 키 순서의 JSON으로 담고, 저장 요청에 싣는다", () => {
		const form = formFromEntry(
			entry(
				translation([
					{ source: "첫 문단", target: "First" },
					{ source: "둘째 문단", target: null },
				]),
			),
		);
		expect(form[TRANSLATION_FORM_KEY]).toBe(
			stringifyTranslation(
				translation([
					{ source: "첫 문단", target: "First" },
					{ source: "둘째 문단", target: null },
				]),
			),
		);
		expect(translationPayload(form)?.units).toHaveLength(2);
		// 원문은 번역 상태를 보내지 않는다.
		expect(translationPayload(formFromEntry({ ...entry(null), translationGroupId: "en-id" }))).toBeUndefined();
	});

	it("줄을 번역하면 번역본 본문과 번역 상태가 폼에 들어간다", () => {
		const initial = formFromEntry(
			entry(
				translation([
					{ source: "첫 문단", target: "First" },
					{ source: "둘째 문단", target: null },
				]),
			),
		);
		const { result } = renderHook(() => useHarness(initial));
		expect(result.current.rows.map((row) => row.status)).toEqual(["translated", "untranslated"]);
		// 처음 맞춘 결과가 저장된 값과 같으면 폼을 건드리지 않는다(열자마자 저장하지 않는다).
		expect(result.current.form).toBe(initial);

		act(() => result.current.setTarget(1, "Second"));
		expect(result.current.form.mdx).toBe("First\n\nSecond\n");
		expect(translationPayload(result.current.form)?.units.map((unit) => unit.target)).toEqual(["First", "Second"]);
	});

	it("원문에 블록이 더해졌으면 열 때 다시 맞춘 상태를 폼에 넣어 자동 저장이 보내게 한다", () => {
		const initial = formFromEntry(
			entry(
				translation([
					{ source: "첫 문단", target: "First" },
					{ source: "둘째 문단", target: "Second" },
				]),
			),
		);
		const { result } = renderHook(() =>
			useHarness({ ...initial, mdx: "First\n\nSecond\n" }, "첫 문단\n\n새 문단\n\n둘째 문단\n"),
		);
		expect(result.current.rows.map((row) => row.status)).toEqual(["translated", "untranslated", "translated"]);
		expect(translationPayload(result.current.form)?.units).toHaveLength(3);
		expect(result.current.form.mdx).toBe("First\n\nSecond\n");
	});

	it("원문 변경 무시는 본문을 바꾸지 않고 기준 원문만 바꾼다", () => {
		const initial = formFromEntry(
			entry(
				translation([
					{ source: "첫 문단", target: "First" },
					{ source: "둘째 문단", target: "Second" },
				]),
			),
		);
		const { result } = renderHook(() =>
			useHarness({ ...initial, mdx: "First\n\nSecond\n" }, "첫 문단 고침\n\n둘째 문단\n"),
		);
		expect(result.current.rows[0]?.status).toBe("changed");
		act(() => result.current.ignoreChange(0));
		expect(result.current.rows[0]?.status).toBe("translated");
		expect(result.current.form.mdx).toBe("First\n\nSecond\n");
		expect(translationPayload(result.current.form)?.units[0]?.source).toBe("첫 문단 고침");
	});
});
