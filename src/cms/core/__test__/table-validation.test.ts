import { describe, expect, it } from "vitest";
import { prepareSnapshot } from "../snapshot";

describe("C6 표 셀 병합 발행 전 검사 (span 및 격자 경고)", () => {
	it("10억 열 병합은 빠르게 경고하고 격자를 만들지 않는다", async () => {
		const mdx = "::::table\n:::row\n::cell[위험]{colspan=1000000000}\n:::\n::::";
		const snap = await prepareSnapshot({
			collection: "post",
			slug: "huge-table",
			metadata: { title: "표 테스트" },
			mdx,
		});
		expect(snap.warnings?.some((warning) => warning.code === "invalid_table_span")).toBe(true);
	});

	it("올바른 병합 표는 경고를 발생시키지 않는다", async () => {
		const mdx = [
			'::::table{align="left,center"}',
			":::row",
			"::cell[제목]{header colspan=2}",
			":::",
			":::row",
			"::cell[값1]{rowspan=2}",
			"::cell[값2]",
			":::",
			":::row",
			"::cell[값3]",
			":::",
			"::::",
		].join("\n");

		const snap = await prepareSnapshot({
			collection: "post",
			slug: "valid-table",
			metadata: { title: "표 테스트" },
			mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings).toEqual([]);
	});

	it("rowspan이 표의 전체 행 수를 초과하면 경고한다", async () => {
		const mdx = ["::::table", ":::row", "::cell[초과]{rowspan=5}", ":::", ":::row", "::cell[값]", ":::", "::::"].join(
			"\n",
		);

		const snap = await prepareSnapshot({
			collection: "post",
			slug: "rowspan-overflow",
			metadata: { title: "표 테스트" },
			mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings.length).toBeGreaterThan(0);
		expect(tableWarnings[0]?.message).toContain("초과합니다");
	});

	it("병합 셀이 서로 겹치면 경고한다", async () => {
		const mdx = [
			"::::table",
			":::row",
			"::cell[셀1]{colspan=2}",
			"::cell[셀2]{colspan=2}",
			":::",
			":::row",
			"::cell[셀3]{rowspan=2}",
			"::cell[셀4]",
			":::",
			"::::",
		].join("\n");

		const snap = await prepareSnapshot({
			collection: "post",
			slug: "overlapping-cells",
			metadata: { title: "표 테스트" },
			mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings.length).toBeGreaterThan(0);
	});

	it("행마다 열 수가 일치하지 않으면 경고한다", async () => {
		const mdx = [
			"::::table",
			":::row",
			"::cell[셀1]",
			"::cell[셀2]",
			":::",
			":::row",
			"::cell[셀3]",
			":::",
			"::::",
		].join("\n");

		const snap = await prepareSnapshot({
			collection: "post",
			slug: "mismatched-columns",
			metadata: { title: "표 테스트" },
			mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings.length).toBeGreaterThan(0);
		expect(tableWarnings[0]?.message).toContain("열 수가 일치하지 않거나");
	});

	it("잘못된 span 값(0 이하 또는 숫자가 아님)을 경고한다", async () => {
		const mdx = ["::::table", ":::row", "::cell[셀1]{colspan=0}", ":::", "::::"].join("\n");

		const snap = await prepareSnapshot({
			collection: "post",
			slug: "invalid-span-value",
			metadata: { title: "표 테스트" },
			mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings.length).toBeGreaterThan(0);
		expect(tableWarnings[0]?.message).toContain("잘못된 colspan 값입니다");
	});
});
