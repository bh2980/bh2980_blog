"use client";

import {
	BLOCK_BY_NAME,
	COLLECTIONS,
	DEFAULT_LOCALE,
	localeLabel,
	PREFIXED_LOCALES,
	schemaOf,
} from "@bh2980/cms/client";
import { cmsFetch, errorText } from "@bh2980/cms-admin/api";
import { cn } from "@bh2980/cms-admin/lib/utils/cn";
import { AdminShell } from "@bh2980/cms-admin/shell";
import { Alert, AlertDescription } from "@bh2980/cms-admin/ui/alert";
import { Badge } from "@bh2980/cms-admin/ui/badge";
import { Button } from "@bh2980/cms-admin/ui/button";
import { Checkbox } from "@bh2980/cms-admin/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@bh2980/cms-admin/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@bh2980/cms-admin/ui/empty";
import { Input } from "@bh2980/cms-admin/ui/input";
import { Label } from "@bh2980/cms-admin/ui/label";
import { Skeleton } from "@bh2980/cms-admin/ui/skeleton";
import { Switch } from "@bh2980/cms-admin/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@bh2980/cms-admin/ui/tabs";
import { Textarea } from "@bh2980/cms-admin/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Code, Plug, Plus, Quote, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { draftCustomView } from "../action-view";
import type { AiActionView } from "../actions";
import type { CustomBase } from "../custom";
import {
	ADDABLE_CHECKS,
	type AddableCheckKind,
	type AiCheck,
	type AiRunContext,
	type AiRunResult,
	CHECK_LABELS,
	ENGINE_LABELS,
	SLOT_LABELS,
	SLOT_TARGETS,
} from "../definition";
import { AI_SHARED_KEYS } from "../registry";
import {
	AI_ACTIONS_KEY,
	type AiActionsResponse,
	inputFromContext,
	runAiAction,
	runAiActionMany,
	useAiActions,
} from "./ai-slot-provider";
import { ConnectionManager, useAiSettings } from "./connection-editor";
import { CustomBaseFields, NEW_CUSTOM_BASE } from "./custom-editor";
import { ModelCombobox, useModelList } from "./model-combobox";
import { SharedTextsEditor } from "./shared-editor";

const selectClass =
	"h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** 붙을 곳의 보이는 이름. 필드는 컬렉션 정의의 이름이다. */
function placeLabel(action: Pick<AiActionView, "attach">): string {
	const attach = action.attach[0];
	if (!attach) return "직접 호출";
	switch (attach.slot) {
		case "field": {
			for (const collection of COLLECTIONS) {
				const field = schemaOf(collection).fields[attach.field];
				if (field) return `${SLOT_LABELS.field} · ${field.label}`;
			}
			return `${SLOT_LABELS.field} · ${attach.field}`;
		}
		case "translation":
		case "selection":
		case "insert":
			return SLOT_LABELS[attach.slot];
		case "block":
			return `${SLOT_LABELS.block} · ${BLOCK_BY_NAME.get(attach.block)?.label ?? attach.block}`;
		default: {
			const targets: Readonly<Record<string, string>> = SLOT_TARGETS[attach.slot];
			return `${SLOT_LABELS[attach.slot]} · ${targets[attach.target] ?? attach.target}`;
		}
	}
}

/** 관리자 화면에서 고칠 수 있는 값. 저장·시험에 보낸다. */
type Editable = Pick<
	AiActionView,
	| "enabled"
	| "askInstruction"
	| "instant"
	| "providerId"
	| "modelName"
	| "prompt"
	| "send"
	| "threshold"
	| "maxCount"
	| "checks"
>;

const editableOf = (action: AiActionView): Editable => ({
	enabled: action.enabled,
	askInstruction: action.askInstruction,
	instant: action.instant,
	providerId: action.providerId,
	modelName: action.modelName,
	prompt: action.prompt,
	send: action.send,
	threshold: action.threshold,
	maxCount: action.maxCount,
	checks: action.checks,
});

