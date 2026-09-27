"use client";

import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { isRecordCollection } from "@/cms/core/collections";
import type { LayoutGroup } from "@/cms/schema/collection";
import { type SchemaCollection, schemaOf } from "@/cms/schema/derive";
import type { ConditionalField, Field, RelationField, SlugField, ValueField } from "@/cms/schema/fields";
import { MultiCombobox } from "@/components/multi-combobox";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
	Field as UiField,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatSeoulDateTimeInput } from "@/libs/contents/published-at";
import { errorText } from "../admin-api";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { type RecordCollection, useTaxonomy } from "../shared/use-taxonomy";
import type { EntryForm, EntryFormPatch, FormValue } from "./entry-form";
import {
	EntryPicker,
	FIELD_INPUTS,
	type FieldContext,
	type FieldInputProps,
	inputClass,
	OrderedEntryList,
} from "./field-inputs";

const fieldId = (name: string) => `cms-${name}`;
const actionButton = "h-7 px-2 text-xs";

interface SchemaFieldsProps {
	collection: SchemaCollection;
	form: EntryForm;
	issues?: readonly CmsIssue[];
	context: FieldContext;
	onChange: (patch: EntryFormPatch) => void;
	/** 주소를 만드는 필드(`slug.from`)가 바뀌면 부른다. 없으면 `onChange`를 쓴다. */
	onSourceChange?: (value: string) => void;
	onSlugChange?: (slug: string) => void;
	onRegenerateSlug?: () => void;
	/** 주소 입력의 안내 문구. 비우면 만들 값을 보여 주는 식으로 바꿀 때 쓴다. */
	slugPlaceholder?: string;
	/** 이 필드는 그리지 않는다(편집 화면 본문 위의 제목처럼 다른 곳에 입력이 있을 때). */
	omit?: readonly string[];
}

/** 필드 하나의 라벨·필수 표시·오류·도움말. */
function FieldRow({
	id,
	label,
	required,
	issue,
	help,
	children,
}: {
	id: string;
	label: string;
	required?: boolean;
	issue?: CmsIssue;
	help?: ReactNode;
	children: ReactNode;
}) {
	return (
		<UiField data-invalid={Boolean(issue) || undefined} className="gap-1.5">
			<FieldLabel htmlFor={id} className="font-semibold text-muted-foreground text-xs">
				{label} {required && <span className="text-destructive">*</span>}
			</FieldLabel>
			{children}
			{issue && <FieldError id={`${id}-error`}>{cmsIssueMessage(issue)}</FieldError>}
			{help && <FieldDescription className="text-[11px] leading-tight">{help}</FieldDescription>}
		</UiField>
	);
}

