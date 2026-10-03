"use client";

import { cmsFetch, errorText } from "@bh2980/cms-admin/api";
import { cn } from "@bh2980/cms-admin/lib/utils/cn";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@bh2980/cms-admin/ui/combobox";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { AiModelInfo } from "../connection";

/** 모델 목록을 받을 곳. 저장한 연결은 id로, 저장 전에는 주소·키로 받는다. */
export type ModelSource = { providerId: string } | { url: string; apiKey?: string };

/**
 * 생성 연결의 모델 목록. 한 번 받은 목록은 10분 동안 다시 받지 않고, 저장·다시 열기에도 그대로 쓴다.
 * `source`가 없으면 받지 않는다.
 */
export function useModelList(source: ModelSource | null) {
	const query = useQuery({
		queryKey: ["cms", "ai", "models", source],
		queryFn: async ({ signal }) =>
			(
				await cmsFetch<{ items: AiModelInfo[] }>("/api/cms/v1/ai/models", {
					method: "POST",
					json: source,
					signal,
					fallback: "모델 목록을 받지 못했습니다.",
				})
			).items,
		enabled: source !== null,
		staleTime: 10 * 60_000,
		retry: false,
	});
	return {
		models: query.data ?? null,
		loading: query.isFetching,
		error: query.error ? errorText(query.error, "모델 목록을 받지 못했습니다.") : null,
	};
}

type Item = { value: string; label: string; custom?: true };

/**
 * 모델 고르기. 목록에서 검색해 고르고, 목록에 없는 이름은 입력한 글자 그대로 쓸 수 있다.
 * 목록이 없어도(판단 모델·목록을 주지 않는 주소) 이름을 적어 고른다.
 */
export function ModelCombobox({
	id,
	value,
	onChange,
	models,
	loading,
	error,
	placeholder,
	"aria-label": ariaLabel,
}: {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	models: AiModelInfo[] | null;
	loading?: boolean;
	error?: string | null;
	placeholder?: string;
	"aria-label"?: string;
}) {
	const [query, setQuery] = useState("");
	const options = useMemo<Item[]>(
		() => (models ?? []).map((model) => ({ value: model.id, label: model.id })),
		[models],
	);
	// 고른 값이 목록에 없어도(직접 적은 이름) 같은 값이면 같은 객체를 넘겨 입력 글자가 되돌아가지 않게 한다.
	const selected = useMemo<Item | null>(
		() => (value ? (options.find((option) => option.value === value) ?? { value, label: value }) : null),
		[value, options],
	);
	const typed = query.trim();
	const items: Item[] =
		typed && typed !== value && !options.some((option) => option.value === typed)
			? [...options, { value: typed, label: typed, custom: true }]
			: options;

	return (
		<Combobox
			items={items}
			autoHighlight
			value={selected}
			onValueChange={(next: Item | null) => onChange(next?.value ?? "")}
			onInputValueChange={setQuery}
			itemToStringLabel={(item: Item) => item.label}
			isItemEqualToValue={(a: Item, b: Item) => a.value === b.value}
		>
			<ComboboxInput
				id={id}
				aria-label={ariaLabel}
				placeholder={loading ? "목록 받는 중…" : placeholder}
				showClear={Boolean(value)}
				className="h-8 w-full min-w-0 [&_input]:font-mono [&_input]:text-xs"
			/>
			<ComboboxContent>
				<ComboboxEmpty>{error ?? (loading ? "목록 받는 중…" : "모델 이름을 입력하세요.")}</ComboboxEmpty>
				<ComboboxList>
					{(item: Item) => (
						<ComboboxItem
							key={item.value}
							value={item}
							className={cn("font-mono text-xs", item.custom && "text-primary")}
						>
							<span className="truncate">{item.custom ? `'${item.label}' 사용` : item.label}</span>
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
