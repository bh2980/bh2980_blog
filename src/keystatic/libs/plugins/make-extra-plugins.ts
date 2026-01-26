import type { Schema } from "prosemirror-model";
import type { Plugin } from "prosemirror-state";
import { codeBlockKeysPlugin } from "./pm/codeblock-keys";
import { codeBlockPasteAsHardBreakPlugin } from "./pm/codeblock-paste";
import { wrapperKeysPlugin } from "./pm/wrapper-keys";

export type ExtraPluginsSlots = {
	beforeInput?: Plugin[];
	beforeKeydown?: Plugin[];
	afterKeymap?: Plugin[];
};

export function makeExtraPlugins(schema: Schema): ExtraPluginsSlots {
	return {
		beforeInput: [codeBlockPasteAsHardBreakPlugin()],
		beforeKeydown: [wrapperKeysPlugin(schema), codeBlockKeysPlugin(schema)],
	};
}
