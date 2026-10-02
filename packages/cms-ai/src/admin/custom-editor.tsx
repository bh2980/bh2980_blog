"use client";

import { COLLECTION_DEFINITIONS, COLLECTIONS, schemaOf } from "@bh2980/cms/client";
import { cmsFetch, errorText } from "@bh2980/cms-admin/api";
import { Button } from "@bh2980/cms-admin/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@bh2980/cms-admin/ui/dialog";
import { Input } from "@bh2980/cms-admin/ui/input";
import { Label } from "@bh2980/cms-admin/ui/label";
import { useId, useState } from "react";
import type { AiActionView } from "../actions";
import { CUSTOM_RESULTS, type CustomBase, type CustomSurface } from "../custom";
import { RESULT_LABELS } from "../definition";

/** 화면 기능(D12·M8-5)의 기본 정보 고르기: 이름·붙을 곳·결과 모양. */

const selectClass =
	"h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** 필드 옆에 붙일 수 있는 필드(글·주소 필드). 값은 `컬렉션:필드`다. */
const FIELD_OPTIONS = COLLECTIONS.flatMap((collection) =>
	Object.entries(schemaOf(collection).fields).flatMap(([name, field]) =>
		field.kind === "text" || field.kind === "slug"
			? [{ value: `${collection}:${name}`, label: `${COLLECTION_DEFINITIONS[collection].label} · ${field.label}` }]
			: [],
	),
);

const PLACE_OPTIONS: ReadonlyArray<{ value: string; label: string; surface: CustomSurface | null }> = [
	{ value: "field", label: "필드 옆", surface: null },
	{ value: "selection", label: "선택 영역 메뉴", surface: { slot: "selection" } },
	{ value: "insert", label: "삽입 메뉴", surface: { slot: "insert" } },
	{ value: "image:alt", label: "본문 이미지 · 대체 텍스트", surface: { slot: "image", target: "alt" } },
	{ value: "image:caption", label: "본문 이미지 · 캡션", surface: { slot: "image", target: "caption" } },
	{ value: "media:filename", label: "미디어 · 파일 이름", surface: { slot: "media", target: "filename" } },
	{ value: "media:defaultAlt", label: "미디어 · 기본 대체 텍스트", surface: { slot: "media", target: "defaultAlt" } },
	{ value: "media:defaultCaption", label: "미디어 · 기본 캡션", surface: { slot: "media", target: "defaultCaption" } },
];

const placeValue = (surface: CustomSurface) =>
	surface.slot === "field" ? "field" : "target" in surface ? `${surface.slot}:${surface.target}` : surface.slot;

/** 첫 필드 자리. 글·주소 필드가 없으면 선택 영역 메뉴다. */
const firstField = (): CustomSurface => {
	const [collection, field] = (FIELD_OPTIONS[0]?.value ?? "").split(":");
	return collection && field ? { slot: "field", field, collections: [collection] } : { slot: "selection" };
};

export const NEW_CUSTOM_BASE = (): CustomBase => {
	const surface = firstField();
	return { label: "", surface, result: CUSTOM_RESULTS[surface.slot][0] ?? "text" };
};

/** 기본 정보 입력. 붙을 곳을 바꾸면 그 자리에서 쓸 수 없는 결과 모양은 첫 모양으로 바꾼다. */
export function CustomBaseFields({ base, onChange }: { base: CustomBase; onChange: (base: CustomBase) => void }) {
	const ids = { label: useId(), place: useId(), field: useId(), result: useId() };
	const setSurface = (surface: CustomSurface) => {
		const results = CUSTOM_RESULTS[surface.slot];
		onChange({ ...base, surface, result: results.includes(base.result) ? base.result : (results[0] ?? "text") });
	};
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
					{CUSTOM_RESULTS[base.surface.slot].map((result) => (
						<option key={result} value={result}>
							{RESULT_LABELS[result]}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}

/** 새 화면 기능 만들기. 만든 뒤 지시문·보낼 내용·연결은 기능 편집에서 고친다. */
export function NewCustomDialog({
	onClose,
	onCreated,
}: {
	onClose: () => void;
	onCreated: (view: AiActionView) => void;
}) {
	const [base, setBase] = useState<CustomBase>(NEW_CUSTOM_BASE);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const create = async () => {
		setSaving(true);
		setError(null);
		try {
			onCreated(
				await cmsFetch<AiActionView>("/api/cms/v1/ai/actions", {
					method: "POST",
					json: { base: { ...base, label: base.label.trim() } },
					fallback: "만들지 못했습니다.",
				}),
			);
		} catch (createError) {
			setError(errorText(createError, "만들지 못했습니다."));
		} finally {
			setSaving(false);
		}
	};
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>새 기능</DialogTitle>
				</DialogHeader>
				<CustomBaseFields base={base} onChange={setBase} />
				{error && (
					<p role="alert" className="text-destructive text-xs">
						{error}
					</p>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" size="sm" onClick={onClose}>
						취소
					</Button>
					<Button type="button" size="sm" disabled={saving || !base.label.trim()} onClick={() => void create()}>
						{saving ? "만드는 중…" : "만들기"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
