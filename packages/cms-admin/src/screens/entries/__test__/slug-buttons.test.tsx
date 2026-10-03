import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlotRegistryProvider, type SlotSource } from "../../../slots/slots";
import { TooltipProvider } from "../../../ui/tooltip";
import { EMPTY_FORM } from "../entry-form";
import { SchemaFields } from "../schema-fields";

afterEach(cleanup);

const fields = (sources: SlotSource[]) =>
	render(
		<TooltipProvider>
			<SlotRegistryProvider sources={sources}>
				<SchemaFields
					collection="post"
					form={{ ...EMPTY_FORM, title: "글", slug: "post" }}
					context={{ disabled: false }}
					onChange={vi.fn()}
					onRegenerateSlug={vi.fn()}
					include={(group) => group.fields.includes("slug")}
				/>
			</SlotRegistryProvider>
		</TooltipProvider>,
	);

describe("주소 필드의 버튼", () => {
	it("주소를 만드는 동작(AI 주소 추천)이 붙으면 그 버튼 하나만 둔다", () => {
		fields([
			({ target }) =>
				target === "slug"
					? [{ id: "slug", label: "주소 추천", apply: "replace", run: async () => ({ kind: "text", text: "x" }) }]
					: [],
		]);
		expect(screen.getByRole("button", { name: "주소 추천" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "제목으로 다시 만들기" })).toBeNull();
	});

	it("붙은 동작이 없으면 제목으로 다시 만들기 버튼을 둔다", () => {
		fields([() => []]);
		expect(screen.getByRole("button", { name: "제목으로 다시 만들기" })).toBeTruthy();
	});
});
