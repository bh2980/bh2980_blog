import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CmsAdminComponentsProvider } from "../../admin-components";
import { CmsEditor } from "../../editor/tiptap-editor";
import { pressOption } from "../../test/base-ui";
import { textCheckIssues, textCheckPluginKey } from "../plugin";
import { defineTextChecker, type TextChecker, type TextCheckSegment } from "../types";
import { AUTO_CHECK_DELAY } from "../use-text-check";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

// jsdom에는 글자 범위의 좌표가 없다.
beforeAll(() => {
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.clearAllMocks();
});

/** `틀린말`을 찾아 `맞는 말`을 권하는 가짜 검사기. */
const fakeChecker = (options: Partial<Pick<TextChecker, "auto" | "locales">> = {}) =>
	defineTextChecker({
		id: "fake",
		label: "가짜 검사",
		...options,
		check: vi.fn(async (segments: readonly TextCheckSegment[]) =>
			segments.flatMap((segment) => {
				const start = segment.text.indexOf("틀린말");
				return start < 0
					? []
					: [
							{
								segmentId: segment.id,
								start,
								end: start + 3,
								message: "맞춤법이 틀렸습니다.",
								suggestions: ["맞는 말"],
								severity: "error" as const,
							},
						];
			}),
		),
	});

const renderEditor = async (content: string, checkers: readonly TextChecker[], locale = "ko") => {
	let editor: Editor | null = null;
	const onChange = vi.fn();
	render(
		<CmsAdminComponentsProvider components={{ textCheckers: checkers }}>
			<CmsEditor
				content={content}
				locale={locale}
				onChange={onChange}
				onEditor={(ready) => {
					editor = ready;
				}}
			/>
		</CmsAdminComponentsProvider>,
	);
	await screen.findByRole("toolbar", { name: "서식 도구" });
	await waitFor(() => expect(editor).not.toBeNull());
	return { editor: editor as unknown as Editor, onChange };
};

const checkButton = () =>
	within(screen.getByRole("toolbar", { name: "서식 도구" })).queryByRole("button", { name: "맞춤법 검사" });

/** 밑줄을 누른 것처럼 결과 창을 연다(jsdom은 좌표로 위치를 찾지 못한다). */
const clickIssue = (editor: Editor) => {
	const [issue] = textCheckIssues(editor.state);
	if (!issue) throw new Error("no issue");
	const plugin = textCheckPluginKey.get(editor.state);
	const target = editor.view.dom.querySelector(`[data-text-issue="${issue.key}"]`);
	act(() => {
		plugin?.props.handleClick?.call(plugin, editor.view, issue.from + 1, {
			button: 0,
			target,
		} as unknown as MouseEvent);
	});
	return issue;
};