/** 번역본 편집기의 블록 번역 기능인가(시험이 예시 MDX·대상 언어를 받는다). */
const isTranslation = (action: AiActionView) =>
	action.result === "mdx" && action.attach.some((attach) => attach.slot === "translation");

/** 시험에 쓸 자료. 기능이 보내는 내용에 맞는 칸만 보인다. */
type Sample = {
	title: string;
	body: string;
	code: string;
	mediaId: string;
	current: string;
	request: string;
	/** 번역 시험의 대상 언어. */
	targetLocale: string;
};
const EMPTY_SAMPLE: Sample = {
	title: "",
	body: "",
	code: "",
	mediaId: "",
	current: "",
	request: "",
	targetLocale: PREFIXED_LOCALES[0] ?? "en",
};

function sampleContext(action: AiActionView, sample: Sample): AiRunContext {
	const context: AiRunContext = {};
	const field = action.attach.find((attach) => attach.slot === "field");
	if (field?.slot === "field") context.collection = field.collections?.[0];
	if (sample.title.trim()) context.title = sample.title;
	if (sample.body.trim()) {
		context.body = sample.body;
		context.around = sample.body;
		context.selection = sample.body;
	}
	if (sample.code.trim()) context.code = sample.code;
	if (sample.mediaId.trim()) context.mediaId = sample.mediaId.trim();
	if (sample.current.trim()) context.current = sample.current;
	return context;
}

/**
 * 관리자 AI 화면(v2 D). `기능` 탭은 코드로 정해 둔 기능 목록이고, 기능마다 켜기·요청 받기·연결·모델·보낼 내용·
 * 지시문·검사를 고친 뒤 저장 전에 시험한다. `연결` 탭에서 서비스 주소·키·기본 모델을 여러 개 저장한다.
 */
