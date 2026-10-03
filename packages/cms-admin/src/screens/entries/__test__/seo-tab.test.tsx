import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsAdminComponentsProvider, type FieldViewProps } from "../../../admin-components";
import { type SlotAction, SlotRegistryProvider } from "../../../slots/slots";
import { TooltipProvider } from "../../../ui/tooltip";
import { EMPTY_FORM, type EntryForm } from "../entry-form";
import { InspectorPanel } from "../inspector-panel";

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) })),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function renderPanel(collection: string, form: EntryForm, onChange = vi.fn(), sources: SlotAction[] = []) {
	render(
		<TooltipProvider>
			<SlotRegistryProvider sources={[(request) => (request.target === "seoTitle" ? sources : [])]}>
				<InspectorPanel
					collection={collection}
					form={form}
					disabled={false}
					entry={null}
					incomingReferences={[]}
					isLoadingIncomingReferences={false}
					onRefreshIncomingReferences={vi.fn()}
					onSlugChange={vi.fn()}
					onRegenerateSlug={vi.fn()}
					onChange={onChange}
					onClose={vi.fn()}
				/>
			</SlotRegistryProvider>
		</TooltipProvider>,
	);
	return onChange;
}

const openSeo = () => fireEvent.click(screen.getByRole("tab", { name: "SEO" }));

describe("속성 칸 탭(layout `tab`)과 보기 필드(`fields.view`)", () => {
	it('`tab: "SEO"` 묶음의 필드를 그 탭에 보통 입력으로 그리고, 다른 탭에는 그리지 않는다', async () => {
		renderPanel("post", { ...EMPTY_FORM, title: "글 제목", seoTitle: "검색용 제목", canonicalUrl: "https://a.dev/x" });
		expect(screen.queryByLabelText("검색 제목")).toBeNull();
		openSeo();
		expect(((await screen.findByLabelText("검색 제목")) as HTMLInputElement).value).toBe("검색용 제목");
		expect((screen.getByLabelText("원본 주소") as HTMLInputElement).value).toBe("https://a.dev/x");
		expect(screen.getByRole("switch", { name: "검색엔진에 숨기기" })).toBeTruthy();
		// 공유 이미지(역할 `ogImage`)는 미디어 고르기로 입력한다.
		expect(screen.getByLabelText("공유 이미지").textContent).toBe("이미지 고르기");
	});

	it("미리보기는 역할 필드에서 값을 읽고, 비면 제목·요약을 쓴다", async () => {
		renderPanel("post", { ...EMPTY_FORM, title: "글 제목", slug: "hello", summary: "요약 글" });
		openSeo();
		const search = await screen.findByRole("region", { name: "검색 결과 미리보기" });
		expect(within(search).getByText("글 제목")).toBeTruthy();
		expect(within(search).getByText("요약 글")).toBeTruthy();
		expect(within(search).getByText(/posts › hello/)).toBeTruthy();
		const share = screen.getByRole("region", { name: "공유 미리보기" });
		expect(within(share).getByText("글 제목")).toBeTruthy();
		// 비운 검색 제목은 글 제목을 안내 문구로 보인다.
		expect((screen.getByLabelText("검색 제목") as HTMLInputElement).placeholder).toBe("글 제목");
	});

	it("검색엔진 숨기기는 정의된 선택 필드 값으로 바꾼다", async () => {
		const onChange = renderPanel("post", { ...EMPTY_FORM, title: "글" });
		openSeo();
		fireEvent.click(await screen.findByRole("switch", { name: "검색엔진에 숨기기" }));
		expect(onChange).toHaveBeenCalledWith({ seoRobots: "noindex" });
	});

	it("필드 옆 동작은 요약 역할 필드의 값을 `summary`로 받는다", async () => {
		const run = vi.fn<SlotAction["run"]>(async () => ({ kind: "text", text: "새 제목" }));
		renderPanel("post", { ...EMPTY_FORM, title: "글", summary: "요약 글" }, vi.fn(), [
			{ id: "t", label: "제목 추천", apply: "replace", run },
		]);
		openSeo();
		fireEvent.click(await screen.findByRole("button", { name: "제목 추천" }));
		await waitFor(() => expect(run).toHaveBeenCalled());
		expect(run.mock.calls[0]?.[0]).toMatchObject({ title: "글", summary: "요약 글" });
	});

	it("`tab`을 둔 묶음이 없는 컬렉션은 기본 탭 하나만 있다", () => {
		renderPanel("category", { ...EMPTY_FORM, title: "분류" });
		expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["속성"]);
	});

	it("보기 필드 화면은 관리자 확장의 `fieldViews`로 바꾸거나 더한다", async () => {
		const Custom = ({ form }: FieldViewProps) => <p>미리보기: {String(form.title)}</p>;
		render(
			<TooltipProvider>
				<CmsAdminComponentsProvider components={{ fieldViews: { search: Custom } }}>
					<InspectorPanel
						collection="post"
						form={{ ...EMPTY_FORM, title: "글 제목" }}
						disabled={false}
						entry={null}
						incomingReferences={[]}
						isLoadingIncomingReferences={false}
						onRefreshIncomingReferences={vi.fn()}
						onSlugChange={vi.fn()}
						onRegenerateSlug={vi.fn()}
						onChange={vi.fn()}
						onClose={vi.fn()}
					/>
				</CmsAdminComponentsProvider>
			</TooltipProvider>,
		);
		openSeo();
		expect(await screen.findByText("미리보기: 글 제목")).toBeTruthy();
		expect(screen.queryByRole("region", { name: "검색 결과 미리보기" })).toBeNull();
	});
});
