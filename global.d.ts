import type { Schema } from "prosemirror-model";
import type { ExtraPluginsSlots } from "@/keystatic/libs/plugins";

declare global {
	var __KEYSTATIC_EXTRA_PM_PLUGINS__: (schema: Schema) => ExtraPluginsSlots | ExtraPluginsSlots["beforeKeydown"];
}
