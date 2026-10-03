"use client";

import { cmsFetch, errorText } from "@bh2980/cms-admin/api";
import { useConfirm } from "@bh2980/cms-admin/confirm-dialog";
import { useDebounced } from "@bh2980/cms-admin/hooks/use-debounced";
import { cn } from "@bh2980/cms-admin/lib/utils/cn";
import { Alert, AlertDescription } from "@bh2980/cms-admin/ui/alert";
import { Button } from "@bh2980/cms-admin/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@bh2980/cms-admin/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@bh2980/cms-admin/ui/field";
import { Input } from "@bh2980/cms-admin/ui/input";
import { Skeleton } from "@bh2980/cms-admin/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, PlugZap, Plus, Save, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
	AI_PROVIDER_KINDS,
	type AiCheckResult,
	type AiProviderKind,
	type AiProviderView,
	type AiSettingsView,
	PROVIDER_EXAMPLES,
	PROVIDER_KIND_LABELS,
} from "../connection";
import { AI_ACTIONS_KEY } from "./ai-slot-provider";
import { OptionSelect } from "./custom-editor";
import { ModelCombobox, type ModelSource, useModelList } from "./model-combobox";

export const AI_SETTINGS_KEY = ["cms", "ai", "settings"] as const;

export function useAiSettings() {
	return useQuery({
		queryKey: AI_SETTINGS_KEY,
		queryFn: ({ signal }) =>
			cmsFetch<AiSettingsView>("/api/cms/v1/ai/settings", { signal, fallback: "연결 목록을 불러올 수 없습니다." }),
		// 기능을 열 때마다 다시 받지 않는다. 연결을 저장하면 응답으로 캐시를 바꾼다.
		staleTime: 60_000,
	});
}

/** AI 화면 세 탭이 같이 쓰는 조각. 목록의 열린 항목 모양은 관리자 화면의 `OPEN_ITEM`과 같다. */
export const OPEN_ITEM = "bg-accent text-accent-foreground";

/** 상세 칸의 틀(기능·연결·공통 문구가 같이 쓴다). */
export const DETAIL_PANE = "mx-auto flex w-full max-w-3xl flex-col gap-5 p-6 text-sm";

/** 불러오기 실패. 그 자리에 알리고 다시 받을 수 있게 한다. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<Alert variant="danger" className="m-3 flex w-auto items-center justify-between gap-3">
			<AlertDescription className="col-start-auto">{message}</AlertDescription>
			<Button type="button" variant="outline" size="xs" onClick={onRetry}>
				다시 시도
			</Button>
		</Alert>
	);
}

/** 목록 한 줄. 이름 오른쪽에 상태 글자, 아래에 흐린 설명을 둔다. */
export function ListRow({
	title,
	status,
	detail,
	current,
	onClick,
}: {
	title: string;
	status?: string | null;
	detail: ReactNode;
	current: boolean;
	onClick: () => void;
}) {
	return (
		<li>
			<button
				type="button"
				aria-current={current ? "true" : undefined}
				onClick={onClick}
				className={cn(
					"flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
					current ? OPEN_ITEM : "hover:bg-accent/50",
				)}
			>
				<span className="flex w-full items-center gap-2">
					<span className="truncate font-medium text-sm">{title}</span>
					{status && <span className="ml-auto shrink-0 text-muted-foreground text-xs">{status}</span>}
				</span>
				<span className="w-full truncate text-muted-foreground text-xs">{detail}</span>
			</button>
		</li>
	);
}

/** 목록을 불러오는 동안의 자리표시. */
export function ListSkeleton({ rows }: { rows: number }) {
	return Array.from({ length: rows }, (_, index) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: 자리표시
		<li key={index} className="p-3" aria-hidden>
			<Skeleton className="h-9 w-full" />
		</li>
	));
}

/** 오류 한 줄(편집 칸 안). */
export function InlineError({ children }: { children: ReactNode }) {
	return (
		<p role="alert" className="text-destructive text-xs">
			{children}
		</p>
	);
}

/** 모델 목록을 받기 전에 주소·키 입력이 멈추길 기다리는 시간. */
const LIST_INPUT_DEBOUNCE_MS = 400;