export function AiManager() {
	const queryClient = useQueryClient();
	const featuresQuery = useAiActions();
	const features = featuresQuery.data?.items ?? [];
	const usable = new Set(featuresQuery.data?.usable ?? []);
	const [tab, setTab] = useState<"features" | "connections" | "shared">("features");
	/** 고치는 기능. `isNew`면 아직 저장하지 않은 새 화면 기능이다(저장하면 만든다). */
	const [editing, setEditing] = useState<{
		feature: AiActionView;
		spec: Editable;
		base?: CustomBase;
		isNew?: boolean;
	} | null>(null);
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const replaceInCache = (feature: AiActionView) =>
		queryClient.setQueryData<AiActionsResponse>(AI_ACTIONS_KEY, (data) =>
			data ? { ...data, items: data.items.map((item) => (item.key === feature.key ? feature : item)) } : data,
		);

	const open = (feature: AiActionView) => {
		setEditing({ feature, spec: editableOf(feature), ...(feature.custom ? { base: feature.custom } : {}) });
		setFormError(null);
	};

	/** 새 화면 기능을 오른쪽에 연다. 기본 정보·연결·지시문 등을 다 고친 뒤 저장하면 만든다. */
	const startNew = () => {
		const base = NEW_CUSTOM_BASE();
		const feature = draftCustomView(base);
		setEditing({ feature, spec: editableOf(feature), base, isNew: true });
		setFormError(null);
	};

	/**
	 * 화면 기능의 기본 정보를 바꾼다. 붙을 곳·결과 모양·방식이 바뀌면 입력·검사가 달라지므로 화면 모양을 다시 만들고,
	 * 고친 켜기·요청 받기·바로 넣기·지시문은 남긴다(방식이 같으면 연결·모델도 남긴다).
	 */
	const changeBase = (base: CustomBase) => {
		if (!editing) return;
		const { label: _before, ...restBefore } = editing.base ?? base;
		const { label: _after, ...restAfter } = base;
		if (JSON.stringify(restBefore) === JSON.stringify(restAfter)) {
			setEditing({ ...editing, base });
			return;
		}
		const draft = draftCustomView(base);
		const feature: AiActionView = editing.isNew
			? draft
			: { ...draft, key: editing.feature.key, version: editing.feature.version, updatedAt: editing.feature.updatedAt };
		const sameEngine = feature.engine === editing.feature.engine;
		const { spec } = editing;
		setEditing({
			...editing,
			base,
			feature,
			spec: {
				...editableOf(feature),
				enabled: spec.enabled,
				askInstruction: spec.askInstruction,
				instant: spec.instant,
				prompt: spec.prompt,
				...(sameEngine ? { providerId: spec.providerId, modelName: spec.modelName } : {}),
			},
		});
	};

	const remove = async (feature: AiActionView) => {
		try {
			await cmsFetch(`/api/cms/v1/ai/actions/${feature.key}?expectedVersion=${feature.version}`, {
				method: "DELETE",
				fallback: "지우지 못했습니다.",
			});
			queryClient.setQueryData<AiActionsResponse>(AI_ACTIONS_KEY, (data) =>
				data ? { ...data, items: data.items.filter((item) => item.key !== feature.key) } : data,
			);
			setEditing(null);
			toast.success(`'${feature.label}'을(를) 지웠습니다.`);
		} catch (error) {
			toast.error(errorText(error, "지우지 못했습니다."));
		}
	};

	const save = async () => {
		if (!editing) return;
		setSaving(true);
		setFormError(null);
		if (editing.isNew && editing.base) {
			try {
				const createdFeature = await cmsFetch<AiActionView>("/api/cms/v1/ai/actions", {
					method: "POST",
					json: { base: { ...editing.base, label: editing.base.label.trim() }, value: editing.spec },
					fallback: "만들지 못했습니다.",
				});
				queryClient.setQueryData<AiActionsResponse>(AI_ACTIONS_KEY, (data) =>
					data ? { ...data, items: [...data.items, createdFeature] } : data,
				);
				open(createdFeature);
				toast.success("만들었습니다.");
				void queryClient.invalidateQueries({ queryKey: AI_ACTIONS_KEY });
			} catch (error) {
				setFormError(errorText(error, "만들지 못했습니다."));
			} finally {
				setSaving(false);
			}
			return;
		}
		try {
			const saved = await cmsFetch<AiActionView>(`/api/cms/v1/ai/actions/${editing.feature.key}`, {
				method: "PATCH",
				json: {
					expectedVersion: editing.feature.version,
					value: editing.spec,
					...(editing.base ? { base: { ...editing.base, label: editing.base.label.trim() } } : {}),
				},
				fallback: "저장하지 못했습니다.",
			});
			replaceInCache(saved);
			open(saved);
			toast.success("저장했습니다.");
			void queryClient.invalidateQueries({ queryKey: AI_ACTIONS_KEY });
		} catch (error) {
			setFormError(errorText(error, "저장하지 못했습니다."));
		} finally {
			setSaving(false);
		}
	};

	const reset = async (feature: AiActionView) => {
		try {
			const saved = await cmsFetch<AiActionView>(`/api/cms/v1/ai/actions/${feature.key}/reset`, {
				method: "POST",
				json: { expectedVersion: feature.version },
				fallback: "되돌리지 못했습니다.",
			});
			replaceInCache(saved);
			open(saved);
			toast.success("기본값으로 되돌렸습니다.");
		} catch (error) {
			toast.error(errorText(error, "되돌리지 못했습니다."));
		}
	};

	return (
		<AdminShell
			title={
				<span className="flex items-center gap-2">
					AI <Badge variant="secondary">총 {features.length}개</Badge>
				</span>
			}
			sidebar={{ activeNav: "ai" }}
		>
			<Tabs
				value={tab}
				onValueChange={(value) => setTab(value as typeof tab)}
				className="flex min-h-0 flex-1 flex-col gap-0"
			>
				<TabsList variant="line" className="h-10 shrink-0 justify-start gap-4 border-b px-4">
					<TabsTrigger value="features" className="flex-none px-0 text-xs">
						<Sparkles aria-hidden />
						기능
					</TabsTrigger>
					<TabsTrigger value="connections" className="flex-none px-0 text-xs">
						<Plug aria-hidden />
						연결
					</TabsTrigger>
					{AI_SHARED_KEYS.length > 0 && (
						<TabsTrigger value="shared" className="flex-none px-0 text-xs">
							<Quote aria-hidden />
							공통 문구
						</TabsTrigger>
					)}
				</TabsList>
				<TabsContent value="features" className="flex min-h-0 flex-1 flex-col">
					{featuresQuery.error && !featuresQuery.data && (
						<Alert variant="danger" className="m-3 w-auto">
							<AlertDescription className="col-start-auto">
								{errorText(featuresQuery.error, "AI 기능 목록을 불러올 수 없습니다.")}
							</AlertDescription>
						</Alert>
					)}
					<div className="flex min-h-0 flex-1 overflow-hidden">
						<div className="flex w-72 shrink-0 flex-col border-r">
							<div className="border-b p-2">
								<Button type="button" size="xs" variant="outline" onClick={startNew}>
									<Plus aria-hidden />
									기능 추가
								</Button>
							</div>
							<ul className="min-h-0 flex-1 divide-y overflow-y-auto" aria-label="AI 기능 목록">
								{featuresQuery.isPending
									? Array.from({ length: 4 }, (_, index) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: 자리표시
											<li key={index} className="p-3" aria-hidden>
												<Skeleton className="h-9 w-full" />
											</li>
										))
									: features.map((feature) => {
											const isSelected = editing?.feature.key === feature.key;
											const state = !feature.enabled ? "꺼짐" : usable.has(feature.key) ? null : "연결 필요";
											return (
												<li key={feature.key}>
													<button
														type="button"
														aria-current={isSelected ? "true" : undefined}
														onClick={() => open(feature)}
														className={cn(
															"flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
															isSelected ? "bg-accent" : "hover:bg-accent/50",
														)}
													>
														<span className="flex w-full items-center gap-2">
															<span className="truncate font-medium text-sm">{feature.label}</span>
															{state && <span className="ml-auto shrink-0 text-muted-foreground text-xs">{state}</span>}
														</span>
														<span className="truncate text-muted-foreground text-xs">
															{placeLabel(feature)} · {ENGINE_LABELS[feature.engine]}
															{feature.custom && " · 직접 만듦"}
														</span>
													</button>
												</li>
											);
										})}
							</ul>
						</div>

						<div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
							{editing ? (
								<FeatureEditor
									key={editing.feature.key}
									feature={editing.feature}
									spec={editing.spec}
									saving={saving}
									error={formError}
									onChange={(spec) => setEditing({ ...editing, spec })}
									onSave={() => void save()}
									onReset={() => void reset(editing.feature)}
									custom={
										editing.base
											? {
													base: editing.base,
													onBaseChange: changeBase,
													isNew: editing.isNew === true,
													onDelete: editing.isNew ? () => setEditing(null) : () => void remove(editing.feature),
												}
											: undefined
									}
								/>
							) : (
								<Empty className="flex-1">
									<EmptyHeader>
										<EmptyMedia variant="icon">
											<Sparkles aria-hidden />
										</EmptyMedia>
										<EmptyTitle>기능을 고르세요</EmptyTitle>
									</EmptyHeader>
								</Empty>
							)}
						</div>
					</div>
				</TabsContent>
				{AI_SHARED_KEYS.length > 0 && (
					<TabsContent value="shared" className="flex min-h-0 flex-1 flex-col">
						<SharedTextsEditor />
					</TabsContent>
				)}
				<TabsContent value="connections" className="flex min-h-0 flex-1 flex-col">
					<ConnectionManager />
				</TabsContent>
			</Tabs>
		</AdminShell>
	);
}

