import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Highlighter } from "shiki";
import type { CodeBlockAnnotationItem } from "./types";

export const codeBlockHighlightPluginKey = new PluginKey<{ version: number }>("cmsCodeBlockHighlight");

let highlighterPromise: Promise<Highlighter> | null = null;

export async function getShikiHighlighter(): Promise<Highlighter> {
	if (!highlighterPromise) {
		highlighterPromise = import("shiki").then(({ createHighlighter }) =>
			createHighlighter({
				themes: ["one-light", "one-dark-pro"],
				langs: [
					"typescript",
					"javascript",
					"tsx",
					"jsx",
					"json",
					"python",
					"rust",
					"go",
					"java",
					"kotlin",
					"cpp",
					"csharp",
					"swift",
					"html",
					"css",
					"scss",
					"postcss",
					"sql",
					"bash",
					"yaml",
					"toml",
					"markdown",
					"mdx",
					"docker",
					"graphql",
				],
			}),
		);
	}
	return highlighterPromise;
}

// 언어 이름 정규화
const LANG_MAP: Record<string, string> = {
	ts: "typescript",
	js: "javascript",
	py: "python",
	rs: "rust",
	cs: "csharp",
	sh: "bash",
	yml: "yaml",
};

function normalizeLang(lang: string | null | undefined): string {
	if (!lang) return "text";
	const lower = lang.toLowerCase().trim();
	return LANG_MAP[lower] ?? lower;
}

// 하이라이팅 토큰 캐시 (lang:::code -> 상대 오프셋 기준 데코레이션 팩토리)
interface CachedToken {
	from: number;
	to: number;
	style: string;
}

const highlightCache = new Map<string, CachedToken[]>();
const MAX_HIGHLIGHT_CACHE_ENTRIES = 50;
const cacheHighlight = (key: string, tokens: CachedToken[]) => {
	highlightCache.delete(key);
	highlightCache.set(key, tokens);
	if (highlightCache.size > MAX_HIGHLIGHT_CACHE_ENTRIES) {
		const oldest = highlightCache.keys().next().value;
		if (oldest !== undefined) highlightCache.delete(oldest);
	}
};
const pendingRequests = new Set<string>();

async function requestHighlight(view: EditorView, lang: string, code: string, cacheKey: string) {
	if (pendingRequests.has(cacheKey) || highlightCache.has(cacheKey)) return;
	pendingRequests.add(cacheKey);

	try {
		const highlighter = await getShikiHighlighter();
		const normalized = normalizeLang(lang);

		if (normalized !== "text" && !highlighter.getLoadedLanguages().includes(normalized)) {
			try {
				await highlighter.loadLanguage(normalized as never);
			} catch {
				// 지원하지 않는 언어면 text로 fallback
			}
		}

		const resolvedLang = highlighter.getLoadedLanguages().includes(normalized) ? normalized : "text";

		if (resolvedLang === "text") {
			cacheHighlight(cacheKey, []);
			pendingRequests.delete(cacheKey);
			return;
		}

		const tokensByLine = highlighter.codeToTokensWithThemes(code, {
			lang: resolvedLang as Parameters<typeof highlighter.codeToTokensWithThemes>[1]["lang"],
			themes: {
				light: "one-light",
				dark: "one-dark-pro",
			},
		});

		const tokens: CachedToken[] = [];

		for (const line of tokensByLine) {
			for (const token of line) {
				if (token.content.length === 0) continue;
				const lightColor = token.variants?.light?.color;
				const darkColor = token.variants?.dark?.color;
				const style = [
					lightColor ? `--shiki-light: ${lightColor}; color: var(--shiki-light);` : "",
					darkColor ? `--shiki-dark: ${darkColor};` : "",
				]
					.filter(Boolean)
					.join(" ");

				tokens.push({
					from: token.offset,
					to: token.offset + token.content.length,
					style,
				});
			}
		}

		cacheHighlight(cacheKey, tokens);
	} catch {
		cacheHighlight(cacheKey, []);
	} finally {
		pendingRequests.delete(cacheKey);
		// 뷰가 아직 살아있다면 트랜잭션 메타로 갱신 트리거
		try {
			if (!view.isDestroyed) {
				view.dispatch(view.state.tr.setMeta(codeBlockHighlightPluginKey, { cacheKey }));
			}
		} catch {
			// view unmounted
		}
	}
}

