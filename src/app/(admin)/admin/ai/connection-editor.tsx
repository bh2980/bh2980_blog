"use client";

import {
	AI_PROVIDER_KINDS,
	type AiCheckResult,
	type AiProviderKind,
	type AiProviderView,
	type AiSettingsView,
	PROVIDER_EXAMPLES,
	PROVIDER_KIND_LABELS,
} from "@bh2980/cms/ai/connection";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, PlugZap, Plus, Save, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import { cmsFetch, errorText } from "../admin-api";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { useDebounced } from "../shared/use-debounced";
import { AI_ACTIONS_KEY } from "./ai-slot-provider";
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

/** 모델 목록을 받기 전에 주소·키 입력이 멈추길 기다리는 시간. */
const LIST_INPUT_DEBOUNCE_MS = 400;

const selectClass =
	"h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** 키 입력 상태. `undefined`는 저장된 키 그대로, `null`은 지우기. */
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

/**
 * AI 화면 `연결` 탭. 연결을 여러 개 두고(이름·종류·주소·키·기본 모델), 기능마다 어느 연결을 쓸지 고른다.
 * 키는 서버가 암호화해 저장하고 여기에는 끝 네 글자만 보인다.
 */
export function ConnectionManager() {
	const queryClient = useQueryClient();
	const settingsQuery = useAiSettings();
	const settings = settingsQuery.data;
	const [selected, setSelected] = useState<string | "new" | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

	const applySaved = (saved: AiSettingsView) => {
		queryClient.setQueryData(AI_SETTINGS_KEY, saved);
		void queryClient.invalidateQueries({ queryKey: AI_ACTIONS_KEY });
	};

	const current = settings?.providers.find((provider) => provider.id === selected) ?? null;

	const remove = async (provider: AiProviderView) => {
		if (!settings) return;
		try {
			applySaved(
				await cmsFetch<AiSettingsView>(`/api/cms/v1/ai/providers/${provider.id}?expectedVersion=${settings.version}`, {
					method: "DELETE",
					fallback: "삭제하지 못했습니다.",
				}),
			);
			setSelected(null);
			toast.success(`'${provider.name}'을(를) 삭제했습니다.`);
		} catch (error) {
			toast.error(errorText(error, "삭제하지 못했습니다."));
			void settingsQuery.refetch();
		}
	};

	return (
		<div className="flex min-h-0 flex-1 overflow-hidden">
			<div className="flex w-72 shrink-0 flex-col border-r">
				{settings?.fake && (
					<p className="border-b px-3 py-2 text-muted-foreground text-xs">개발용 가짜 연결(CMS_AI_FAKE) 사용 중</p>
				)}
				<ul className="flex-1 divide-y overflow-y-auto" aria-label="연결 목록">
					{!settings
						? Array.from({ length: 2 }, (_, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: 자리표시
								<li key={index} className="p-3" aria-hidden>
									<Skeleton className="h-9 w-full" />
								</li>
							))
						: settings.providers.map((provider) => (
								<li key={provider.id}>
									<button
										type="button"
										aria-current={selected === provider.id ? "true" : undefined}
										onClick={() => setSelected(provider.id)}
										className={cn(
											"flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
											selected === provider.id ? "bg-accent" : "hover:bg-accent/50",
										)}
									>
										<span className="flex w-full items-center gap-2">
											<span
												aria-hidden
												className={cn(
													"size-2 shrink-0 rounded-full",
													provider.ready ? "bg-emerald-500" : "bg-muted-foreground/40",
												)}
											/>
											<span className="truncate font-medium text-sm">{provider.name}</span>
											<span className="ml-auto shrink-0 text-muted-foreground text-xs">
												{PROVIDER_KIND_LABELS[provider.kind]}
											</span>
										</span>
										<span className="w-full truncate pl-4 font-mono text-muted-foreground text-xs">
											{provider.defaultModel || "모델 없음"}
										</span>
									</button>
								</li>
							))}
				</ul>
				<div className="border-t p-2">
					<Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setSelected("new")}>
						<Plus aria-hidden />
						연결 추가
					</Button>
				</div>
			</div>

			<div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
				{settingsQuery.error && !settings ? (
					<p role="alert" className="p-6 text-destructive text-xs">
						{errorText(settingsQuery.error, "연결 목록을 불러올 수 없습니다.")}
					</p>
				) : settings && (selected === "new" || current) ? (
					<ProviderEditor
						key={selected ?? "none"}
						version={settings.version}
						provider={current}
						onSaved={(saved, id) => {
							applySaved(saved);
							setSelected(id);
						}}
						onConflict={() => void settingsQuery.refetch()}
						onDelete={
							current
								? () =>
										setConfirm({
											title: "연결 삭제",
											description: `'${current.name}'을(를) 삭제합니다. 이 연결을 고른 기능은 같은 종류의 첫 연결을 씁니다.`,
											confirmLabel: "삭제",
											destructive: true,
											onConfirm: () => remove(current),
										})
								: undefined
						}
					/>
				) : (
					<Empty className="flex-1">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Plug aria-hidden />
							</EmptyMedia>
							<EmptyTitle>연결을 고르거나 추가하세요</EmptyTitle>
						</EmptyHeader>
						<EmptyContent>
							<Button type="button" size="sm" onClick={() => setSelected("new")}>
								<Plus aria-hidden />
								연결 추가
							</Button>
						</EmptyContent>
					</Empty>
				)}
			</div>
			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
		</div>
	);
}

