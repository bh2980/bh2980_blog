"use client";

import { COLLECTION_DEFINITIONS, COLLECTIONS, schemaOf } from "@bh2980/cms/client";
import { Input } from "@bh2980/cms-admin/ui/input";
import { Label } from "@bh2980/cms-admin/ui/label";
import { useId } from "react";
import { CUSTOM_BLOCKS, type CustomBase, type CustomSurface, customEngines, customResults } from "../custom";
import { ENGINE_LABELS, RESULT_LABELS } from "../definition";

/** 화면 기능(D12·M8-5)의 기본 정보 고르기: 이름·붙을 곳·결과 모양. */

const selectClass =
	"h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** 필드 옆에 붙일 수 있는 필드(글·주소·관계·선택 필드). 조건부 필드의 선택 값도 고른다. 값은 `컬렉션:필드`다. */
const FIELD_OPTIONS = COLLECTIONS.flatMap((collection) =>
	Object.entries(schemaOf(collection).fields).flatMap(([name, field]) => {
		const target = field.kind === "conditional" ? field.discriminant : field;
		return target.kind === "text" || target.kind === "slug" || target.kind === "relation" || target.kind === "select"
			? [{ value: `${collection}:${name}`, label: `${COLLECTION_DEFINITIONS[collection].label} · ${target.label}` }]
			: [];
	}),
);

const PLACE_OPTIONS: ReadonlyArray<{ value: string; label: string; surface: CustomSurface | null }> = [
	{ value: "field", label: "필드 옆", surface: null },
	{ value: "selection", label: "선택 영역 메뉴", surface: { slot: "selection" } },
	{ value: "insert", label: "삽입 메뉴", surface: { slot: "insert" } },
	...CUSTOM_BLOCKS.map((block) => ({
		value: `block:${block.name}`,
		label: `블록 · ${block.label}`,
		surface: { slot: "block", block: block.name } as const,
	})),
	{ value: "image:alt", label: "본문 이미지 · 대체 텍스트", surface: { slot: "image", target: "alt" } },
	{ value: "image:caption", label: "본문 이미지 · 캡션", surface: { slot: "image", target: "caption" } },
	{ value: "media:filename", label: "미디어 · 파일 이름", surface: { slot: "media", target: "filename" } },
	{ value: "media:defaultAlt", label: "미디어 · 기본 대체 텍스트", surface: { slot: "media", target: "defaultAlt" } },
	{ value: "media:defaultCaption", label: "미디어 · 기본 캡션", surface: { slot: "media", target: "defaultCaption" } },
];

const placeValue = (surface: CustomSurface) =>
	surface.slot === "field"
		? "field"
		: surface.slot === "block"
			? `block:${surface.block}`
			: "target" in surface
				? `${surface.slot}:${surface.target}`
				: surface.slot;

/** 첫 필드 자리. 글·주소 필드가 없으면 선택 영역 메뉴다. */
const firstField = (): CustomSurface => {
	const [collection, field] = (FIELD_OPTIONS[0]?.value ?? "").split(":");
	return collection && field ? { slot: "field", field, collections: [collection] } : { slot: "selection" };
};

/** 자리에 맞춘 결과 모양·방식. 쓸 수 없는 값은 첫 값으로 바꾼다(관계·선택 필드는 판단 방식이 먼저다). */
const fitted = (base: CustomBase, surface: CustomSurface): CustomBase => {
	const results = customResults(surface);
	const engines = customEngines(surface);
	const engine = base.engine && engines.includes(base.engine) ? base.engine : engines[0];
	return {
		...base,
		surface,
		result: results.includes(base.result) ? base.result : (results[0] ?? "text"),
		...(engine === "decide" ? { engine } : { engine: undefined }),
	};
};

export const NEW_CUSTOM_BASE = (): CustomBase =>
	fitted({ label: "", surface: firstField(), result: "text" }, firstField());

/** 기본 정보 입력. 붙을 곳을 바꾸면 그 자리에서 쓸 수 없는 결과 모양·방식은 첫 값으로 바꾼다. */
export function CustomBaseFields({ base, onChange }: { base: CustomBase; onChange: (base: CustomBase) => void }) {
	const ids = { label: useId(), place: useId(), field: useId(), result: useId(), engine: useId() };
	const setSurface = (surface: CustomSurface) => onChange(fitted(base, surface));
	const engines = customEngines(base.surface);
	const fieldValue =
		base.surface.slot === "field" ? `${base.surface.collections?.[0] ?? ""}:${base.surface.field}` : "";
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			<div className="space-y-1.5 sm:col-span-2">
				<Label htmlFor={ids.label} className="text-xs">
					이름
				</Label>
				<Input
					id={ids.label}
					value={base.label}
					maxLength={40}
					onChange={(event) => onChange({ ...base, label: event.target.value })}
					className="h-8 text-xs"
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor={ids.place} className="text-xs">
					붙을 곳
				</Label>
				<select
					id={ids.place}
					className={selectClass}
					value={placeValue(base.surface)}
					onChange={(event) => {
						const option = PLACE_OPTIONS.find((item) => item.value === event.target.value);
						if (option) setSurface(option.surface ?? firstField());
					}}
				>
					{PLACE_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>
			{base.surface.slot === "field" ? (
				<div className="space-y-1.5">
					<Label htmlFor={ids.field} className="text-xs">
						필드
					</Label>
					<select
						id={ids.field}
						className={selectClass}
						value={fieldValue}
						onChange={(event) => {
							const [collection, field] = event.target.value.split(":");
							if (collection && field) setSurface({ slot: "field", field, collections: [collection] });
						}}
					>
						{FIELD_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
			) : (
				<div />
			)}
			<div className="space-y-1.5">
				<Label htmlFor={ids.result} className="text-xs">
					결과
				</Label>
				<select
					id={ids.result}
					className={selectClass}
					value={base.result}
					onChange={(event) => onChange({ ...base, result: event.target.value as CustomBase["result"] })}
				>
					{customResults(base.surface).map((result) => (
						<option key={result} value={result}>
							{RESULT_LABELS[result]}
						</option>
					))}
				</select>
			</div>
			{engines.length > 1 && (
				<div className="space-y-1.5">
					<Label htmlFor={ids.engine} className="text-xs">
						방식
					</Label>
					<select
						id={ids.engine}
						className={selectClass}
						value={base.engine ?? "generate"}
						onChange={(event) => {
							const engine = event.target.value as NonNullable<CustomBase["engine"]>;
							onChange({ ...base, engine: engine === "decide" ? engine : undefined });
						}}
					>
						{engines.map((engine) => (
							<option key={engine} value={engine}>
								{ENGINE_LABELS[engine]}
							</option>
						))}
					</select>
				</div>
			)}
		</div>
	);
}
