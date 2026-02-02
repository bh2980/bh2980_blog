import type { Schema } from "prosemirror-model";
import type { Plugin } from "prosemirror-state";
import { codeBlockKeysPlugin } from "./pm/codeblock-keys";
import { codeBlockPasteAsParagraphPlugin } from "./pm/codeblock-paste";
import { wrapperKeysPlugin } from "./pm/wrapper-keys";

export type ExtraPluginsSlots = {
	beforeInput?: Plugin[];
	beforeKeydown?: Plugin[];
	afterKeymap?: Plugin[];
};

export function makeExtraPlugins(schema: Schema): ExtraPluginsSlots {
	return {
		beforeInput: [codeBlockPasteAsParagraphPlugin()],
		beforeKeydown: [wrapperKeysPlugin(schema), codeBlockKeysPlugin(schema)],
	};
}
