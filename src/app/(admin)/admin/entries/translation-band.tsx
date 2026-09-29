"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { type Ref, useImperativeHandle, useRef, useState } from "react";
import type { AlignedUnit } from "@/cms/core/translation/units";
import { Button } from "@/components/ui/button";
import { BlockCellEditor, type CellEditorHandle, HeaderCellEditor, UnitValue } from "./translation-cell-editors";

/** 번역 띠가 바깥에 내보이는 조작. 고른 블록을 바꾸기 전에 쓴다. */
export interface TranslationBandHandle {
	/** 고치던 내용을 저장한다. 저장할 수 없는 내용이면 false다. */
	flush: () => boolean;
}

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

const stripButton = "h-7 px-2 text-xs";

/**
 * 고른 번역 단위가 미리보기 안에서 펼쳐지는 띠(v3 §4.2). 위쪽 줄에 위치와 도구를,
 * 아래에 원문(왼쪽)과 번역 편집기(오른쪽)를 같은 폭으로 나란히 놓는다. 넓은 화면이 아니면 위아래로 쌓는다.
 * `onNext`는 저장 키(Enter·Cmd/Ctrl+Enter)로 저장한 뒤 다음 단위로 가는 데 쓴다.
 */
export function TranslationBand({
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
	ref?: Ref<TranslationBandHandle>;
}) {
	const { unit } = row;
	const isHeader = unit.kind === "header";
	const changed = row.status === "changed" && !unit.auto;
	const [comparing, setComparing] = useState(false);
	const editorRef = useRef<CellEditorHandle>(null);
	useImperativeHandle(ref, () => ({ flush: () => editorRef.current?.flush() ?? true }), []);

	const editorProps = {
		ref: editorRef,
		source: unit.source,
		target: row.target,
		editable,
		autoFocus: true,
		bare: true,
		onCommit: (target: string | null) => onChangeTarget(index, target),
		onSubmit: onNext,
		// 고치던 내용은 편집기가 버린 뒤에 닫는다.
		onEscape: onClose,
	};

	return (
		<div className="overflow-hidden rounded-lg border border-primary/40 bg-background shadow-sm">
			<div className="flex flex-wrap items-center gap-2 border-primary/30 border-b bg-primary/10 px-3 py-1.5">
				<span className="text-sm">{positionLabel(row, index, total)}</span>
				{editable && !unit.auto && (
					<Button
						type="button"
						size="sm"
						variant="outline"
						className={stripButton}
						onClick={() => editorRef.current?.copySource()}
					>
						{unit.type === "image" ? "원문 이미지로" : "원문 복사"}
					</Button>
				)}
				{changed && (
					<>
						<span className="font-medium text-amber-700 text-xs dark:text-amber-400">원문 변경됨</span>
						<Button
							type="button"
							size="sm"
							variant="outline"
							className={stripButton}
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
								className={stripButton}
								onClick={() => onIgnoreChange(index)}
							>
								변경 무시
							</Button>
						)}
					</>
				)}
				<span className="flex-1" />
				{editable && !unit.auto && (
					<Button type="button" size="sm" className={stripButton} onClick={() => editorRef.current?.flush()}>
						저장
					</Button>
				)}
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
			<div className="grid md:grid-cols-2">
				<section className="flex min-w-0 flex-col gap-2 bg-muted/40 p-4">
					<h3 className="font-medium text-muted-foreground text-xs">{sourceLocale.toUpperCase()} 원문</h3>
					{changed && comparing ? (
						<div className="flex flex-col gap-3">
							<div>
								<p className="mb-1 text-muted-foreground text-xs">이전</p>
								<UnitValue header={isHeader} value={row.baseSource} />
							</div>
							<div>
								<p className="mb-1 text-muted-foreground text-xs">지금</p>
								<UnitValue header={isHeader} value={unit.source} />
							</div>
						</div>
					) : (
						<UnitValue header={isHeader} value={unit.source} />
					)}
				</section>
				<section className="flex min-w-0 flex-col gap-2 p-4">
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
