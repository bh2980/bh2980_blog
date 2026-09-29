"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CmsApiError, cmsFetch } from "../admin-api";
import {
	type EntryData,
	type EntryForm,
	type EntryFormPatch,
	formFingerprint,
	isTranslationEntry,
	metadataFromForm,
	translationPayload,
} from "./entry-form";
import { backupKey, deleteLocalBackup, saveLocalBackup } from "./local-backup";

/** §5.1 저장 상태. */
export type SaveStatus =
	| "new"
	| "saved"
	| "dirty"
	| "saving"
	| "local-only"
	| "failed"
	| "conflict"
	| "session-expired";

export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
	new: "저장 전",
	saved: "서버에 저장됨",
	dirty: "저장 전 변경사항",
	saving: "저장 중",
	"local-only": "브라우저에만 임시 저장됨",
	failed: "저장 실패",
	conflict: "충돌",
	"session-expired": "세션 만료 — 다시 로그인하세요",
};

interface Options {
	adminId: string;
	collection: string;
	/** 불러온 항목. 새 글이면 `null`이고 명시적으로 저장하거나 발행할 때 만든다. */
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
 * 편집 중에는 브라우저 복구본만 남기고, 명시적 저장·발행 시 서버 초안을 저장한다.
 *
 * - 요청은 한 번에 하나다. 전송 중 새 입력은 다음 명시적 저장 때 보낸다.
 * - 네트워크·서버 오류가 나도 복구본을 남긴다. 재시도는 사용자가 누를 때만 보낸다.
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
	const [status, setStatus] = useState<SaveStatus>(entry ? "saved" : "new");
	const [lastError, setLastError] = useState<string | null>(null);
	const [backupAvailable, setBackupAvailable] = useState(true);

	const formRef = useRef(initialForm);
	const entryIdRef = useRef<string | null>(entry?.id ?? null);
	const versionRef = useRef(entry?.version ?? 0);
	const baseMetadataRef = useRef<Record<string, unknown>>(entry?.working.metadata ?? {});
	/** 번역본은 언어별 값만 저장한다(v2 B4). */
	const translationRef = useRef(isTranslationEntry(entry));
	const serverFingerprintRef = useRef(formFingerprint(initialForm));
	const changeSeqRef = useRef(0);
	const ackSeqRef = useRef(0);
	const inflightRef = useRef<Promise<boolean> | null>(null);
	const composingRef = useRef(false);
	const backupWriteRef = useRef<Promise<void>>(Promise.resolve());
	const statusRef = useRef<SaveStatus>(entry ? "saved" : "new");
	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;
	const callbacksRef = useRef({ onSaved, onConflict });
	callbacksRef.current = { onSaved, onConflict };

	const updateStatus = useCallback((next: SaveStatus) => {
		statusRef.current = next;
		setStatus(next);
	}, []);

	const queueBackup = useCallback((task: () => Promise<void>) => {
		backupWriteRef.current = backupWriteRef.current.then(task, task);
		return backupWriteRef.current;
	}, []);

	/** 불러오기·재적재 뒤 기준값을 서버 값으로 맞춘다. */
	const resetFromServer = useCallback(
		(loaded: EntryData, loadedForm: EntryForm) => {
			entryIdRef.current = loaded.id;
			versionRef.current = loaded.version;
			baseMetadataRef.current = loaded.working.metadata ?? {};
			translationRef.current = isTranslationEntry(loaded);
			serverFingerprintRef.current = formFingerprint(loadedForm);
			formRef.current = loadedForm;
			setFormState(loadedForm);
			changeSeqRef.current = 0;
			ackSeqRef.current = 0;
			setLastError(null);
			updateStatus("saved");
		},
		[updateStatus],
	);