describe("맞춤법 검사 버튼", () => {
	it("검사기를 등록하지 않으면 버튼이 없다", async () => {
		await renderEditor("틀린말\n", []);
		expect(checkButton()).toBeNull();
	});

	it("글의 언어를 검사하는 검사기가 없으면 버튼이 없다", async () => {
		await renderEditor("틀린말\n", [fakeChecker({ locales: ["en"] })], "ko");
		expect(checkButton()).toBeNull();
	});

	it("누르면 문서 전체를 검사하고 밑줄과 결과 수를 보인다", async () => {
		const checker = fakeChecker();
		const { editor } = await renderEditor("첫 문단은 틀린말 입니다\n\n둘째 문단\n", [checker]);
		expect(screen.queryByRole("button", { name: "검사 결과" })).toBeNull();

		fireEvent.click(checkButton() as HTMLElement);

		await waitFor(() => expect(textCheckIssues(editor.state)).toHaveLength(1));
		expect(checker.check).toHaveBeenCalledTimes(1);
		const [sent] = (checker.check as ReturnType<typeof vi.fn>).mock.calls[0] as [TextCheckSegment[]];
		expect(sent.map((segment) => segment.text)).toEqual(["첫 문단은 틀린말 입니다", "둘째 문단"]);
		expect(sent.every((segment) => segment.locale === "ko")).toBe(true);
		expect(editor.view.dom.querySelector(".cms-text-issue")?.textContent).toBe("틀린말");
		expect(screen.getByRole("button", { name: "검사 결과" }).textContent).toBe("1");
	});

	it("고른 글자가 있으면 그 문단만 검사한다", async () => {
		const checker = fakeChecker();
		const { editor } = await renderEditor("첫 틀린말\n\n둘째 틀린말\n", [checker]);
		const second = editor.state.doc.child(1);
		const start = editor.state.doc.child(0).nodeSize + 1;
		act(() => {
			editor.commands.setTextSelection({ from: start, to: start + second.content.size });
		});

		fireEvent.click(checkButton() as HTMLElement);

		await waitFor(() => expect(textCheckIssues(editor.state)).toHaveLength(1));
		const [sent] = (checker.check as ReturnType<typeof vi.fn>).mock.calls[0] as [TextCheckSegment[]];
		expect(sent.map((segment) => segment.text)).toEqual(["둘째 틀린말"]);
		const [issue] = textCheckIssues(editor.state);
		expect(issue?.from).toBeGreaterThan(start);
	});

	it("결과 창에서 후보를 고르면 그 글자를 바꾼다", async () => {
		const { editor, onChange } = await renderEditor("이것은 틀린말 입니다\n", [fakeChecker()]);
		fireEvent.click(checkButton() as HTMLElement);
		await waitFor(() => expect(textCheckIssues(editor.state)).toHaveLength(1));

		clickIssue(editor);
		const dialog = await screen.findByRole("dialog", { name: "검사 결과" });
		expect(within(dialog).getByText("맞춤법이 틀렸습니다.")).toBeTruthy();
		expect(within(dialog).getByText("가짜 검사")).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "맞는 말" }));

		await waitFor(() => expect(String(onChange.mock.lastCall?.[0])).toContain("이것은 맞는 말 입니다"));
		expect(textCheckIssues(editor.state)).toHaveLength(0);
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "검사 결과" })).toBeNull());
	});

	it("무시하면 결과를 숨기고 다시 검사해도 보이지 않는다", async () => {
		const checker = fakeChecker();
		const { editor } = await renderEditor("이것은 틀린말 입니다\n\n또 틀린말\n", [checker]);
		fireEvent.click(checkButton() as HTMLElement);
		await waitFor(() => expect(textCheckIssues(editor.state)).toHaveLength(2));

		clickIssue(editor);
		fireEvent.click(
			within(await screen.findByRole("dialog", { name: "검사 결과" })).getByRole("button", { name: "무시" }),
		);
		// 같은 검사기·규칙·글자는 모두 숨긴다.
		expect(textCheckIssues(editor.state)).toHaveLength(0);

		fireEvent.click(checkButton() as HTMLElement);
		await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("고칠 곳이 없습니다."));
		expect(textCheckIssues(editor.state)).toHaveLength(0);
		// 같은 글자는 다시 보내지 않는다.
		expect(checker.check).toHaveBeenCalledTimes(1);
	});

	it("결과 목록에서 고르면 그 자리를 고르고 결과 창을 연다", async () => {
		const { editor } = await renderEditor("앞 문단\n\n이것은 틀린말 입니다\n", [fakeChecker()]);
		fireEvent.click(checkButton() as HTMLElement);
		await waitFor(() => expect(textCheckIssues(editor.state)).toHaveLength(1));

		fireEvent.click(screen.getByRole("button", { name: "검사 결과" }));
		pressOption(await screen.findByRole("menuitem", { name: /틀린말/ }));

		const [issue] = textCheckIssues(editor.state);
		await waitFor(() => expect(editor.state.selection.from).toBe(issue?.from));
		expect(editor.state.selection.to).toBe(issue?.to);
		expect(await screen.findByRole("dialog", { name: "검사 결과" })).toBeTruthy();
	});

	it("검사기가 실패하면 알림을 띄운다", async () => {
		const failing = defineTextChecker({
			id: "broken",
			label: "고장",
			check: async () => {
				throw new Error("HTTP 500");
			},
		});
		await renderEditor("틀린말\n", [failing]);
		fireEvent.click(checkButton() as HTMLElement);
		await waitFor(() =>
			expect(toastMock.error).toHaveBeenCalledWith("검사하지 못했습니다.", { description: "HTTP 500" }),
		);
		expect(checkButton()?.hasAttribute("disabled")).toBe(false);
	});

	it("검사하는 동안 버튼 이름이 바뀌고 눌리지 않는다", async () => {
		let finish: (() => void) | undefined;
		const slow = defineTextChecker({
			id: "slow",
			label: "느림",
			check: () =>
				new Promise((resolve) => {
					finish = () => resolve([]);
				}),
		});
		await renderEditor("문단\n", [slow]);
		fireEvent.click(checkButton() as HTMLElement);
		const busy = await screen.findByRole("button", { name: "검사 중…" });
		expect(busy.hasAttribute("disabled")).toBe(true);
		await act(async () => finish?.());
		await waitFor(() => expect(checkButton()).not.toBeNull());
	});
});

describe("저절로 검사", () => {
	const typeInto = (editor: Editor, text: string) =>
		act(() => {
			editor
				.chain()
				.setTextSelection(editor.state.doc.content.size - 1)
				.insertContent(text)
				.run();
		});

	it("기본으로 꺼져 있어 입력해도 검사하지 않는다", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const checker = fakeChecker();
		const { editor } = await renderEditor("문단\n", [checker]);
		typeInto(editor, " 틀린말");
		await act(async () => {
			vi.advanceTimersByTime(AUTO_CHECK_DELAY * 2);
		});
		expect(checker.check).not.toHaveBeenCalled();
	});

	it("`auto: true`면 입력을 멈춘 뒤 바뀐 문단만 검사한다", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const checker = fakeChecker({ auto: true });
		const { editor } = await renderEditor("그대로 둘 문단\n\n고칠 문단\n", [checker]);
		typeInto(editor, " 틀린말");
		expect(checker.check).not.toHaveBeenCalled();
		await act(async () => {
			vi.advanceTimersByTime(AUTO_CHECK_DELAY + 10);
		});
		await waitFor(() => expect(textCheckIssues(editor.state)).toHaveLength(1));
		expect(checker.check).toHaveBeenCalledTimes(1);
		const [sent] = (checker.check as ReturnType<typeof vi.fn>).mock.calls[0] as [TextCheckSegment[]];
		expect(sent.map((segment) => segment.text)).toEqual(["고칠 문단 틀린말"]);
	});
});
