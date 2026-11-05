/** Motifs de signalement proposés. Le code est stocké, le libellé vient des traductions. */
export const REPORT_REASONS = ["hate", "defamation", "offtopic", "spam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const isReason = (v: string): v is ReportReason => (REPORT_REASONS as readonly string[]).includes(v);

export const REPORT_TARGETS = ["REVIEW", "COMMENT"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export const isTarget = (v: string): v is ReportTarget => (REPORT_TARGETS as readonly string[]).includes(v);
