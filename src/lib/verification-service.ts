/**
 * Verification service — mock implementation.
 *
 * Each function has the shape of a future backend call (async, serializable
 * input/output). Swap the bodies for `fetch()` calls when the API exists; the
 * UI only depends on these signatures.
 */
import {
  SUPPORTED_CLAIM_TYPES,
  buildChallenges,
  buildEvidence,
  buildIntegrations,
} from "./mock-data";
import type {
  Challenge,
  Claim,
  EvidenceItem,
  ProofReceipt,
  VerificationResult,
  VerificationRun,
} from "./types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateChallengePlan(claim: Claim): Promise<Challenge[]> {
  await wait(900);
  if (!SUPPORTED_CLAIM_TYPES.includes(claim.type)) return [];
  return buildChallenges(claim.id, functionName(claim.scope));
}

export async function runChallenge(claim: Claim, challenge: Challenge): Promise<EvidenceItem> {
  await wait(1100);
  return buildEvidence(challenge, functionName(claim.scope), new Date().toISOString());
}

/** Rule-based verdict over the collected evidence. */
export async function evaluateEvidence(
  challenges: Challenge[],
  evidence: Record<string, EvidenceItem>,
): Promise<VerificationResult> {
  await wait(900);
  return deriveVerdict(challenges, evidence);
}

export async function issueReceipt(run: VerificationRun, receiptId: string): Promise<ProofReceipt> {
  await wait(500);
  const result = run.result!;
  return {
    id: receiptId,
    claimId: run.claim.id,
    verdict: result.verdict,
    confidence: result.confidence,
    evidenceCount: Object.keys(run.evidence).length,
    evidenceDigest: simulatedDigest(JSON.stringify(run.evidence)),
    issuedAt: new Date().toISOString(),
    status: "issued",
    integrations: buildIntegrations(true),
  };
}

export function deriveVerdict(
  challenges: Challenge[],
  evidence: Record<string, EvidenceItem>,
): VerificationResult {
  if (challenges.length === 0) {
    return {
      verdict: "not-verifiable",
      confidence: 100,
      reason:
        "No automated challenges exist for this claim type yet, so it cannot be tested.",
      finalized: true,
    };
  }

  const items = challenges.map((c) => evidence[c.id]).filter(Boolean);
  const failed = items.find((e) => e.outcome === "failed");
  if (failed) {
    const challenge = challenges.find((c) => c.id === failed.challengeId)!;
    return {
      verdict: "refuted",
      confidence: 98,
      reason: failed.implication ?? `${challenge.name} failed: ${failed.observed}`,
      finalized: true,
    };
  }

  if (items.length < challenges.length || items.some((e) => e.outcome === "inconclusive")) {
    return {
      verdict: "inconclusive",
      confidence: 60,
      reason: "Not every challenge produced a definitive result.",
      finalized: true,
    };
  }

  return {
    verdict: "verified",
    confidence: 92,
    reason: "Every challenge produced evidence consistent with the claim.",
    finalized: true,
  };
}

/** "withdraw() function" → "withdraw()" */
function functionName(scope: string) {
  return scope.replace(/\s+function$/i, "").trim() || "target()";
}

/** Non-cryptographic placeholder so the UI never implies a real content hash. */
function simulatedDigest(input: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  return `sim-${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}
