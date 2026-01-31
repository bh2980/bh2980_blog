import type { Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

export function HastView({ hast, components }: { hast: Root; components?: Record<string, any> }) {
	const node = toJsxRuntime(hast, {
		Fragment,
		jsx,
		jsxs,
		components: {
			...components,
			pre: (props: any) => <pre {...props} className={"pointer-events-none absolute top-0 left-0 z-10 w-full"} />,
		},
		// 리스트/라인 같은 데 key 자동 부여(권장)
		passKeys: true,
	});

	return node;
}
