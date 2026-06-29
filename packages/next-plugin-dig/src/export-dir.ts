// Single source of truth for Next's static-export output directory, shared by the publish wiring
// (index.ts) and the self-description (capabilities.ts) so they can never disagree.

/** Where `next build` with `output: "export"` writes the static site. */
export const NEXT_EXPORT_DIR = "out";