/** 키 입력 상태. `undefined`는 저장된 키 그대로, `null`은 비우기. */
type KeyDraft = string | null | undefined;

interface Draft {
	name: string;
	kind: AiProviderKind;
	url: string;
	apiKey: KeyDraft;
	defaultModel: string;
}

const NEW_DRAFT: Draft = { name: "", kind: "chat", url: "", apiKey: undefined, defaultModel: "" };

const draftOf = (provider: AiProviderView): Draft => ({
	name: provider.name,
	kind: provider.kind,
	url: provider.url,
	apiKey: undefined,
	defaultModel: provider.defaultModel,
});

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

/**
 * AI 화면 `연결` 탭. 연결을 여러 개 두고(이름·방식·주소·키·기본 모델), 기능마다 어느 연결을 쓸지 고른다.
 * 키는 서버가 암호화해 저장하고 여기에는 끝 네 글자만 보인다.
 * 연 연결(`selected`)은 AI 화면이 든다. 머리의 `연결 추가`와 탭 바꾸기에서 저장하지 않은 내용을 묻기 때문이다.
 */
export function ConnectionManager({
	selected,
	onOpen,
	onSelectedChange,
	onDirtyChange,
}: {
	selected: string | "new" | null;
	/** 목록에서 연다. 저장하지 않은 내용이 있으면 AI 화면이 먼저 묻는다. */
	onOpen: (id: string | "new") => void;
	/** 저장·삭제·취소 뒤 묻지 않고 바꾼다. */
	onSelectedChange: (id: string | null) => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const settingsQuery = useAiSettings();
	const settings = settingsQuery.data;

	const applySaved = (saved: AiSettingsView) => {
		queryClient.setQueryData(AI_SETTINGS_KEY, saved);
		void queryClient.invalidateQueries({ queryKey: AI_ACTIONS_KEY });
	};

	const current = settings?.providers.find((provider) => provider.id === selected) ?? null;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{settingsQuery.error && !settings && (
				<LoadError
					message={errorText(settingsQuery.error, "연결 목록을 불러올 수 없습니다.")}
					onRetry={() => void settingsQuery.refetch()}
				/>
			)}
			<div className="flex min-h-0 flex-1 overflow-hidden">
				<div className="flex w-72 shrink-0 flex-col border-r">
					{settings?.fake && <p className="border-b px-3 py-2 text-muted-foreground text-xs">가짜 연결 사용 중</p>}
					<ul className="min-h-0 flex-1 divide-y overflow-y-auto" aria-label="연결 목록">
						{settingsQuery.isPending ? (
							<ListSkeleton rows={2} />
						) : settings?.providers.length === 0 ? (
							<li className="px-3 py-6 text-center text-muted-foreground text-xs">연결이 없습니다.</li>
						) : (
							settings?.providers.map((provider) => (
								<ListRow
									key={provider.id}
									title={provider.name}
									status={provider.ready ? null : "설정 필요"}
									detail={`${PROVIDER_KIND_LABELS[provider.kind]} · ${provider.defaultModel || "모델 없음"}`}
									current={selected === provider.id}
									onClick={() => onOpen(provider.id)}
								/>
							))
						)}
					</ul>
				</div>

				<div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
					{settings && (selected === "new" || current) ? (
						<ProviderEditor
							key={selected ?? "none"}
							version={settings.version}
							provider={current}
							onSaved={(saved, id) => {
								applySaved(saved);
								onSelectedChange(id);
							}}
							onDeleted={(saved) => {
								applySaved(saved);
								onSelectedChange(null);
							}}
							onCancel={() => onSelectedChange(null)}
							onConflict={() => void settingsQuery.refetch()}
							onDirtyChange={onDirtyChange}
						/>
					) : (
						settings && (
							<Empty className="flex-1">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<Plug aria-hidden />
									</EmptyMedia>
									<EmptyTitle>연결을 고르세요</EmptyTitle>
								</EmptyHeader>
								<EmptyContent>
									<Button type="button" size="sm" onClick={() => onOpen("new")}>
										<Plus aria-hidden />
										연결 추가
									</Button>
								</EmptyContent>
							</Empty>
						)
					)}
				</div>
			</div>
		</div>
	);
}

