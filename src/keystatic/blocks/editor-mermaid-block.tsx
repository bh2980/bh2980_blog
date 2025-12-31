import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import { Mermaid } from "@/components/mermaid";

export const editorMermaidBlock = block({
	label: "Mermaid 차트",
	schema: {
		chart: fields.text({
			label: "차트 코드",
			multiline: true,
		}),
	},
	ContentView: (props) => {
		const chartCode = props.value.chart;

		return (
			<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<div className="mb-2 font-bold text-slate-500 text-xs uppercase">MERMAID PREVIEW</div>
				{chartCode ? (
					<Mermaid chart={chartCode} />
				) : (
					<div className="text-slate-400 text-sm">코드를 입력하면 미리보기가 생성됩니다.</div>
				)}
			</div>
		);
	},
});
