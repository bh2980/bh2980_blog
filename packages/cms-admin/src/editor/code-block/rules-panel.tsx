"use client";

import {
	CODE_CHAR_EFFECTS,
	type CodeCharEffectName,
	type CodeRule,
	checkPattern,
	escapePattern,
	newEffectId,
	ruleMatches,
} from "@bh2980/cms/code-block";
import { Plus, Regex, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils/cn";
import { useSlot } from "../../slots/slots";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

interface RulesPanelProps {
	rules: CodeRule[];
	text: string;
	lineCount: number;
	/** 지금 이 코드 블록에서 고른 글자와 그 줄(새 규칙의 초깃값). */
	selection: { text: string } | null;
	/** 코드 언어(자리 동작에 넘긴다). */
	language?: string | null;
	/** 이 코드 블록을 가리키는 값. 패널을 닫아도 AI 결과가 이 블록에 남는다. */
	slotScope?: string;
	onChange: (next: CodeRule[]) => void;
}

const selectClass =
	"h-7 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function RuleRow({
	rule,
	text,
	lineCount,
	onChange,
	onRemove,
}: {
	rule: CodeRule;
	text: string;
	lineCount: number;
	onChange: (rule: CodeRule) => void;
	onRemove: () => void;
}) {
	const problem = checkPattern(rule.pattern, rule.flags);
	const count = problem ? 0 : ruleMatches(rule, text).length;
	return (
		<li className="flex flex-col gap-1.5 rounded-md border p-2" aria-label={`규칙 /${rule.pattern}/`}>
			<div className="flex items-center gap-1.5">
				<select
					aria-label="효과"
					value={rule.name}
					onChange={(event) => onChange({ ...rule, name: event.target.value as CodeCharEffectName, attrs: {} })}
					className={selectClass}
				>
					{CODE_CHAR_EFFECTS.map((effect) => (
						<option key={effect.name} value={effect.name}>
							{effect.label}
						</option>
					))}
				</select>
				<select
					aria-label="찾는 곳"
					value={rule.scope === "document" ? "document" : "line"}
					onChange={(event) =>
						onChange(
							event.target.value === "document"
								? { ...rule, scope: "document", line: undefined }
								: { ...rule, scope: "char", line: rule.line ?? 0 },
						)
					}
					className={selectClass}
				>
					<option value="document">코드 전체</option>
					<option value="line">한 줄만</option>
				</select>
				{rule.scope === "char" && (
					<Input
						aria-label="줄 번호"
						type="number"
						min={1}
						max={lineCount}
						value={(rule.line ?? 0) + 1}
						onChange={(event) => {
							const line = Math.min(lineCount, Math.max(1, Number(event.target.value) || 1)) - 1;
							onChange({ ...rule, line });
						}}
						className="h-7 w-14 px-1.5 text-xs"
					/>
				)}
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					aria-label="규칙 삭제"
					onClick={onRemove}
					className="ml-auto text-destructive hover:text-destructive"
				>
					<Trash2 aria-hidden />
				</Button>
			</div>
			<div className="flex items-center gap-1 font-mono text-xs">
				<span className="text-muted-foreground">/</span>
				<Input
					aria-label="정규식"
					value={rule.pattern}
					placeholder="찾을 글자(정규식)"
					onChange={(event) => onChange({ ...rule, pattern: event.target.value })}
					className="h-7 flex-1 px-1.5 font-mono text-xs"
					aria-invalid={!!problem && rule.pattern.length > 0}
				/>
				<span className="text-muted-foreground">/</span>
				<Input
					aria-label="플래그"
					value={rule.flags}
					onChange={(event) => onChange({ ...rule, flags: event.target.value.replace(/[^a-z]/gi, "") })}
					className="h-7 w-10 px-1.5 font-mono text-xs"
				/>
			</div>
			{rule.name === "Tooltip" && (
				<Input
					aria-label="툴팁 설명"
					value={String(rule.attrs.content ?? "")}
					placeholder="툴팁 설명"
					onChange={(event) => onChange({ ...rule, attrs: { ...rule.attrs, content: event.target.value } })}
					className="h-7 px-1.5 text-xs"
				/>
			)}
			{rule.name === "fold" && (
				<label className="flex items-center gap-1.5 text-xs">
					<input
						type="checkbox"
						checked={rule.attrs.open === true}
						onChange={(event) =>
							onChange({ ...rule, attrs: { ...rule.attrs, open: event.target.checked || undefined } })
						}
					/>
					처음부터 펼쳐 두기
				</label>
			)}
			<p className={cn("text-[11px]", problem && rule.pattern ? "text-destructive" : "text-muted-foreground")}>
				{problem ? (rule.pattern ? problem : "정규식을 입력하세요.") : `${count}곳에 적용`}
			</p>
		</li>
	);
}

/**
 * 정규식 규칙(`// @document fold {re:/.../}` 등) 목록. 코드를 고쳐도 규칙이 다시 찾아 효과를 준다.
 * 고른 글자가 있으면 "규칙 추가"가 그 글자를 찾는 규칙으로 시작한다.
 */
export function RulesPanel({ rules, text, lineCount, selection, language, slotScope, onChange }: RulesPanelProps) {
	// 코드 블록 규칙 자리. 후보 정규식을 누르면 글자 접기 규칙으로 더한다.
	const foldSlot = useSlot({
		slot: "codeRules",
		target: "fold",
		scope: slotScope,
		getContext: () => ({ code: text, language: language ?? undefined }),
		apply: (pattern) =>
			onChange([...rules, { id: newEffectId(), scope: "document", name: "fold", pattern, flags: "g", attrs: {} }]),
	});
	const addRule = () =>
		onChange([
			...rules,
			{
				id: newEffectId(),
				scope: "document",
				name: "fold",
				pattern: selection?.text ? escapePattern(selection.text) : "",
				flags: "g",
				attrs: {},
			},
		]);

	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label="정규식 규칙"
									className={cn("h-7 gap-1 px-1.5 text-xs", rules.length > 0 && "text-foreground")}
								/>
							}
						>
							<Regex aria-hidden className="size-3.5" />
							{rules.length > 0 && <span className="tabular-nums">{rules.length}</span>}
						</PopoverTrigger>
					}
				/>
				<TooltipContent>정규식 규칙</TooltipContent>
			</Tooltip>
			<PopoverContent align="end" className="w-96 gap-2 p-3 text-xs" data-code-ui="">
				<div className="flex items-center justify-between gap-2">
					<p className="font-semibold">정규식 규칙</p>
					{foldSlot.trigger}
				</div>
				{foldSlot.panel}
				{rules.length > 0 && (
					<ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
						{rules.map((rule) => (
							<RuleRow
								key={rule.id}
								rule={rule}
								text={text}
								lineCount={lineCount}
								onChange={(next) => onChange(rules.map((item) => (item.id === rule.id ? next : item)))}
								onRemove={() => onChange(rules.filter((item) => item.id !== rule.id))}
							/>
						))}
					</ul>
				)}
				<Button type="button" variant="outline" size="sm" onClick={addRule} className="self-start">
					<Plus aria-hidden />
					{selection?.text ? "고른 글자로 규칙 추가" : "규칙 추가"}
				</Button>
			</PopoverContent>
		</Popover>
	);
}
