import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import Mermaid from "@/components/mermaid";

export const mermaidBlock = block({
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
			<div
				style={{
					padding: "1rem",
					border: "1px solid #e1e1e1",
					borderRadius: "8px",
					backgroundColor: "#fafafa",
				}}
			>
				<div
					style={{
						marginBottom: "8px",
						fontWeight: "bold",
						fontSize: "12px",
						color: "#666",
					}}
				>
					MERMAID PREVIEW
				</div>
				{chartCode ? (
					<Mermaid chart={chartCode} />
				) : (
					<div style={{ color: "#999", fontSize: "14px" }}>코드를 입력하면 차트가 생성됩니다.</div>
				)}
			</div>
		);
	},
});
