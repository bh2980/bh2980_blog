import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderMDX } from "../mdx-content";
import { Table, TableCell, TableRow } from "../table";

describe("C6 공개 표 컴포넌트 (Table, TableRow, TableCell)", () => {
	it("header=true이면 th로, 아니면 td로 렌더링하고 colspan·rowspan을 반영한다", () => {
		render(
			<Table align="left,center">
				<TableRow>
					<TableCell header colspan={2}>
						제목
					</TableCell>
				</TableRow>
				<TableRow>
					<TableCell rowspan={2}>값1</TableCell>
					<TableCell>값2</TableCell>
				</TableRow>
				<TableRow>
					<TableCell>값3</TableCell>
				</TableRow>
			</Table>,
		);

		const th = screen.getByText("제목");
		expect(th.tagName).toBe("TH");
		expect(th.getAttribute("colspan")).toBe("2");

		const td1 = screen.getByText("값1");
		expect(td1.tagName).toBe("TD");
		expect(td1.getAttribute("rowspan")).toBe("2");

		const td2 = screen.getByText("값2");
		expect(td2.tagName).toBe("TD");
	});

	it("열 정렬(align)을 격자 구조에 맞춰 각 셀에 올바르게 분배한다", () => {
		render(
			<Table align="left,center">
				<TableRow>
					<TableCell header colspan={2}>
						전체 제목
					</TableCell>
				</TableRow>
				<TableRow>
					<TableCell rowspan={2}>왼쪽 1</TableCell>
					<TableCell>가운데 2</TableCell>
				</TableRow>
				<TableRow>
					<TableCell>가운데 3</TableCell>
				</TableRow>
			</Table>,
		);

		const th = screen.getByText("전체 제목");
		expect(th.className).toContain("text-left");

		const td1 = screen.getByText("왼쪽 1");
		expect(td1.className).toContain("text-left");

		const td2 = screen.getByText("가운데 2");
		expect(td2.className).toContain("text-center");

		const td3 = screen.getByText("가운데 3");
		expect(td3.className).toContain("text-center");
	});

	it("renderMDX를 통해 지시자 표가 올바르게 렌더링된다", async () => {
		const mdx = [
			'::::table{align="left,center"}',
			":::row",
			"::cell[머리글]{header colspan=2}",
			":::",
			":::row",
			"::cell[내용1]{rowspan=2}",
			"::cell[내용2]",
			":::",
			":::row",
			"::cell[내용3]",
			":::",
			"::::",
		].join("\n");

		const { content } = await renderMDX(mdx);
		render(content);

		const header = screen.getByText("머리글");
		expect(header.tagName).toBe("TH");
		expect(header.getAttribute("colspan")).toBe("2");

		const item1 = screen.getByText("내용1");
		expect(item1.tagName).toBe("TD");
		expect(item1.getAttribute("rowspan")).toBe("2");
	});
});