export function createCodeBlockHighlightPlugin(): Plugin {
	return new Plugin({
		key: codeBlockHighlightPluginKey,
		state: {
			init() {
				return { version: 0 };
			},
			apply(tr, prev) {
				const meta = tr.getMeta(codeBlockHighlightPluginKey);
				if (meta) {
					return { version: prev.version + 1 };
				}
				return prev;
			},
		},
		props: {
			decorations(state) {
				const decorations: Decoration[] = [];
				const doc = state.doc;

				doc.descendants((node, pos) => {
					if (node.type.name !== "codeBlock") return;

					const text = node.textContent;
					const blockStart = pos + 1;
					const lang = (node.attrs.language as string) || "text";

					// 1) Shiki 구문 하이라이팅 데코레이션
					if (text.length > 0 && lang !== "text") {
						const cacheKey = `${lang}:::${text}`;
						const cached = highlightCache.get(cacheKey);
						if (cached) {
							for (const token of cached) {
								if (token.to <= text.length) {
									decorations.push(
										Decoration.inline(blockStart + token.from, blockStart + token.to, {
											style: token.style,
											class: "shiki-token",
										}),
									);
								}
							}
						}
					}

					// 2) 주석(밑줄·툴팁) 데코레이션
					const annotations = node.attrs.annotations as CodeBlockAnnotationItem[] | undefined;
					if (annotations && Array.isArray(annotations)) {
						for (const anno of annotations) {
							const from = Math.max(0, Math.min(text.length, anno.from));
							const to = Math.max(from, Math.min(text.length, anno.to));
							if (from >= to) continue;

							if (anno.type === "underline") {
								decorations.push(
									Decoration.inline(blockStart + from, blockStart + to, {
										class:
											"underline decoration-neutral-400 dark:decoration-neutral-500 underline-offset-4 decoration-2",
										"data-code-anno": "underline",
										"data-anno-id": anno.id,
									}),
								);
							} else if (anno.type === "tooltip") {
								decorations.push(
									Decoration.inline(blockStart + from, blockStart + to, {
										class: "underline decoration-dotted underline-offset-4 decoration-primary cursor-help",
										title: anno.content || "툴팁",
										"data-code-anno": "tooltip",
										"data-anno-id": anno.id,
									}),
								);
							}
						}
					}
				});

				return DecorationSet.create(doc, decorations);
			},
		},
		view(editorView) {
			// 초기 로드 시 뷰에 보이는 코드블록 하이라이팅 요청
			const requestVisibleBlocks = () => {
				const state = editorView.state;
				state.doc.descendants((node, _pos) => {
					if (node.type.name === "codeBlock" && node.textContent.length > 0) {
						const lang = (node.attrs.language as string) || "text";
						const cacheKey = `${lang}:::${node.textContent}`;
						if (!highlightCache.has(cacheKey)) {
							requestHighlight(editorView, lang, node.textContent, cacheKey);
						}
					}
				});
			};

			requestVisibleBlocks();

			return {
				update() {
					requestVisibleBlocks();
				},
			};
		},
		appendTransaction(transactions, oldState, newState) {
			// 문서가 변경되었을 때만 주석 오프셋을 매핑하여 갱신
			if (!transactions.some((tr) => tr.docChanged)) return null;

			const combined = new Mapping();
			for (const tr of transactions) {
				combined.appendMapping(tr.mapping);
			}

			let updateTr: Transaction | null = null;

			oldState.doc.descendants((oldNode, oldPos) => {
				if (oldNode.type.name !== "codeBlock") return;

				const annotations = oldNode.attrs.annotations as CodeBlockAnnotationItem[] | undefined;
				if (!annotations || !Array.isArray(annotations) || annotations.length === 0) return;

				const newPos = combined.map(oldPos, 1);
				const newNode = newState.doc.nodeAt(newPos);
				if (!newNode || newNode.type.name !== "codeBlock") return;
				// 블록 자체를 교체·적재한 경우 새 attrs의 주석이 정본이다(옛 블록의 range를 매핑하지 않는다).
				if (
					oldNode.attrs.raw !== newNode.attrs.raw ||
					oldNode.attrs.initialAnnotationsJson !== newNode.attrs.initialAnnotationsJson
				)
					return;

				const oldBlockStart = oldPos + 1;
				const newBlockStart = newPos + 1;
				const newTextLen = newNode.textContent.length;

				let changed = false;
				const updatedAnnotations: CodeBlockAnnotationItem[] = [];

				for (const anno of annotations) {
					const oldDocFrom = oldBlockStart + anno.from;
					const oldDocTo = oldBlockStart + anno.to;

					const newDocFrom = combined.map(oldDocFrom, 1);
					const newDocTo = combined.map(oldDocTo, 1);

					const mappedFrom = Math.max(0, Math.min(newTextLen, newDocFrom - newBlockStart));
					const mappedTo = Math.max(0, Math.min(newTextLen, newDocTo - newBlockStart));

					if (mappedFrom < mappedTo) {
						if (mappedFrom !== anno.from || mappedTo !== anno.to) {
							changed = true;
						}
						updatedAnnotations.push({ ...anno, from: mappedFrom, to: mappedTo });
					} else {
						// 오프셋이 축소/삭제됨
						changed = true;
					}
				}

				if (changed || updatedAnnotations.length !== annotations.length) {
					if (!updateTr) {
						updateTr = newState.tr;
					}
					updateTr.setNodeMarkup(newPos, undefined, {
						...newNode.attrs,
						annotations: updatedAnnotations,
					});
				}
			});

			return updateTr;
		},
	});
}
