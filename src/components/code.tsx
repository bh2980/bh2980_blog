import { type HighlightedCode, Pre } from "codehike/code";

export const Code = ({ codeblock }: { codeblock: HighlightedCode }) => {
	return <Pre code={{ ...codeblock, lang: codeblock.lang.toLowerCase() }} />;
};
