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

	it("공개 셀에도 정렬 격자와 같은 제한된 span을 적용한다", () => {
		render(
			<Table>
				<TableRow>
					<TableCell colSpan={1000} rowspan="9">
						큰 셀
					</TableCell>
				</TableRow>
			</Table>,
		);
		const cell = screen.getByText("큰 셀");
		expect(cell.getAttribute("colspan")).toBe("64");
		expect(cell.hasAttribute("rowspan")).toBe(false);
	});

	it("대체 저장된 JSX 표도 셀을 행의 직계 자식으로 렌더한다", async () => {
		const mdx = [
			"<Table>",
			"<TableRow>",
			'<TableCell colspan="2">`]`</TableCell>',
			"</TableRow>",
			"<TableRow>",
			"<TableCell>a</TableCell>",
			"<TableCell>b</TableCell>",
			"</TableRow>",
			"</Table>",
		].join("\n");
		const { content } = await renderMDX(mdx);
		const { container } = render(content);
		const rows = container.querySelectorAll("tr");
		expect([...rows].map((row) => [...row.children].map((cell) => cell.tagName))).toEqual([["TD"], ["TD", "TD"]]);
		expect(container.querySelector("tr > td")?.getAttribute("colspan")).toBe("2");
		expect(container.querySelector("tr p, tr br")).toBeNull();
	});

	it("머리글 셀에 열·행 scope를 붙인다", () => {
		render(
			<Table>
				<TableRow>
					<TableCell header colspan={2}>
						분기
					</TableCell>
				</TableRow>
				<TableRow>
					<TableCell header>1월</TableCell>
					<TableCell>10</TableCell>
				</TableRow>
			</Table>,
		);
		expect(screen.getByText("분기").getAttribute("scope")).toBe("col");
		expect(screen.getByText("1월").getAttribute("scope")).toBe("row");
		expect(screen.getByText("10").hasAttribute("scope")).toBe(false);
	});

	it("GFM 머리글에도 scope=col을 붙인다", async () => {
		const { content } = await renderMDX("| 이름 | 값 |\n| --- | --- |\n| a | 1 |");
		const { container } = render(content);
		expect([...container.querySelectorAll("th")].map((cell) => cell.getAttribute("scope"))).toEqual(["col", "col"]);
	});

	it("widths로 열 너비와 표 폭을 적용한다", async () => {
		const mdx = [
			'::::table{widths="120,200"}',
			":::row",
			"::cell[a]{header}",
			"::cell[b]{header}",
			":::",
			":::row",
			"::cell[1]",
			"::cell[2]",
			":::",
			"::::",
		].join("\n");
		const { content } = await renderMDX(mdx);
		const { container } = render(content);
		const cols = [...container.querySelectorAll("col")].map((col) => (col as HTMLElement).style.width);
		expect(cols).toEqual(["120px", "200px"]);
		expect(container.querySelector("table")?.style.width).toBe("320px");
	});

	it("격자 밖의 여분 열 너비는 빈 열을 만들지 않는다", async () => {
		const mdx = '::::table{widths="100,200,300"}\n:::row\n::cell[a]{header}\n::cell[b]{header}\n:::\n::::';
		const { content } = await renderMDX(mdx);
		const { container } = render(content);
		expect(container.querySelectorAll("col")).toHaveLength(2);
		expect(container.querySelector("table")?.style.width).toBe("300px");
	});
});
