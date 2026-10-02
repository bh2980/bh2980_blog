import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsAdminComponentsProvider } from "../../../admin-components";
import { EMPTY_FORM } from "../entry-form";
import type { FieldInputProps } from "../field-inputs";
import { SchemaFields } from "../schema-fields";

afterEach(cleanup);

/** 사이트가 등록하는 입력(예시). 받은 값을 버튼 하나로 바꾼다. */
function UpperInput({ id, value, onChange }: FieldInputProps) {
	return (
		<button type="button" id={id} onClick={() => onChange(String(value ?? "").toUpperCase())}>
			사이트 입력: {String(value ?? "")}
		</button>
	);
}

describe("사이트가 등록한 필드 입력", () => {
	it("필드의 `input` 이름으로 등록한 입력이 내장 입력 대신 그려진다", () => {
		const onChange = vi.fn();
		render(
			<CmsAdminComponentsProvider components={{ fieldInputs: { "auto-summary": UpperInput } }}>
				<SchemaFields
					collection="post"
					form={{ ...EMPTY_FORM, summary: "요약 abc" }}
					context={{ disabled: false }}
					onChange={onChange}
					include={(group) => group.fields.includes("summary")}
				/>
			</CmsAdminComponentsProvider>,
		);
		fireEvent.click(screen.getByText("사이트 입력: 요약 abc"));
		expect(onChange).toHaveBeenCalledWith({ summary: "요약 ABC" });
	});

	it("등록하지 않으면 내장 입력(여러 줄 요약)을 쓴다", () => {
		render(
			<SchemaFields
				collection="post"
				form={{ ...EMPTY_FORM, summary: "요약" }}
				context={{ disabled: false }}
				onChange={vi.fn()}
				include={(group) => group.fields.includes("summary")}
			/>,
		);
		expect(screen.getByDisplayValue("요약").tagName).toBe("TEXTAREA");
	});
});
