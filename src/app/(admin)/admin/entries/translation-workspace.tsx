"use client";

import { type ReactNode, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { EntryForm, EntryFormPatch } from "./entry-form";
import { TranslationBand, type TranslationBandHandle } from "./translation-band";
import { type PreviewMode, TranslationPreview } from "./translation-preview";
import { useTranslationRows } from "./translation-rows";

/**
 * 번역본 편집 화면(v3 §4.2). 제목 위 언어 탭·제목은 그대로 두고, 본문은 실제 글 모양의 미리보기로 보인다.
 * 블록을 누르면 그 자리에서 띠로 펼쳐져 원문(왼쪽)과 번역 편집기(오른쪽)를 나란히 놓고 고친다.
 * 서식 도구 줄과 MDX 보기는 두지 않는다. 단위를 저장하면 번역본 본문과 번역 상태가 폼에 들어가 자동 저장된다.
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
	const { rows, sourceDoc, sourceError, setTarget, ignoreChange } = useTranslationRows({ sourceMdx, form, setForm });
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
	const [mode, setMode] = useState<PreviewMode>("translation");
	const bandRef = useRef<TranslationBandHandle>(null);

	const selected = selectedIndex !== null && rows[selectedIndex] ? selectedIndex : null;
	const selectedRow = selected === null ? null : (rows[selected] ?? null);

	const counts = useMemo(() => {
		let translated = 0;
		let untranslated = 0;
		let changed = 0;
		for (const row of rows) {
			if (row.status === "translated") translated += 1;
			else if (row.status === "untranslated") untranslated += 1;
			else changed += 1;
		}
		return { translated, untranslated, changed };
	}, [rows]);

	/** 고르던 블록에 저장하지 않은 내용이 있으면 먼저 저장한다. 저장할 수 없는 내용이면 옮기지 않는다. */
	const select = (index: number | null) => {
		if (selected !== null && bandRef.current && !bandRef.current.flush()) return;
		setSelectedIndex(index);
	};

	/** 저장 키로 저장한 뒤 다음 단위로 간다. 마지막 단위면 닫는다. */
	const saveAndNext = () => {
		if (selected === null) return;
		select(selected + 1 < rows.length ? selected + 1 : null);
	};

	const toggleSource = () => {
		if (mode === "translation") {
			// 원문으로 보는 동안에는 띠를 닫는다. 고치던 내용이 저장되지 않으면 그대로 둔다.
			if (selected !== null && bandRef.current && !bandRef.current.flush()) return;
			setSelectedIndex(null);
			setMode("source");
		} else {
			setMode("translation");
		}
	};

	const goNext = () => {
		const untranslated = rows.flatMap((row, index) => (row.status === "untranslated" && !row.unit.auto ? [index] : []));
		const from = selected ?? -1;
		const next = untranslated.find((index) => index > from) ?? untranslated[0];
		if (next !== undefined) select(next);
	};

	const progress = [
		`번역 ${counts.translated}/${rows.length}`,
		counts.untranslated > 0 ? `미번역 ${counts.untranslated}` : null,
		counts.changed > 0 ? `원문 변경 ${counts.changed}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div
			className="flex min-h-full w-full flex-col bg-background"
			onCompositionStart={onCompositionStart}
			onCompositionEnd={onCompositionEnd}
		>
			<div className="mx-auto w-full max-w-3xl border-border/60 border-b px-4 pt-12 pb-5">{header}</div>
			{sourceError || !sourceDoc ? (
				<p role="alert" className="mx-auto w-full max-w-6xl px-4 py-10 text-center text-muted-foreground text-sm">
					원문을 해석할 수 없습니다. 원문을 먼저 고치세요.
				</p>
			) : (
				<>
					<div className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
						<p className="text-sm">{progress}</p>
						<span className="flex-1" />
						<Button
							type="button"
							size="sm"
							variant={mode === "source" ? "secondary" : "outline"}
							className="h-7 px-2 text-xs"
							aria-pressed={mode === "source"}
							onClick={toggleSource}
						>
							원문으로 보기
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-7 px-2 text-xs"
							disabled={counts.untranslated === 0}
							onClick={goNext}
						>
							다음 미번역
						</Button>
					</div>
					<div data-translation-area className="min-w-0 flex-1 px-4 pt-8 pb-[35vh]">
						<div className="mx-auto max-w-3xl">
							<TranslationPreview
								sourceDoc={sourceDoc}
								rows={rows}
								mode={mode}
								selected={selected}
								onSelect={mode === "source" ? () => {} : select}
								band={
									selectedRow && selected !== null && mode !== "source" ? (
										<TranslationBand
											key={selected}
											ref={bandRef}
											row={selectedRow}
											index={selected}
											total={rows.length}
											editable={editable}
											sourceLocale={sourceLocale}
											targetLocale={targetLocale}
											onChangeTarget={setTarget}
											onIgnoreChange={ignoreChange}
											onPrev={() => select(selected - 1)}
											onNext={saveAndNext}
											onClose={() => select(null)}
										/>
									) : undefined
								}
							/>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
