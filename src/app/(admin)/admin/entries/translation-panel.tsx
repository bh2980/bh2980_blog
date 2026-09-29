"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { type Ref, useImperativeHandle, useRef, useState } from "react";
import type { AlignedUnit } from "@/cms/core/translation/units";
import { Button } from "@/components/ui/button";
import { BlockCellEditor, type CellEditorHandle, HeaderCellEditor, UnitValue } from "./translation-cell-editors";

/** 번역 패널이 바깥에 내보이는 조작. 고른 블록을 바꾸기 전에 쓴다. */
export type TranslationPanelHandle = CellEditorHandle;

const BOX_NAMES: Record<string, string> = {
	Callout: "콜아웃",
	Collapsible: "접기",
	Tabs: "탭",
	Tab: "탭",
	Columns: "단 나누기",
	Column: "단 나누기",
	TextAlign: "정렬",
};

/** 열쇠의 앞부분(`/Callout/Tabs`)에서 가장 안쪽 상자 이름을 찾는다. 맨 위 블록이면 빈 문자열이다. */
const containerName = (key: string) => {
	const last = (key.split("|")[0] ?? "").split("/").filter(Boolean).pop();
	return last ? (BOX_NAMES[last] ?? last) : "";
};

const positionLabel = (row: AlignedUnit, index: number, total: number) => {
	const { unit } = row;
	const place =
		unit.kind === "header"
			? `${BOX_NAMES[unit.type] ?? unit.type} ${unit.type === "Tabs" ? "이름" : "제목"}`
			: containerName(unit.key)
				? `${containerName(unit.key)} 안`
				: "";
	return [place, `${index + 1}/${total}`].filter(Boolean).join(" · ");
};

/**
 * 고른 번역 단위를 고치는 패널(v3 §4.2). 원문(읽기 전용)과 번역 편집기를 위아래로 놓는다.
 * 다른 블록으로 옮기기 전에 `flush`로 고치던 내용을 저장한다.
 */
export function TranslationPanel({
	row,
	index,
	total,
	editable,
	sourceLocale,
	targetLocale,
	onChangeTarget,
	onIgnoreChange,
	onPrev,
	onNext,
	onClose,
	ref,
}: {
	row: AlignedUnit;
	index: number;
	total: number;
	editable: boolean;
	sourceLocale: string;
	targetLocale: string;
	onChangeTarget: (index: number, target: string | null) => void;
	onIgnoreChange: (index: number) => void;
	onPrev: () => void;
	onNext: () => void;
	onClose: () => void;
	ref?: Ref<TranslationPanelHandle>;
}) {
	const { unit } = row;
	const isHeader = unit.kind === "header";
	const [comparing, setComparing] = useState(false);
	const editorRef = useRef<CellEditorHandle>(null);
	useImperativeHandle(ref, () => ({ flush: () => editorRef.current?.flush() ?? true }), []);

	const editorProps = {
		ref: editorRef,
		source: unit.source,
		target: row.target,
		editable,
		autoFocus: true,
		onCommit: (target: string | null) => onChangeTarget(index, target),
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex items-center gap-1 border-b px-3 py-2">
				<p className="min-w-0 flex-1 truncate text-sm">{positionLabel(row, index, total)}</p>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					className="size-7"
					aria-label="이전 블록"
					disabled={index <= 0}
					onClick={onPrev}
				>
					<ChevronUp aria-hidden className="size-4" />
				</Button>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					className="size-7"
					aria-label="다음 블록"
					disabled={index >= total - 1}
					onClick={onNext}
				>
					<ChevronDown aria-hidden className="size-4" />
				</Button>
				<Button type="button" size="icon" variant="ghost" className="size-7" aria-label="닫기" onClick={onClose}>
					<X aria-hidden className="size-4" />
				</Button>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
				<section className="flex flex-col gap-1.5">
					<h3 className="font-medium text-muted-foreground text-xs">{sourceLocale.toUpperCase()} 원문</h3>
					<UnitValue header={isHeader} value={unit.source} />
				</section>
				{row.status === "changed" && !unit.auto && (
					<section className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
						<div className="flex items-center gap-2 text-amber-700 text-xs dark:text-amber-400">
							<span className="flex-1 font-medium">원문 변경됨</span>
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="h-7 px-2 text-xs"
								aria-pressed={comparing}
								onClick={() => setComparing((current) => !current)}
							>
								비교
							</Button>
							{editable && (
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="h-7 px-2 text-xs"
									onClick={() => onIgnoreChange(index)}
								>
									변경 무시
								</Button>
							)}
						</div>
						{comparing && (
							<div className="grid gap-2">
								<div>
									<p className="mb-1 text-muted-foreground text-xs">이전</p>
									<UnitValue header={isHeader} value={row.baseSource} />
								</div>
								<div>
									<p className="mb-1 text-muted-foreground text-xs">지금</p>
									<UnitValue header={isHeader} value={unit.source} />
								</div>
							</div>
						)}
					</section>
				)}
				<section className="flex flex-col gap-1.5">
					<h3 className="font-medium text-muted-foreground text-xs">{targetLocale.toUpperCase()}</h3>
					{unit.auto ? (
						<p className="text-muted-foreground text-sm">원문 그대로</p>
					) : isHeader ? (
						<HeaderCellEditor key={index} {...editorProps} />
					) : (
						<BlockCellEditor key={index} {...editorProps} type={unit.type} />
					)}
				</section>
			</div>
		</div>
	);
}
