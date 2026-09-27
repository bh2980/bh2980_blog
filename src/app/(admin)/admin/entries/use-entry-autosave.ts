"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CmsApiError, cmsFetch } from "../admin-api";
import { type EntryData, type EntryForm, type EntryFormPatch, formFingerprint, metadataFromForm } from "./entry-form";
import { backupKey, deleteLocalBackup, saveLocalBackup } from "./local-backup";

/** §5.1 저장 상태. */
export type SaveStatus = "saved" | "dirty" | "saving" | "local-only" | "failed" | "conflict" | "session-expired";

export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
	saved: "서버에 저장됨",
	dirty: "변경 있음",
	saving: "저장 중",
	"local-only": "브라우저에만 임시 저장됨",
	failed: "저장 실패",
	conflict: "충돌",
	"session-expired": "세션 만료 — 다시 로그인하세요",
};

const IDLE_MS = 2000;
const MAX_WAIT_MS = 10_000;
/** 자동 재시도 간격(§5.1). 이후에는 수동 재시도나 연결 복귀를 기다린다. */
export const RETRY_DELAYS_MS = [2000, 5000, 15_000];

interface Options {
	adminId: string;
	collection: string;
	/** 불러온 항목. 새 글이면 `null`이고 첫 저장 때 만든다. */
	entry: EntryData | null;
	initialForm: EntryForm;
	/** 예약 잠금·휴지통처럼 저장하면 안 되는 상태면 false다. */
	enabled: boolean;
	/** 새 글을 처음 저장할 때 넣을 폴더(목록에서 연 위치). */
	newEntryFolderId?: string | null;
	onSaved: (entry: EntryData) => void;
	onConflict: (server: EntryData, local: EntryForm) => void;
}

/**
 * 최신 초안 자동 저장과 브라우저 복구본(§5.1).
 *
 * - 입력이 2초 멈추거나, 계속 입력해도 마지막 저장 후 최대 10초마다 서버에 저장한다. IME 조합 중에는 미룬다.
 * - 요청은 한 번에 하나다. 전송 중 새 입력은 다음 요청에 합친다. 서버가 확인한 순번이 현재 순번과 같을 때만 완료로 본다.
 * - 네트워크·서버 오류는 복구본을 남기고 2·5·15초 뒤 자동 재시도한다. 연결이 돌아오면 서버 버전을 먼저 확인한다.
 * - 세션이 만료되면 복구본을 유지하고 다시 로그인하게 안내한다.
 */