/** 선택지 안 검사의 목록 입력. 한 줄에 값 하나이고, 빈 줄은 뺀다. */
function OneOfInput({
	items,
	disabled,
	onChange,
}: {
	items: readonly string[];
	disabled: boolean;
	onChange: (items: string[]) => void;
}) {
	const [text, setText] = useState(items.join("\n"));
	return (
		<Textarea
			aria-label="선택지"
			rows={3}
			value={text}
			disabled={disabled}
			onChange={(event) => {
				setText(event.target.value);
				const next = event.target.value
					.split("\n")
					.map((line) => line.trim())
					.filter(Boolean);
				if (next.length > 0) onChange(next);
			}}
			className="field-sizing-fixed min-h-16 min-w-0 max-w-md flex-1 font-mono text-xs md:text-xs"
		/>
	);
}

/** 검사 한 줄. 켜고 끄며, 형식은 정규식, 길이는 글자 수, 선택지 안은 값 목록을 고친다. 더한 검사는 뺄 수 있다. */
function CheckRow({
	check,
	onChange,
	onRemove,
}: {
	check: AiCheck;
	onChange: (check: AiCheck) => void;
	onRemove?: () => void;
}) {
	const id = useId();
	return (
		<li className={cn("flex min-h-8 gap-2", check.kind === "oneOf" ? "items-start [&>label]:pt-1.5" : "items-center")}>
			<Switch
				id={id}
				size="sm"
				checked={check.enabled}
				onCheckedChange={(enabled) => onChange({ ...check, enabled })}
			/>
			<Label htmlFor={id} className="w-20 shrink-0 font-normal text-xs">
				{CHECK_LABELS[check.kind]}
			</Label>
			{check.kind === "pattern" && (
				<Input
					aria-label="형식 정규식"
					value={check.pattern}
					disabled={!check.enabled}
					onChange={(event) => onChange({ ...check, pattern: event.target.value })}
					className="h-8 min-w-0 flex-1 font-mono text-xs"
				/>
			)}
			{check.kind === "maxLength" && (
				<span className="flex items-center gap-2">
					<Input
						type="number"
						aria-label="최대 글자 수"
						min={1}
						max={5000}
						value={check.max}
						disabled={!check.enabled}
						onChange={(event) =>
							onChange({ ...check, max: Math.min(5000, Math.max(1, Number(event.target.value) || 1)) })
						}
						className="h-8 w-20 text-xs"
					/>
					<span className="text-muted-foreground">자 이하</span>
				</span>
			)}
			{check.kind === "oneOf" && (
				<OneOfInput items={check.items} disabled={!check.enabled} onChange={(items) => onChange({ ...check, items })} />
			)}
			{onRemove && (
				<Button
					type="button"
					size="icon-xs"
					variant="ghost"
					aria-label={`${CHECK_LABELS[check.kind]} 검사 빼기`}
					onClick={onRemove}
					className="ml-auto"
				>
					<X aria-hidden />
				</Button>
			)}
		</li>
	);
}

