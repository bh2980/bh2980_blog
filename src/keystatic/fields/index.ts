import { markdoc } from "./markdoc";
import { slug } from "./slug";

import { fields as keystaticFields } from "@keystatic/core";

export const fields = {
  ...keystaticFields,
  slug,
  markdoc,
};