function ProviderEditor({
	version,
	provider,
	onSaved,
	onConflict,
	onDelete,
}: {
	version: number;
	provider: AiProviderView | null;
	onSaved: (saved: AiSettingsView, id: string) => void;
	onConflict: () => void;
	onDelete?: () => void;
}) {
	const [draft, setDraft] = useState<Draft>(provider ? draftOf(provider) : NEW_DRAFT);
	const [saving, setSaving] = useState(false);
	const [checking, setChecking] = useState(false);
	const [check, setCheck] = useState<AiCheckResult | null>(null);
	const ids = { name: useId(), kind: useId(), url: useId(), key: useId(), model: useId() };
	const set = (patch: Partial<Draft>) => {
		setDraft({ ...draft, ...patch });
		setCheck(null);
	};
	const example = PROVIDER_EXAMPLES[draft.kind];
	// 주소·키를 치는 동안에는 목록을 받지 않고, 멈추면 받는다. 저장한 키를 그대로 쓰면 연결 id로 받는다.
	// 주소·키를 치는 동안 모델 목록을 여러 번 받지 않는다.
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
						fallback: "추가하지 못했습니다.",
					});
			// 새 연결은 목록 끝에 붙는다.
			const id = provider?.id ?? saved.providers.at(-1)?.id ?? "";
			onSaved(saved, id);
			toast.success("저장했습니다.");
		} catch (error) {
			toast.error(errorText(error, "저장하지 못했습니다."));
			onConflict();
		} finally {
			setSaving(false);
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
		} catch (error) {
			setCheck({ ok: false, message: errorText(error, "연결을 확인하지 못했습니다.") });
		} finally {
			setChecking(false);
		}
	};

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6 text-sm">
			<div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-xs">
				<Label htmlFor={ids.name} className="text-muted-foreground text-xs">
					이름
				</Label>
				<Input
					id={ids.name}
					value={draft.name}
					placeholder="OpenRouter"
					onChange={(event) => set({ name: event.target.value })}
					className="h-8 text-xs"
				/>
				<Label htmlFor={ids.kind} className="text-muted-foreground text-xs">
					종류
				</Label>
				<select
					id={ids.kind}
					value={draft.kind}
					disabled={Boolean(provider)}
					onChange={(event) => set({ kind: event.target.value as AiProviderKind })}
					className={selectClass}
				>
					{AI_PROVIDER_KINDS.map((kind) => (
						<option key={kind} value={kind}>
							{PROVIDER_KIND_LABELS[kind]}
						</option>
					))}
				</select>
				<Label htmlFor={ids.url} className="text-muted-foreground text-xs">
					주소
				</Label>
				<Input
					id={ids.url}
					value={draft.url}
					placeholder={example.url}
					onChange={(event) => set({ url: event.target.value.trim() })}
					className="h-8 font-mono text-xs"
				/>
				<Label htmlFor={ids.key} className="text-muted-foreground text-xs">
					키
				</Label>
				<div className="flex items-center gap-2">
					<Input
						id={ids.key}
						type="password"
						autoComplete="off"
						value={typeof draft.apiKey === "string" ? draft.apiKey : ""}
						placeholder={draft.apiKey === null ? "지움" : provider?.keyHint ? `저장됨 ${provider.keyHint}` : "키"}
						onChange={(event) => set({ apiKey: event.target.value || undefined })}
						className="h-8 font-mono text-xs"
					/>
					{provider?.keyHint && draft.apiKey !== null && (
						<Button type="button" variant="ghost" size="xs" onClick={() => set({ apiKey: null })}>
							지우기
						</Button>
					)}
				</div>
				<Label htmlFor={ids.model} className="text-muted-foreground text-xs">
					기본 모델
				</Label>
				<ModelCombobox
					id={ids.model}
					value={draft.defaultModel}
					models={modelList.models}
					loading={modelList.loading}
					error={modelList.error}
					placeholder={example.model}
					onChange={(defaultModel) => set({ defaultModel })}
				/>
			</div>

			<div className="flex flex-wrap items-center gap-2">
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
				<Button type="button" size="sm" disabled={saving || !draft.name.trim()} onClick={() => void save()}>
					<Save aria-hidden />
					{saving ? "저장 중…" : "저장"}
				</Button>
				{onDelete && (
					<Button type="button" size="sm" variant="ghost" className="ml-auto text-destructive" onClick={onDelete}>
						<Trash2 aria-hidden />
						삭제
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
		</div>
	);
}
