"use client";

import { type ReactNode, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import type { EntryForm, EntryFormPatch } from "./entry-form";
import { TranslationPanel, type TranslationPanelHandle } from "./translation-panel";
import { type PreviewMode, TranslationPreview } from "./translation-preview";
import { useTranslationRows } from "./translation-rows";

/**
 * 번역본 편집 화면(v3 §4.2). 제목 위 언어 탭·제목은 그대로 두고, 본문은 실제 글 모양의 미리보기로 보인다.
 * 블록을 누르면 오른쪽 패널에서 그 단위의 원문과 번역을 나란히 놓고 고친다.
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
	const panelRef = useRef<TranslationPanelHandle>(null);

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
		if (selected !== null && panelRef.current && !panelRef.current.flush()) return;
		setSelectedIndex(index);
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
							onClick={() => setMode((current) => (current === "source" ? "translation" : "source"))}
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
					<div className="flex min-h-0 flex-1 items-start">
						<div className="min-w-0 flex-1 px-4 pt-8 pb-[35vh]">
							<div className="mx-auto max-w-3xl">
								<TranslationPreview
									sourceDoc={sourceDoc}
									rows={rows}
									mode={mode}
									selected={selected}
									onSelect={select}
								/>
							</div>
						</div>
						<aside
							aria-label="번역 패널"
							className={cn(
								"border-l bg-background lg:sticky lg:top-12 lg:block lg:max-h-[calc(100vh-7rem)] lg:w-105 lg:shrink-0 lg:self-start lg:overflow-hidden",
								// 좁은 화면에서는 블록을 골랐을 때만 오른쪽에서 덮는다.
								selectedRow
									? "max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:w-[min(100vw,26rem)] max-lg:shadow-xl"
									: "max-lg:hidden",
							)}
						>
							{selectedRow && selected !== null ? (
								<TranslationPanel
									key={selected}
									ref={panelRef}
									row={selectedRow}
									index={selected}
									total={rows.length}
									editable={editable}
									sourceLocale={sourceLocale}
									targetLocale={targetLocale}
									onChangeTarget={setTarget}
									onIgnoreChange={ignoreChange}
									onPrev={() => select(selected - 1)}
									onNext={() => select(selected + 1)}
									onClose={() => select(null)}
								/>
							) : (
								<p className="p-4 text-muted-foreground text-sm">블록을 누르면 번역합니다.</p>
							)}
						</aside>
					</div>
				</>
			)}
		</div>
	);
}
