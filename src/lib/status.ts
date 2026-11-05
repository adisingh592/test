import type { ChallengeStatus, RunStatus, Verdict } from "./types";

export type Tone = "success" | "danger" | "warning" | "info" | "neutral" | "purple";

export const VERDICT_META: Record<Verdict, { label: string; tone: Tone }> = {
  verified: { label: "Verified", tone: "success" },
  refuted: { label: "Refuted", tone: "danger" },
  inconclusive: { label: "Inconclusive", tone: "warning" },
  "not-verifiable": { label: "Not Verifiable", tone: "neutral" },
};

export const CHALLENGE_META: Record<ChallengeStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  running: { label: "Running", tone: "info" },
  passed: { label: "Passed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  inconclusive: { label: "Inconclusive", tone: "warning" },
};

export const RUN_STATUS_META: Record<RunStatus, { label: string; tone: Tone }> = {
  "in-progress": { label: "In Progress", tone: "info" },
  completed: { label: "Completed", tone: "success" },
};