	const currentKey = () => backupKey(adminId, entryIdRef.current, collection);
	const persistBackup = useCallback(
		(snapshot: EntryForm, changeSeq: number) => {
			const key = backupKey(adminId, entryIdRef.current, collection);
			const record = {
				key,
				entryId: entryIdRef.current ?? "new",
				baseVersion: versionRef.current,
				baseFingerprint: serverFingerprintRef.current,
				localFingerprint: formFingerprint(snapshot),
				snapshot: snapshot as unknown as Record<string, unknown>,
				changeSeq,
				savedAt: Date.now(),
			};
			return queueBackup(async () => setBackupAvailable(await saveLocalBackup(record)));
		},
		[adminId, collection, queueBackup],
	);
	const discardBackup = useCallback((key: string) => queueBackup(() => deleteLocalBackup(key)), [queueBackup]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: save loop reads refs; explicit save is invoked from current render
	const performSave = useCallback((): Promise<boolean> => {
		if (inflightRef.current) return inflightRef.current;
		if (!enabledRef.current) return Promise.resolve(false);
		if (statusRef.current === "conflict") return Promise.resolve(false);
		if (entryIdRef.current && changeSeqRef.current <= ackSeqRef.current) {
			if (statusRef.current !== "session-expired") updateStatus("saved");
			return Promise.resolve(true);
		}
		// 한글 조합이 끝나면 다시 부른다(조합 중 저장은 글자 누락을 만든다).
		if (composingRef.current) return Promise.resolve(false);

		const targetSeq = changeSeqRef.current;
		const snapshot = formRef.current;
		const built = metadataFromForm(snapshot, collection, baseMetadataRef.current, {
			translation: translationRef.current,
		});
		if ("error" in built) {
			setLastError(built.error);
			updateStatus("failed");
			return Promise.resolve(false);
		}
		updateStatus("saving");

		const request = (async (): Promise<boolean> => {
			try {
				const isNew = !entryIdRef.current;
				const newKey = backupKey(adminId, null, collection);
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
							...(translationPayload(snapshot) ? { translation: translationPayload(snapshot) } : {}),
						},
						fallback: "저장하지 못했습니다.",
					},
				);
				if (isNew) {
					entryIdRef.current = saved.id;
					// 화면을 다시 마운트하지 않고 주소만 편집 주소로 바꾼다.
					window.history.replaceState({ ...window.history.state }, "", `/admin/entries/${saved.id}/edit`);
				}
				versionRef.current = saved.version;
				baseMetadataRef.current = saved.working?.metadata ?? built.metadata;
				serverFingerprintRef.current = formFingerprint(snapshot);
				ackSeqRef.current = targetSeq;
				setLastError(null);
				callbacksRef.current.onSaved(saved);

				if (formFingerprint(formRef.current) === serverFingerprintRef.current) {
					ackSeqRef.current = changeSeqRef.current;
					updateStatus("saved");
					await discardBackup(currentKey());
				} else {
					updateStatus("dirty");
					await persistBackup(formRef.current, changeSeqRef.current);
				}
				if (isNew) await discardBackup(newKey);
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
				return false;
			} finally {
				inflightRef.current = null;
			}
		})();
		inflightRef.current = request;
		return request;
	}, [adminId, collection, backupAvailable, discardBackup, newEntryFolderId, persistBackup, updateStatus]);

	/** 사용자가 재시도를 누르면 서버 버전을 먼저 확인하고 다시 저장한다. */
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
					return false;
				}
			}
			if (statusRef.current === "session-expired") updateStatus("dirty");
			return performSave();
		},
		[backupAvailable, performSave, updateStatus],
	);

	/** 폼 일부를 바꾼다. 변경사항은 브라우저에만 남긴다. */
	const setForm = useCallback(
		(patch: EntryFormPatch) => {
			const next = { ...formRef.current, ...patch };
			const fingerprint = formFingerprint(next);
			if (fingerprint === formFingerprint(formRef.current)) return;
			formRef.current = next;
			setFormState(next);
			changeSeqRef.current += 1;
			if (!inflightRef.current && fingerprint === serverFingerprintRef.current) {
				ackSeqRef.current = changeSeqRef.current;
				if (statusRef.current !== "conflict" && statusRef.current !== "session-expired") {
					updateStatus(entryIdRef.current ? "saved" : "new");
				}
				void discardBackup(backupKey(adminId, entryIdRef.current, collection));
				return;
			}
			if (statusRef.current !== "conflict" && statusRef.current !== "session-expired") updateStatus("dirty");
			void persistBackup(next, changeSeqRef.current);
		},
		[adminId, collection, discardBackup, persistBackup, updateStatus],
	);

	/** 명시적으로 저장하거나 발행할 때만 서버에 보낸다. */
	const flush = useCallback(async (): Promise<boolean> => {
		await backupWriteRef.current;
		for (let attempt = 0; attempt < 5; attempt++) {
			if (inflightRef.current) await inflightRef.current;
			if (entryIdRef.current && changeSeqRef.current <= ackSeqRef.current) return true;
			if (!(await performSave())) return false;
		}
		return Boolean(entryIdRef.current && changeSeqRef.current <= ackSeqRef.current);
	}, [performSave]);

	const setComposing = useCallback((composing: boolean) => {
		composingRef.current = composing;
	}, []);

	// 서버에 저장되지 않은 변경이 있으면 페이지 이탈을 경고한다.
	useEffect(() => {
		if (status === "saved" || status === "new") return;
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
