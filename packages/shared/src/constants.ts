/** Above this number of configurations the engine stops enumerating and relies on DP summaries. */
export const ENUMERATION_LIMIT = 5000;
/** Deleting a branch with more nodes than this requires an explicit confirmation (MCP, UI). */
export const DESTRUCTIVE_CONFIRM_THRESHOLD = 5;
/** Number of activity entries kept in the shared document (oldest dropped beyond). */
export const ACTIVITY_LOG_LIMIT = 10_000;
/** Consecutive identical edits (same author, command and nodes) closer than this are merged into one entry. */
export const ACTIVITY_COALESCE_MS = 30_000;
/** Hard cap on the number of nodes a single document may hold (import, build_subtree). */
export const MAX_TREE_NODES = 5000;
/** Maximum number of Pareto-optimal partial configurations kept per node during DP. */
export const PARETO_CAP = 2000;
/** Default "top N" per criterion. */
export const DEFAULT_TOP_N = 5;
