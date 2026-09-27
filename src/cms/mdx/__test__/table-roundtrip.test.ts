import { describe, expect, it } from "vitest";
import { analyze, serialize, toDocument } from "../index";

describe("C6 표 셀 병합 MDX 파싱·직렬화", () => {
	it("병합 표 지시자를 정확히 왕복한다 (colspan, rowspan, header, align)", () => {
		const source = [
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

		const doc = toDocument(analyze(source));
		expect(doc.content?.[0]?.type).toBe("table");
		expect(doc.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("제목");
		expect(serialize(doc).trim()).toBe(source);
	});

	it("콜아웃 안 병합 표의 행·셀 내용도 변환해 보존한다", () => {
		const source = [
			":::::callout",
			"::::table",
			":::row",
			"::cell[내부 셀]{header colspan=2}",
			":::",
			"::::",
			":::",
		].join("\n");
		const doc = toDocument(analyze(source));
		expect(doc.content?.[0]?.type).toBe("Callout");
		expect(doc.content?.[0]?.content?.[0]?.type).toBe("table");
		expect(doc.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("내부 셀");
		const roundtrip = toDocument(analyze(serialize(doc)));
		expect(roundtrip.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("내부 셀");
		expect(serialize(roundtrip).trim()).toBe(serialize(doc).trim());
	});

	it("머리글 없는 첫 행의 병합 표를 편집기로 불러와도 td로 유지한다", async () => {
		const { mdxToTiptap, tiptapToMdx } = await import("../../editor/tiptap-content");
		const source = "::::table\n:::row\n::cell[본문]{colspan=2}\n:::\n:::row\n::cell[왼쪽]\n::cell[오른쪽]\n:::\n::::";
		const json = mdxToTiptap(source);
		expect(json.content?.[0]?.content?.[0]?.content?.[0]?.type).toBe("tableCell");
		expect(tiptapToMdx(json).trim()).toBe(source);
	});

	it("인라인 서식(굵게, 기울임, 코드, 줄바꿈)을 보존한다", () => {
		const source = [
			'::::table{align="center"}',
			":::row",
			"::cell[**굵은 제목** 및 `코드`]{header colspan=2}",
			":::",
			":::row",
			"::cell[첫 줄:br[]둘째 줄]{rowspan=2}",
			"::cell[*기울임*]",
			":::",
			":::row",
			"::cell[보통]",
			":::",
			"::::",
		].join("\n");

		const doc = toDocument(analyze(source));
		expect(serialize(doc).trim()).toBe(source);
	});

	it("병합이 없는 표는 GFM 표로 저장된다 (기존 GFM 표 바이트 불변)", () => {
		const gfm = ["| 이름 | 점수 |", "| :-- | --: |", "| 홍길동 | 100 |"].join("\n");

		const doc = toDocument(analyze(gfm));
		expect(serialize(doc).trim()).toBe(gfm);
	});

	it("병합 표에서 병합을 모두 풀면 GFM 표로 복귀한다", () => {
		const mergedSource = [
			'::::table{align="left,right"}',
			":::row",
			"::cell[이름]{header}",
			":::cell[점수]{header}",
			":::",
			":::row",
			"::cell[홍길동]",
			":::cell[100]",
			":::",
			"::::",
		].join("\n");

		const doc = toDocument(analyze(mergedSource));
		const expectedGfm = ["| 이름 | 점수 |", "| :-- | --: |", "| 홍길동 | 100 |"].join("\n");

		expect(serialize(doc).trim()).toBe(expectedGfm);
	});

	it('속성에 따옴표가 있는 형태(colspan="2")도 파싱하여 정규화 왕복한다', () => {
		const input = [
			'::::table{align="left,center"}',
			":::row",
			'::cell[제목]{header colspan="2"}',
			":::",
			":::row",
			'::cell[값]{rowspan="2"}',
			"::cell[값2]",
			":::",
			":::row",
			"::cell[값3]",
			":::",
			"::::",
		].join("\n");

		const doc = toDocument(analyze(input));
		const cell = doc.content?.[0]?.content?.[0]?.content?.[0];
		expect(cell?.attrs?.colspan).toBe(2);
		expect(cell?.attrs?.header).toBe(true);

		// 직렬화 시에는 정규화된 형태(colspan=2)로 출력된다
		expect(serialize(doc)).toContain("::cell[제목]{header colspan=2}");
	});

	it("빈 셀(::cell[])도 내용을 잃지 않고 왕복한다", () => {
		const source = [
			"::::table",
			":::row",
			"::cell[]{header colspan=2}",
			":::",
			":::row",
			"::cell[내용]",
			"::cell[]",
			":::",
			"::::",
		].join("\n");

		const doc = toDocument(analyze(source));
		expect(serialize(doc).trim()).toBe(source);
	});

	it("인라인 코드의 짝 없는 대괄호는 JSX 표로 저장해 셀을 잃지 않는다", () => {
		for (const text of ["]", "["]) {
			const doc = toDocument(
				analyze(
					[
						"<Table>",
						"<TableRow>",
						`<TableCell colspan="2">\`${text}\`</TableCell>`,
						"</TableRow>",
						"<TableRow>",
						"<TableCell>a</TableCell>",
						"<TableCell>b</TableCell>",
						"</TableRow>",
						"</Table>",
					].join("\n"),
				),
			);
			const saved = serialize(doc);
			expect(saved).toContain(`<TableCell colspan="2">\`${text}\`</TableCell>`);
			expect(toDocument(analyze(saved))).toEqual(doc);
		}
	});

	it("병합 없는 표도 GFM으로 표현할 수 없는 머리글 배치는 directive로 보존한다", () => {
		const sources = [
			[
				"::::table",
				":::row",
				"::cell[이름]{header}",
				"::cell[값]",
				":::",
				":::row",
				"::cell[나이]{header}",
				"::cell[3]",
				":::",
				"::::",
			],
			["::::table", ":::row", "::cell[a]", "::cell[b]", ":::", ":::row", "::cell[c]", "::cell[d]", ":::", "::::"],
		].map((lines) => lines.join("\n"));
		for (const source of sources) {
			const saved = serialize(toDocument(analyze(source))).trim();
			expect(saved).toBe(source);
		}
	});

	it("과도한 span은 표 크기 안으로 제한한다", () => {
		const doc = toDocument(analyze("::::table\n:::row\n::cell[a]{colspan=1000000000 rowspan=9}\n:::\n::::"));
		expect(doc.content?.[0]?.content?.[0]?.content?.[0]?.attrs).toEqual({ colspan: 64 });
	});
});