function ProviderEditor({
	version,
	provider,
	onSaved,
	onDeleted,
	onCancel,
	onConflict,
	onDirtyChange,
}: {
	version: number;
	provider: AiProviderView | null;
	onSaved: (saved: AiSettingsView, id: string) => void;
	onDeleted: (saved: AiSettingsView) => void;
	onCancel: () => void;
	onConflict: () => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const initial = provider ? draftOf(provider) : NEW_DRAFT;
	const [draft, setDraft] = useState<Draft>(initial);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [checking, setChecking] = useState(false);
	const [check, setCheck] = useState<AiCheckResult | null>(null);
	const { confirm, dialog } = useConfirm();
	const ids = { name: useId(), kind: useId(), url: useId(), key: useId(), model: useId() };
	const set = (patch: Partial<Draft>) => {
		setDraft({ ...draft, ...patch });
		setCheck(null);
	};
	const dirty = provider === null || !sameDraft(draft, initial);
	// 새 연결은 아무것도 적지 않았으면 버릴 것이 없다.
	const unsaved = provider === null ? !sameDraft(draft, NEW_DRAFT) : dirty;
	useEffect(() => onDirtyChange(unsaved), [unsaved, onDirtyChange]);
	useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

	const example = PROVIDER_EXAMPLES[draft.kind];
	// 주소·키를 치는 동안에는 목록을 받지 않고, 멈추면 받는다. 저장한 키를 그대로 쓰면 연결 id로 받는다.
	const listUrl = useDebounced(draft.url, LIST_INPUT_DEBOUNCE_MS);
	const listKey = useDebounced(typeof draft.apiKey === "string" ? draft.apiKey : undefined, LIST_INPUT_DEBOUNCE_MS);
	const modelSource: ModelSource | null =
		draft.kind !== "chat" || !listUrl
			? null
			: listKey
				? { url: listUrl, apiKey: listKey }
				: provider?.keyHint && provider.url === listUrl && draft.apiKey === undefined
					? { providerId: provider.id }
					: null;
	const modelList = useModelList(modelSource);

	const save = async () => {
		setSaving(true);
		setError(null);
		try {
			const json = { expectedVersion: version, provider: draft };
			const saved = provider
				? await cmsFetch<AiSettingsView>(`/api/cms/v1/ai/providers/${provider.id}`, {
						method: "PATCH",
						json,
						fallback: "저장하지 못했습니다.",
					})
				: await cmsFetch<AiSettingsView>("/api/cms/v1/ai/providers", {
						method: "POST",
						json,
						fallback: "저장하지 못했습니다.",
					});
			// 새 연결은 목록 끝에 붙는다.
			const id = provider?.id ?? saved.providers.at(-1)?.id ?? "";
			onSaved(saved, id);
			toast.success("저장했습니다.");
		} catch (saveError) {
			setError(errorText(saveError, "저장하지 못했습니다."));
			onConflict();
		} finally {
			setSaving(false);
		}
	};

	const remove = async () => {
		if (!provider) return;
		const ok = await confirm({
			title: "연결 삭제",
			description: `'${provider.name}'을(를) 삭제할까요? 이 연결을 고른 기능은 같은 방식의 첫 연결을 씁니다.`,
			confirmLabel: "삭제",
			destructive: true,
		});
		if (!ok) return;
		setDeleting(true);
		setError(null);
		try {
			onDeleted(
				await cmsFetch<AiSettingsView>(`/api/cms/v1/ai/providers/${provider.id}?expectedVersion=${version}`, {
					method: "DELETE",
					fallback: "삭제하지 못했습니다.",
				}),
			);
			toast.success("삭제했습니다.");
		} catch (deleteError) {
			setError(errorText(deleteError, "삭제하지 못했습니다."));
			onConflict();
		} finally {
			setDeleting(false);
		}
	};

	/** 저장하기 전 지금 입력값으로 확인한다. 키를 새로 넣지 않았으면 저장된 키를 쓴다. */
	const runCheck = async () => {
		setChecking(true);
		try {
			setCheck(
				await cmsFetch<AiCheckResult>("/api/cms/v1/ai/providers/check", {
					method: "POST",
					json: { providerId: provider?.id, provider: draft },
					fallback: "연결을 확인하지 못했습니다.",
				}),
			);
		} catch (checkError) {
			setCheck({ ok: false, message: errorText(checkError, "연결을 확인하지 못했습니다.") });
		} finally {
			setChecking(false);
		}
	};

	return (
		<div className={DETAIL_PANE}>
			<div className="min-w-0">
				<h2 className="truncate font-medium text-base">
					{(provider ? provider.name : draft.name.trim()) || "새 연결"}
				</h2>
				<p className="truncate text-muted-foreground text-xs">
					{PROVIDER_KIND_LABELS[draft.kind]} · {provider?.defaultModel || draft.defaultModel || "모델 없음"}
				</p>
			</div>

			<FieldGroup className="gap-5">
				<Field>
					<FieldLabel htmlFor={ids.name}>이름</FieldLabel>
					<Input
						id={ids.name}
						value={draft.name}
						placeholder="OpenRouter"
						onChange={(event) => set({ name: event.target.value })}
						className="h-8 text-xs md:text-xs"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={ids.kind}>방식</FieldLabel>
					<OptionSelect
						id={ids.kind}
						value={draft.kind}
						disabled={Boolean(provider)}
						options={AI_PROVIDER_KINDS.map((kind) => ({ value: kind, label: PROVIDER_KIND_LABELS[kind] }))}
						onChange={(kind) => set({ kind: kind as AiProviderKind })}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={ids.url}>주소</FieldLabel>
					<Input
						id={ids.url}
						value={draft.url}
						placeholder={example.url}
						onChange={(event) => set({ url: event.target.value.trim() })}
						className="h-8 font-mono text-xs md:text-xs"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={ids.key}>키</FieldLabel>
					<div className="flex items-center gap-2">
						<Input
							id={ids.key}
							type="password"
							autoComplete="off"
							value={typeof draft.apiKey === "string" ? draft.apiKey : ""}
							placeholder={draft.apiKey === null ? "비움" : provider?.keyHint ? `저장됨 ${provider.keyHint}` : "키"}
							onChange={(event) => set({ apiKey: event.target.value || undefined })}
							className="h-8 font-mono text-xs md:text-xs"
						/>
						{provider?.keyHint && draft.apiKey !== null && (
							<Button type="button" variant="ghost" size="xs" onClick={() => set({ apiKey: null })}>
								비우기
							</Button>
						)}
					</div>
				</Field>
				<Field>
					<FieldLabel htmlFor={ids.model}>기본 모델</FieldLabel>
					<ModelCombobox
						id={ids.model}
						value={draft.defaultModel}
						models={modelList.models}
						loading={modelList.loading}
						error={modelList.error}
						placeholder={example.model}
						onChange={(defaultModel) => set({ defaultModel })}
					/>
				</Field>
			</FieldGroup>

			{error && <InlineError>{error}</InlineError>}

			<div className="flex flex-wrap items-center gap-2">
				<Button type="button" size="sm" disabled={saving || !dirty || !draft.name.trim()} onClick={() => void save()}>
					<Save aria-hidden />
					{saving ? "저장 중…" : "저장"}
				</Button>
				{!provider && (
					<Button type="button" size="sm" variant="outline" onClick={onCancel}>
						취소
					</Button>
				)}
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={checking || !draft.url || !draft.defaultModel}
					onClick={() => void runCheck()}
				>
					<PlugZap aria-hidden />
					{checking ? "확인 중…" : "연결 확인"}
				</Button>
				{provider && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
						disabled={deleting}
						onClick={() => void remove()}
					>
						<Trash2 aria-hidden />
						{deleting ? "삭제 중…" : "삭제"}
					</Button>
				)}
			</div>
			{check && (
				<p
					className={cn("text-xs", check.ok ? "text-muted-foreground" : "text-destructive")}
					role={check.ok ? undefined : "alert"}
				>
					{check.ok ? `연결됨 · ${check.model} · ${(check.ms / 1000).toFixed(1)}초` : check.message}
				</p>
			)}
			{dialog}
		</div>
	);
}