/** record 대상 관계(카테고리·태그·모음집). 한 개는 선택, 여러 개는 다중 선택이고 `createInline`이면 바로 만든다. */
function RecordRelationInput({ name, field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const relation = field as RelationField;
	const records = useTaxonomy(relation.to as RecordCollection);
	const [draft, setDraft] = useState("");
	const [createError, setCreateError] = useState<string | null>(null);
	const selected = Array.isArray(value) ? value : [];

	const create = async () => {
		const title = draft.trim();
		if (!title) return;
		setCreateError(null);
		try {
			const created = await records.create(title);
			onChange(relation.many ? [...selected, created.id] : created.id);
			setDraft("");
		} catch (error) {
			setCreateError(errorText(error, `${relation.label}를 만들지 못했습니다.`));
		}
	};

	const createRow = relation.createInline && (
		<div className="flex items-center gap-1.5 pt-1">
			<Input
				aria-label={`새 ${relation.label} 이름`}
				value={draft}
				disabled={context.disabled}
				onChange={(event) => setDraft(event.target.value)}
				placeholder={relation.many ? `새 ${relation.label}를 만들고 바로 추가` : `새 ${relation.label} 추가`}
				className={inputClass}
			/>
			<Button
				type="button"
				size="sm"
				variant="secondary"
				className={actionButton}
				disabled={context.disabled || !draft.trim()}
				onClick={() => void create()}
			>
				{relation.many ? "생성" : "추가"}
			</Button>
		</div>
	);
	const error = (createError ?? records.error) && (
		<p role="alert" className="text-destructive text-xs">
			{createError ?? records.error}
		</p>
	);

	if (relation.many) {
		return (
			<>
				<MultiCombobox
					aria-label={relation.label}
					placeholder={relation.placeholder ?? `${relation.label} 검색·선택`}
					emptyText={`일치하는 ${relation.label}가 없습니다.`}
					options={[
						...records.options.map((option) => ({ value: option.id, label: option.title })),
						// 목록에 아직 없는 선택값(방금 만든 항목 등)도 칩으로 보이게 한다.
						...selected
							.filter((selectedId) => !records.options.some((option) => option.id === selectedId))
							.map((selectedId) => ({ value: selectedId, label: selectedId.slice(0, 8) })),
					]}
					value={selected}
					onValueChange={(next) => onChange(next)}
				/>
				{createRow}
				{error}
			</>
		);
	}

	const items = [
		{ value: "", label: `${relation.label} 선택...` },
		...records.options.map((option) => ({ value: option.id, label: option.title })),
	];
	return (
		<>
			<Select
				value={typeof value === "string" ? value : ""}
				items={items}
				disabled={context.disabled}
				onValueChange={(next) => onChange(typeof next === "string" && next ? next : null)}
			>
				<SelectTrigger
					id={id}
					size="sm"
					className="w-full"
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					name={name}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{items.map((option) => (
						<SelectItem key={option.value || "none"} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{createRow}
			{error}
		</>
	);
}

/** 필드 종류별 기본 입력. `input`이 있으면 입력 등록부의 컴포넌트를 쓴다. */
function DefaultInput(props: FieldInputProps) {
	const { field, id, value, invalid, describedBy, context, onChange } = props;
	const Custom = field.input ? FIELD_INPUTS[field.input] : undefined;
	if (Custom) return <Custom {...props} />;
	const text = typeof value === "string" ? value : "";

	switch (field.kind) {
		case "text":
			return field.multiline ? (
				<Textarea
					id={id}
					rows={2}
					value={text}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					placeholder={field.placeholder}
					onChange={(event) => onChange(event.target.value)}
					className="min-h-12 resize-none text-xs md:text-xs"
				/>
			) : (
				<Input
					id={id}
					value={text}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					placeholder={field.placeholder}
					onChange={(event) => onChange(event.target.value)}
					className={inputClass}
				/>
			);
		case "datetime":
			return (
				<Input
					id={id}
					type="datetime-local"
					value={text}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					max={field.pastOnly ? formatSeoulDateTimeInput(new Date()) : undefined}
					onChange={(event) => onChange(event.target.value)}
					className={inputClass}
				/>
			);
		case "select": {
			const items = Object.entries(field.options).map(([optionValue, label]) => ({ value: optionValue, label }));
			return (
				<Select
					value={text || field.defaultValue}
					items={items}
					disabled={context.disabled}
					onValueChange={(next) => typeof next === "string" && onChange(next)}
				>
					<SelectTrigger id={id} size="sm" className="w-full" aria-describedby={describedBy}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{items.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);
		}
		case "relation":
			if (isRecordCollection(field.to)) return <RecordRelationInput {...props} />;
			return field.many ? <OrderedEntryList {...props} /> : <EntryPicker {...props} />;
	}
}

/**
 * 컬렉션 정의를 읽어 속성 입력을 그린다(v2 B1). 배치(`layout`)의 묶음 순서를 따르고,
 * 배치에 없는 필드는 마지막 묶음 뒤에 선언 순서대로 그린다. 조건부 필드는 조건이 맞을 때 딸린 입력을 보여 준다.
 */
export function SchemaFields({
	collection,
	form,
	issues = [],
	context,
	onChange,
	onSourceChange,
	onSlugChange,
	onRegenerateSlug,
	slugPlaceholder,
	omit = [],
}: SchemaFieldsProps) {
	const schema = schemaOf(collection);
	const issueFor = (path: string) => issues.find((issue) => issue.path === path);
	const describedBy = (path: string) => (issueFor(path) ? `${fieldId(path)}-error` : undefined);
	const slugSource = Object.values(schema.fields).find((field): field is SlugField => field.kind === "slug")?.from;

	const setValue = (name: string, value: FormValue) => {
		if (name === slugSource && onSourceChange && typeof value === "string") onSourceChange(value);
		else onChange({ [name]: value });
	};

	const renderValue = (name: string, field: ValueField) => {
		if (field.hidden) return null;
		const issue = issueFor(name);
		const props: FieldInputProps = {
			name,
			field,
			id: fieldId(name),
			value: name === "title" ? form.title : (form[name] ?? null),
			invalid: Boolean(issue),
			describedBy: describedBy(name),
			context,
			onChange: (value) => setValue(name, value),
		};
		// 여러 개 관계는 입력이 여럿이라 묶음 자체에 초점을 줄 수 있게 한다(발행 문제로 이동).
		if (field.kind === "relation" && field.many && isRecordCollection(field.to)) {
			return (
				<fieldset
					key={name}
					id={fieldId(name)}
					tabIndex={-1}
					aria-invalid={Boolean(issue) || undefined}
					aria-describedby={describedBy(name)}
					className="space-y-2"
				>
					<legend className="font-semibold text-muted-foreground text-xs">
						{field.label} {field.required && <span className="text-destructive">*</span>}
					</legend>
					{issue && <FieldError id={`${fieldId(name)}-error`}>{cmsIssueMessage(issue)}</FieldError>}
					<DefaultInput {...props} />
					{field.description && <FieldDescription className="text-[11px]">{field.description}</FieldDescription>}
				</fieldset>
			);
		}
		return (
			<FieldRow
				key={name}
				id={fieldId(name)}
				label={field.label}
				required={Boolean(field.required)}
				issue={issue}
				help={field.description}
			>
				<DefaultInput {...props} />
			</FieldRow>
		);
	};

	const renderSlug = (name: string, field: SlugField) => {
		const issue = issueFor(name);
		return (
			<FieldRow
				key={name}
				id={fieldId(name)}
				label={field.label}
				required={Boolean(field.required)}
				issue={issue}
				help={field.description}
			>
				<div className="flex gap-1.5">
					<Input
						id={fieldId(name)}
						aria-invalid={Boolean(issue) || undefined}
						aria-describedby={describedBy(name)}
						value={form.slug}
						onChange={(event) => (onSlugChange ?? ((slug) => onChange({ slug })))(event.target.value)}
						placeholder={slugPlaceholder ?? field.placeholder}
						className={`${inputClass} font-mono`}
					/>
					{onRegenerateSlug && field.from && (
						<Button
							type="button"
							size="sm"
							variant="outline"
							className={actionButton}
							disabled={context.disabled}
							onClick={onRegenerateSlug}
						>
							제목에서
						</Button>
					)}
				</div>
			</FieldRow>
		);
	};

	const renderConditional = (name: string, field: ConditionalField) => {
		const selected = typeof form[name] === "string" ? (form[name] as string) : field.discriminant.defaultValue;
		const nested = field.values[selected] ?? {};
		return (
			<div key={name} className="space-y-3">
				{renderValue(name, field.discriminant)}
				{Object.entries(nested).map(([nestedName, nestedField]) => renderValue(nestedName, nestedField))}
			</div>
		);
	};

	const renderField = (name: string) => {
		if (omit.includes(name)) return null;
		const field: Field | undefined = schema.fields[name];
		if (!field) return null;
		if (field.kind === "slug") return renderSlug(name, field);
		if (field.kind === "conditional") return renderConditional(name, field);
		return renderValue(name, field);
	};

	const placed = new Set((schema.layout ?? []).flatMap((group) => group.fields));
	const rest = Object.keys(schema.fields).filter((name) => !placed.has(name));
	const groups: LayoutGroup[] = [...(schema.layout ?? []), ...(rest.length > 0 ? [{ fields: rest }] : [])];

	return (
		<>
			{groups.map((group, index) => {
				const visible = group.fields.filter((name) => {
					const field = schema.fields[name];
					return field && !omit.includes(name) && !(field.kind !== "conditional" && "hidden" in field && field.hidden);
				});
				if (visible.length === 0) return null;
				const key = group.group ?? `group-${index}`;
				if (!group.group) {
					return (
						<div key={key} className="space-y-4">
							{visible.map(renderField)}
						</div>
					);
				}
				return (
					<LayoutSection
						key={key}
						title={group.group}
						// 값이나 발행 문제가 있는 묶음은 접어 두지 않는다.
						defaultOpen={
							!group.collapsed ||
							visible.some((name) => {
								const value = form[name];
								return Boolean(issueFor(name)) || (Array.isArray(value) ? value.length > 0 : Boolean(value));
							})
						}
					>
						{visible.map(renderField)}
					</LayoutSection>
				);
			})}
		</>
	);
}

function LayoutSection({ title, defaultOpen, children }: { title: string; defaultOpen: boolean; children: ReactNode }) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<FieldSet className="gap-3">
				<FieldLegend variant="label" className="mb-0">
					<CollapsibleTrigger
						render={
							<Button
								type="button"
								variant="ghost"
								size="xs"
								className="-ml-2 font-semibold text-muted-foreground text-xs"
							/>
						}
					>
						<ChevronRight className={`transition-transform ${open ? "rotate-90" : ""}`} />
						{title}
					</CollapsibleTrigger>
				</FieldLegend>
				<CollapsibleContent className="space-y-4">{children}</CollapsibleContent>
			</FieldSet>
		</Collapsible>
	);
}
