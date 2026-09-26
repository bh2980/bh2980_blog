"use client";

import { useMemo } from "react";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from "@/components/ui/combobox";
import { cn } from "@/utils/cn";

export interface MultiComboboxOption {
	value: string;
	label: string;
}

interface MultiComboboxProps {
	options: MultiComboboxOption[];
	value: string[];
	onValueChange: (value: string[]) => void;
	placeholder?: string;
	emptyText?: string;
	"aria-label"?: string;
	className?: string;
}

/** shadcn Combobox(다중 선택)를 `value` 문자열 배열로 다루는 얇은 래퍼. 선택한 항목은 칩으로 보인다. */
export function MultiCombobox({
	options,
	value,
	onValueChange,
	placeholder,
	emptyText = "항목이 없습니다.",
	"aria-label": ariaLabel,
	className,
}: MultiComboboxProps) {
	const anchor = useComboboxAnchor();
	const byValue = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
	const selected = value.map((item) => byValue.get(item)).filter((item) => item !== undefined);

	return (
		<Combobox
			items={options}
			multiple
			value={selected}
			onValueChange={(next) => onValueChange(next.map((option) => option.value))}
			itemToStringLabel={(option) => option.label}
			isItemEqualToValue={(a, b) => a.value === b.value}
		>
			<ComboboxChips ref={anchor} className={cn("w-full", className)}>
				<ComboboxValue>
					{selected.map((option) => (
						<ComboboxChip key={option.value}>{option.label}</ComboboxChip>
					))}
				</ComboboxValue>
				<ComboboxChipsInput aria-label={ariaLabel} placeholder={selected.length === 0 ? placeholder : undefined} />
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>{emptyText}</ComboboxEmpty>
				<ComboboxList>
					{(option: MultiComboboxOption) => (
						<ComboboxItem key={option.value} value={option}>
							{option.label}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
