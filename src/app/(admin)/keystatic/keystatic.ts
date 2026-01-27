"use client";

import { makePage } from "@keystatic/next/ui/app";
import type { Schema } from "prosemirror-model";
import { makeExtraPlugins } from "@/keystatic/plugins";
import config from "../../../../keystatic.config";

globalThis.__KEYSTATIC_EXTRA_PM_PLUGINS__ = (schema: Schema) => makeExtraPlugins(schema);

export default makePage(config);