function FeatureEditor({
	feature,
	spec,
	saving,
	error,
	onChange,
	onSave,
	onReset,
	custom,
}: {
	feature: AiActionView;
	spec: Editable;
	saving: boolean;
	error: string | null;
	onChange: (spec: Editable) => void;
	onSave: () => void;
	onReset: () => void;
	/** 화면 기능이면 기본 정보 고치기와 지우기. 새 기능(`isNew`)이면 지우기 대신 취소다. */
	custom?: { base: CustomBase; onBaseChange: (base: CustomBase) => void; onDelete: () => void; isNew: boolean };
}) {
	const ids = { provider: useId(), prompt: useId(), threshold: useId() };
	const deciding = feature.engine === "decide";
	const settings = useAiSettings().data;
	const kind = deciding ? "decisions" : "chat";
	const providers = (settings?.providers ?? []).filter((provider) => provider.kind === kind);
	const chosen = spec.providerId
		? providers.find((provider) => provider.id === spec.providerId)
		: providers.find((provider) => provider.ready);
	const canRun =
		Boolean(settings?.fake) || Boolean(chosen?.url && chosen.keyHint && (spec.modelName || chosen.defaultModel));
	// 고른 생성 연결의 모델 목록. 한 번 받은 목록은 기억해 두고 다시 받지 않는다.
	const modelList = useModelList(!deciding && chosen?.keyHint ? { providerId: chosen.id } : null);
	const [sample, setSample] = useState<Sample>(EMPTY_SAMPLE);
	const [test, setTest] = useState<
		{ status: "running" } | { status: "done"; result: AiRunResult } | { status: "error"; message: string } | null
	>(null);
	const set = (patch: Partial<Editable>) => onChange({ ...spec, ...patch });
	// 더할 수 있는 검사: 형식·길이·선택지 안 중 아직 없는 것. MDX 결과(본문 조각)는 글자 검사를 더하지 않는다.
	const addableChecks = (Object.keys(ADDABLE_CHECKS) as AddableCheckKind[]).filter(
		(kind) =>
			feature.result !== "mdx" && feature.result !== "note" && !spec.checks.some((check) => check.kind === kind),
	);
	const uses = (input: string) => spec.send.includes(input);
	const inputs = Object.entries(feature.input).filter(
		([, input]) => input.kind !== "locale" && !(deciding && input.kind === "image"),
	);

	const translating = isTranslation(feature);
	const runTest = async () => {
		setTest({ status: "running" });
		try {
			// 화면 기능은 고치는 중인 기본 정보로 시험한다(아직 저장하지 않은 새 기능 포함).
			const options = {
				draft: spec,
				request: spec.askInstruction ? sample.request : undefined,
				...(custom ? { draftBase: { ...custom.base, label: custom.base.label.trim() || "새 기능" } } : {}),
			};
			if (translating) {
				// 번역은 예시 MDX 한 블록을 번역본 편집기와 같은 길(여러 입력 실행)로 보낸다.
				const [item] = await runAiActionMany(
					feature.key,
					[{ block: sample.body, from: DEFAULT_LOCALE, to: sample.targetLocale }],
					{ ...options, env: { locale: sample.targetLocale } },
				);
				if (!item || "error" in item) throw new Error(item?.error ?? "번역하지 못했습니다.");
				setTest({ status: "done", result: item.result });
				return;
			}
			const { input, env } = inputFromContext(feature, sampleContext(feature, sample));
			setTest({ status: "done", result: await runAiAction(feature.key, input, { ...options, env }) });
		} catch (runError) {
			setTest({ status: "error", message: errorText(runError, "실행하지 못했습니다.") });
		}
	};

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6 text-sm">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<div className="min-w-0 flex-1">
					<h2 className="truncate font-medium text-base">
						{(custom ? custom.base.label.trim() : feature.label) || "새 기능"}
					</h2>
					<p className="truncate text-muted-foreground text-xs">
						{placeLabel(feature)} · {ENGINE_LABELS[feature.engine]}
					</p>
				</div>
				<Label className="font-normal text-xs">
					<Switch size="sm" checked={spec.enabled} onCheckedChange={(enabled) => set({ enabled })} />
					켜기
				</Label>
				<Label className="font-normal text-xs">
					<Switch
						size="sm"
						checked={spec.askInstruction}
						onCheckedChange={(askInstruction) => set({ askInstruction })}
					/>
					요청 받기
				</Label>
				{feature.apply !== "none" && (feature.result === "candidates" || feature.result === "text") && (
					<Label className="font-normal text-xs">
						<Switch size="sm" checked={spec.instant} onCheckedChange={(instant) => set({ instant })} />
						바로 넣기
					</Label>
				)}
			</div>

			{custom && (
				<section aria-label="기본 정보" className="rounded-md border p-3">
					<CustomBaseFields base={custom.base} onChange={custom.onBaseChange} />
				</section>
			)}

			<section className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-xs">
				<Label htmlFor={ids.provider} className="text-muted-foreground text-xs">
					연결
				</Label>
				<div className="flex min-w-0 items-center gap-2">
					<select
						id={ids.provider}
						value={spec.providerId ?? ""}
						onChange={(event) => set({ providerId: event.target.value || null, modelName: "" })}
						className={selectClass}
					>
						<option value="">첫 {ENGINE_LABELS[feature.engine]} 연결</option>
						{spec.providerId && !providers.some((provider) => provider.id === spec.providerId) && (
							<option value={spec.providerId}>삭제된 연결</option>
						)}
						{providers.map((provider) => (
							<option key={provider.id} value={provider.id}>
								{provider.name}
							</option>
						))}
					</select>
					<ModelCombobox
						aria-label="모델"
						value={spec.modelName}
						models={modelList.models}
						loading={modelList.loading}
						error={modelList.error}
						placeholder={chosen?.defaultModel || "기본 모델"}
						onChange={(modelName) => set({ modelName })}
					/>
				</div>

				{inputs.length > 0 && <span className="text-muted-foreground">보낼 내용</span>}
				<div className={cn("flex flex-wrap gap-3", inputs.length === 0 && "hidden")}>
					{inputs.map(([name, input]) => (
						<Label key={name} className="font-normal text-xs">
							<Checkbox
								checked={uses(name) || input.required}
								disabled={input.required}
								onCheckedChange={(checked) =>
									set({
										send: checked === true ? [...spec.send, name] : spec.send.filter((item) => item !== name),
									})
								}
							/>
							{input.label}
						</Label>
					))}
				</div>

				{deciding && (
					<>
						<Label htmlFor={ids.threshold} className="text-muted-foreground text-xs">
							기준 확률
						</Label>
						<div className="flex items-center gap-2">
							<Input
								id={ids.threshold}
								type="number"
								min={1}
								max={99}
								value={Math.round(spec.threshold * 100)}
								onChange={(event) =>
									set({ threshold: Math.min(99, Math.max(1, Number(event.target.value) || 1)) / 100 })
								}
								className="h-8 w-20 text-xs"
							/>
							<span className="text-muted-foreground">% 이상</span>
							<Input
								type="number"
								aria-label="최대 개수"
								min={1}
								max={20}
								value={spec.maxCount}
								onChange={(event) => set({ maxCount: Math.min(20, Math.max(1, Number(event.target.value) || 1)) })}
								className="ml-3 h-8 w-16 text-xs"
							/>
							<span className="text-muted-foreground">개까지</span>
						</div>
					</>
				)}

				<span className="self-start pt-2 text-muted-foreground">검사</span>
				<div className="flex flex-col gap-1.5">
					<ul className="flex flex-col gap-1.5" aria-label="검사">
						{spec.checks.map((check, index) => (
							<CheckRow
								key={check.kind}
								check={check}
								onChange={(next) => set({ checks: spec.checks.map((item, i) => (i === index ? next : item)) })}
								onRemove={
									feature.definedChecks.includes(check.kind)
										? undefined
										: () => set({ checks: spec.checks.filter((_, i) => i !== index) })
								}
							/>
						))}
						{feature.validated && (
							<li className="flex min-h-8 items-center gap-2 text-xs">
								<Code aria-hidden className="size-3.5 text-muted-foreground" />
								코드 검사
							</li>
						)}
					</ul>
					{addableChecks.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger
								render={<Button type="button" size="xs" variant="ghost" className="self-start text-muted-foreground" />}
							>
								<Plus aria-hidden />
								검사 추가
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="min-w-32">
								{addableChecks.map((kind) => (
									<DropdownMenuItem key={kind} onClick={() => set({ checks: [...spec.checks, ADDABLE_CHECKS[kind]] })}>
										{CHECK_LABELS[kind]}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</section>

			<div className="flex flex-col gap-1.5">
				<Label htmlFor={ids.prompt} className="text-muted-foreground text-xs">
					{deciding ? "판단 기준" : "지시문"}
				</Label>
				<Textarea
					id={ids.prompt}
					rows={8}
					value={spec.prompt}
					onChange={(event) => set({ prompt: event.target.value })}
					className="font-mono text-xs md:text-xs"
				/>
			</div>

			{error && (
				<p role="alert" className="text-destructive text-xs">
					{error}
				</p>
			)}

			<div className="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					size="sm"
					disabled={saving || (custom?.isNew === true && !custom.base.label.trim())}
					onClick={onSave}
				>
					{custom?.isNew ? <Plus aria-hidden /> : <Save aria-hidden />}
					{saving ? "저장 중…" : custom?.isNew ? "만들기" : "저장"}
				</Button>
				{custom?.isNew ? (
					<Button type="button" size="sm" variant="outline" onClick={custom.onDelete}>
						취소
					</Button>
				) : custom ? (
					<Button type="button" size="sm" variant="outline" className="text-destructive" onClick={custom.onDelete}>
						<Trash2 aria-hidden />
						지우기
					</Button>
				) : (
					<Button type="button" size="sm" variant="outline" onClick={onReset}>
						<RotateCcw aria-hidden />
						기본값
					</Button>
				)}
				{!custom?.isNew && (
					<span className="ml-auto text-muted-foreground text-xs">
						{feature.updatedAt ? `${new Date(feature.updatedAt).toLocaleString("ko-KR")} 고침` : "기본값"}
					</span>
				)}
			</div>

			<section className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-xs" aria-label="시험">
				<div className="flex items-center gap-2">
					<span className="font-medium">시험</span>
					<Button
						type="button"
						size="xs"
						variant="outline"
						className="ml-auto"
						disabled={!canRun || test?.status === "running" || (translating && !sample.body.trim())}
						onClick={() => void runTest()}
					>
						<Sparkles aria-hidden />
						{test?.status === "running" ? "만드는 중…" : "실행"}
					</Button>
				</div>
				{spec.askInstruction && (
					<Input
						aria-label="추가 요청"
						placeholder="추가 요청"
						value={sample.request}
						onChange={(event) => setSample({ ...sample, request: event.target.value })}
						className="h-8 bg-background text-xs"
					/>
				)}
				{translating && (
					<>
						<select
							aria-label="대상 언어"
							value={sample.targetLocale}
							onChange={(event) => setSample({ ...sample, targetLocale: event.target.value })}
							className={cn(selectClass, "w-auto bg-background")}
						>
							{PREFIXED_LOCALES.map((locale) => (
								<option key={locale} value={locale}>
									{localeLabel(locale)}
								</option>
							))}
						</select>
						<Textarea
							aria-label="예시 MDX"
							placeholder="예시 MDX"
							rows={5}
							value={sample.body}
							onChange={(event) => setSample({ ...sample, body: event.target.value })}
							className="bg-background font-mono text-xs md:text-xs"
						/>
					</>
				)}
				{(uses("title") || feature.attach.some((attach) => attach.slot === "field")) && (
					<Input
						aria-label="예시 제목"
						placeholder="예시 제목"
						value={sample.title}
						onChange={(event) => setSample({ ...sample, title: event.target.value })}
						className="h-8 bg-background text-xs"
					/>
				)}
				{(uses("body") || uses("around") || uses("summary")) && (
					<Textarea
						aria-label="예시 본문"
						placeholder="예시 본문"
						rows={4}
						value={sample.body}
						onChange={(event) => setSample({ ...sample, body: event.target.value })}
						className="bg-background text-xs md:text-xs"
					/>
				)}
				{uses("code") && (
					<Textarea
						aria-label="예시 코드"
						placeholder="예시 코드"
						rows={4}
						value={sample.code}
						onChange={(event) => setSample({ ...sample, code: event.target.value })}
						className="bg-background font-mono text-xs md:text-xs"
					/>
				)}
				{uses("image") && (
					<Input
						aria-label="미디어 ID"
						placeholder="미디어 ID"
						value={sample.mediaId}
						onChange={(event) => setSample({ ...sample, mediaId: event.target.value })}
						className="h-8 bg-background font-mono text-xs"
					/>
				)}
				{test?.status === "error" && (
					<p role="alert" className="text-destructive">
						{test.message}
					</p>
				)}
				{test?.status === "done" &&
					(test.result.kind === "candidates" ? (
						test.result.items.length === 0 ? (
							<p className="text-muted-foreground">검사를 통과한 후보가 없습니다.</p>
						) : (
							<ul className="flex flex-wrap gap-1">
								{test.result.items.map((item) => (
									<li
										key={item.value}
										className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5"
									>
										<Check aria-hidden className="size-3 text-muted-foreground" />
										{item.label}
										{item.detail && <span className="text-muted-foreground">{item.detail}</span>}
									</li>
								))}
							</ul>
						)
					) : (
						<p className="whitespace-pre-wrap rounded border bg-background p-2">{test.result.text}</p>
					))}
			</section>
		</div>
	);
}