export function useEntryAutosave({
	adminId,
	collection,
	entry,
	initialForm,
	enabled,
	newEntryFolderId,
	onSaved,
	onConflict,
}: Options) {
	const [form, setFormState] = useState<EntryForm>(initialForm);
	const [status, setStatus] = useState<SaveStatus>("saved");
	const [lastError, setLastError] = useState<string | null>(null);
	const [backupAvailable, setBackupAvailable] = useState(true);

	const formRef = useRef(initialForm);
	const entryIdRef = useRef<string | null>(entry?.id ?? null);
	const versionRef = useRef(entry?.version ?? 0);
	const baseMetadataRef = useRef<Record<string, unknown>>(entry?.working.metadata ?? {});
	const serverFingerprintRef = useRef(formFingerprint(initialForm));
	const changeSeqRef = useRef(0);
	const ackSeqRef = useRef(0);
	const inflightRef = useRef<Promise<boolean> | null>(null);
	const composingRef = useRef(false);
	const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const retryAttemptRef = useRef(0);
	const statusRef = useRef<SaveStatus>("saved");
	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;
	const callbacksRef = useRef({ onSaved, onConflict });
	callbacksRef.current = { onSaved, onConflict };

	const updateStatus = useCallback((next: SaveStatus) => {
		statusRef.current = next;
		setStatus(next);
	}, []);

	const clearTimers = useCallback(() => {
		for (const ref of [idleTimerRef, maxWaitTimerRef, retryTimerRef]) {
			if (ref.current) clearTimeout(ref.current);
			ref.current = null;
		}
	}, []);
	useEffect(() => clearTimers, [clearTimers]);

	/** 불러오기·재적재 뒤 기준값을 서버 값으로 맞춘다. */
	const resetFromServer = useCallback(
		(loaded: EntryData, loadedForm: EntryForm) => {
			entryIdRef.current = loaded.id;
			versionRef.current = loaded.version;
			baseMetadataRef.current = loaded.working.metadata ?? {};
			serverFingerprintRef.current = formFingerprint(loadedForm);
			formRef.current = loadedForm;
			setFormState(loadedForm);
			changeSeqRef.current = 0;
			ackSeqRef.current = 0;
			retryAttemptRef.current = 0;
			clearTimers();
			setLastError(null);
			updateStatus("saved");
		},
		[clearTimers, updateStatus],
	);

	const currentKey = () => backupKey(adminId, entryIdRef.current, collection);

	// biome-ignore lint/correctness/useExhaustiveDependencies: save loop reads refs; scheduling helpers are stable
	const performSave = useCallback((): Promise<boolean> => {
		if (inflightRef.current) return inflightRef.current;
		if (!enabledRef.current) return Promise.resolve(false);
		if (statusRef.current === "conflict") return Promise.resolve(false);
		if (changeSeqRef.current <= ackSeqRef.current) {
			if (statusRef.current !== "session-expired") updateStatus("saved");
			return Promise.resolve(true);
		}
		// 한글 조합이 끝나면 다시 부른다(조합 중 저장은 글자 누락을 만든다).
		if (composingRef.current) return Promise.resolve(false);

		const targetSeq = changeSeqRef.current;
		const snapshot = formRef.current;
		const built = metadataFromForm(snapshot, collection, baseMetadataRef.current);
		if ("error" in built) {
			setLastError(built.error);
			updateStatus("failed");
			return Promise.resolve(false);
		}
		updateStatus("saving");

		const request = (async (): Promise<boolean> => {
			try {
				const isNew = !entryIdRef.current;
				const saved = await cmsFetch<EntryData>(
					isNew ? "/api/cms/v1/entries" : `/api/cms/v1/entries/${entryIdRef.current}`,
					{
						method: isNew ? "POST" : "PATCH",
						json: {
							...(isNew
								? { collection, ...(newEntryFolderId ? { folderId: newEntryFolderId } : {}) }
								: { expectedVersion: versionRef.current }),
							slug: snapshot.slug.trim() || null,
							metadata: built.metadata,
							mdx: snapshot.mdx,
						},
						fallback: "저장하지 못했습니다.",
					},
				);
				if (isNew) {
					await deleteLocalBackup(backupKey(adminId, null, collection));
					entryIdRef.current = saved.id;
					// 화면을 다시 마운트하지 않고 주소만 편집 주소로 바꾼다.
					window.history.replaceState({ ...window.history.state }, "", `/admin/entries/${saved.id}/edit`);
				}
				versionRef.current = saved.version;
				baseMetadataRef.current = saved.working?.metadata ?? built.metadata;
				serverFingerprintRef.current = formFingerprint(snapshot);
				ackSeqRef.current = targetSeq;
				retryAttemptRef.current = 0;
				setLastError(null);
				callbacksRef.current.onSaved(saved);

				if (changeSeqRef.current === targetSeq) {
					updateStatus("saved");
					await deleteLocalBackup(currentKey());
				} else {
					updateStatus("dirty");
					scheduleSave(0);
				}
				return true;
			} catch (error) {
				if (error instanceof CmsApiError) {
					if (error.status === 401) {
						setLastError(error.message);
						updateStatus("session-expired");
						return false;
					}
					if (error.status === 409 && error.code === "conflict" && entryIdRef.current) {
						updateStatus("conflict");
						const server = await cmsFetch<EntryData>(`/api/cms/v1/entries/${entryIdRef.current}`).catch(() => null);
						if (server) callbacksRef.current.onConflict(server, snapshot);
						return false;
					}
					if (error.status < 500) {
						// 형식·검증 오류는 다시 보내도 같다. 입력을 고치면 다음 저장이 다시 시도한다.
						setLastError(error.message);
						updateStatus("failed");
						return false;
					}
				}
				setLastError(error instanceof CmsApiError ? error.message : "서버에 연결할 수 없습니다.");
				updateStatus(backupAvailable ? "local-only" : "failed");
				scheduleRetry();
				return false;
			} finally {
				inflightRef.current = null;
			}
		})();
		inflightRef.current = request;
		return request;
	}, [adminId, collection, backupAvailable, newEntryFolderId, updateStatus]);

	const scheduleSave = (delay: number) => {
		if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
		idleTimerRef.current = setTimeout(() => {
			idleTimerRef.current = null;
			if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
			maxWaitTimerRef.current = null;
			void performSave();
		}, delay);
	};

	const scheduleRetry = () => {
		const delay = RETRY_DELAYS_MS[retryAttemptRef.current];
		if (delay === undefined) return;
		retryAttemptRef.current += 1;
		if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
		retryTimerRef.current = setTimeout(() => {
			retryTimerRef.current = null;
			void retry(true);
		}, delay);
	};

	/**
	 * 다시 저장한다. `verify`면 먼저 서버 버전을 확인해 다른 곳에서 바뀌었는지 본다(§5.1 "연결 복귀 후 서버 버전을 먼저 확인").
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: scheduleRetry reads refs only
	const retry = useCallback(
		async (verify = true): Promise<boolean> => {
			if (verify && entryIdRef.current) {
				try {
					const server = await cmsFetch<EntryData>(`/api/cms/v1/entries/${entryIdRef.current}`);
					if (server.version !== versionRef.current) {
						updateStatus("conflict");
						callbacksRef.current.onConflict(server, formRef.current);
						return false;
					}
				} catch (error) {
					if (error instanceof CmsApiError && error.status === 401) {
						updateStatus("session-expired");
						return false;
					}
					updateStatus(backupAvailable ? "local-only" : "failed");
					scheduleRetry();
					return false;
				}
			}
			if (statusRef.current === "session-expired") updateStatus("dirty");
			return performSave();
		},
		[backupAvailable, performSave, updateStatus],
	);

	/** 폼 일부를 바꾼다. 복구본을 즉시 남기고 서버 저장을 예약한다. */
	// biome-ignore lint/correctness/useExhaustiveDependencies: helpers read refs only
	const setForm = useCallback(
		(patch: EntryFormPatch) => {
			const next = { ...formRef.current, ...patch };
			formRef.current = next;
			setFormState(next);
			changeSeqRef.current += 1;
			if (statusRef.current !== "conflict" && statusRef.current !== "session-expired") updateStatus("dirty");

			void saveLocalBackup({
				key: currentKey(),
				entryId: entryIdRef.current ?? "new",
				baseVersion: versionRef.current,
				baseFingerprint: serverFingerprintRef.current,
				localFingerprint: formFingerprint(next),
				snapshot: next as unknown as Record<string, unknown>,
				changeSeq: changeSeqRef.current,
				savedAt: Date.now(),
			}).then(setBackupAvailable);

			if (!enabledRef.current) return;
			scheduleSave(IDLE_MS);
			if (!maxWaitTimerRef.current) {
				maxWaitTimerRef.current = setTimeout(() => {
					maxWaitTimerRef.current = null;
					void performSave();
				}, MAX_WAIT_MS);
			}
		},
		[performSave, updateStatus],
	);

	/** 대기 중인 저장을 즉시 보내고 모두 확인될 때까지 기다린다(수동 저장·발행 전). */
	const flush = useCallback(async (): Promise<boolean> => {
		if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
		if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
		idleTimerRef.current = null;
		maxWaitTimerRef.current = null;
		for (let attempt = 0; attempt < 5; attempt++) {
			if (inflightRef.current) await inflightRef.current;
			if (changeSeqRef.current <= ackSeqRef.current) return true;
			if (!(await performSave())) return false;
		}
		return changeSeqRef.current <= ackSeqRef.current;
	}, [performSave]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scheduleSave reads refs only
	const setComposing = useCallback((composing: boolean) => {
		composingRef.current = composing;
		if (!composing && changeSeqRef.current > ackSeqRef.current) scheduleSave(IDLE_MS);
	}, []);

	// 연결이 돌아오면 서버 버전을 확인하고 다시 저장한다.
	useEffect(() => {
		const online = () => {
			if (changeSeqRef.current > ackSeqRef.current) void retry(true);
		};
		window.addEventListener("online", online);
		return () => window.removeEventListener("online", online);
	}, [retry]);

	// 서버에 저장되지 않은 변경이 있으면 페이지 이탈을 경고한다. 종료 직전 전송이 성공한다고 가정하지 않는다.
	useEffect(() => {
		if (status === "saved") return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [status]);

	return {
		form,
		status,
		lastError,
		backupAvailable,
		setForm,
		flush,
		retry,
		setComposing,
		resetFromServer,
		/** 충돌 해결에서 “내 내용으로 덮어쓰기”를 고른 경우 서버 버전을 기준으로 다시 저장한다. */
		overwriteWithLocal: (serverVersion: number) => {
			versionRef.current = serverVersion;
			updateStatus("dirty");
			changeSeqRef.current += 1;
			return performSave();
		},
		getEntryId: () => entryIdRef.current,
		getVersion: () => versionRef.current,
		setVersion: (version: number) => {
			versionRef.current = version;
		},
		hasPendingChanges: () => changeSeqRef.current > ackSeqRef.current,
	};
}
