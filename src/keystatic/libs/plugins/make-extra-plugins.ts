import type { Plugin } from "prosemirror-state";
import { codeBlockKeysPlugin } from "./pm/codeblock-keys";
import { codeBlockPasteAsHardBreakPlugin } from "./pm/codeblock-paste";

export type ExtraPluginsSlots = {
	beforeInput?: Plugin[];
	beforeKeydown?: Plugin[];
	afterKeymap?: Plugin[];
};

export function makeExtraPlugins(schema: any): ExtraPluginsSlots {
	return {
		beforeInput: [codeBlockPasteAsHardBreakPlugin()],
		beforeKeydown: [codeBlockKeysPlugin(schema)],
	};
}
