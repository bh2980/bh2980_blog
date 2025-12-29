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
			<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
				<div className="mb-2 font-bold text-xs text-zinc-500 uppercase">MERMAID PREVIEW</div>
				{chartCode ? (
					<Mermaid chart={chartCode} />
				) : (
					<div className="text-sm text-zinc-400">코드를 입력하면 미리보기가 생성됩니다.</div>
				)}
			</div>
		);
	},
});
