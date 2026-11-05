export type ClaimType = "smart-contract" | "factual" | "credential";

export type StepId = "claim" | "challenge" | "evidence" | "verification" | "verdict";

export type ChallengeStatus = "pending" | "running" | "passed" | "failed" | "inconclusive";

export type EvidenceOutcome = Extract<ChallengeStatus, "passed" | "failed" | "inconclusive">;

export type Verdict = "verified" | "refuted" | "inconclusive" | "not-verifiable";

export type RunStatus = "in-progress" | "completed";

export interface Claim {
  id: string;
  text: string;
  type: ClaimType;
  scope: string;
  submittedBy: string;
  createdAt: string; // ISO 8601
}

export interface ClaimInput {
  text: string;
  type: ClaimType;
  scope: string;
  submittedBy: string;
}

export interface Challenge {
  id: string;
  index: number;
  name: string;
  description: string;
  expected: string;
}

export interface EvidenceItem {
  challengeId: string;
  outcome: EvidenceOutcome;
  source: string;
  collectedAt: string; // ISO 8601
  observed: string;
  logs: string[];
  /** What a failure of this challenge means for the claim. */
  implication?: string;
}

export interface VerificationResult {
  verdict: Verdict;
  confidence: number; // 0-100
  reason: string;
  finalized: boolean;
}

export type IntegrationId = "0g-storage" | "hedera" | "whitechain";

export interface IntegrationRecord {
  id: IntegrationId;
  name: string;
  role: string;
  /** Every integration is simulated until real connectors are wired up. */
  mode: "simulated";
  detail: string;
}

export interface ProofReceipt {
  id: string;
  claimId: string;
  verdict: Verdict;
  confidence: number;
  evidenceCount: number;
  evidenceDigest: string;
  issuedAt: string; // ISO 8601
  status: "draft" | "issued";
  integrations: IntegrationRecord[];
}

export interface VerificationRun {
  claim: Claim;
  step: StepId;
  status: RunStatus;
  challenges: Challenge[];
  evidence: Record<string, EvidenceItem>;
  runningChallengeId?: string;
  result?: VerificationResult;
  receipt?: ProofReceipt;
}
