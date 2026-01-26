"use client";

import { makePage } from "@keystatic/next/ui/app";
import { makeExtraPlugins } from "@/keystatic/libs/plugins";
import config from "../../../../keystatic.config";

(globalThis as any).__KEYSTATIC_EXTRA_PM_PLUGINS__ = (schema: any) => makeExtraPlugins(schema);

export default makePage(config);
