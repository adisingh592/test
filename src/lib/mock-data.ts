/**
 * Deterministic demo data. Nothing in this file comes from a real test run,
 * model inference, storage upload or blockchain transaction. Replace the
 * functions in `verification-service.ts` with real API calls to retire it.
 */
import type {
  Challenge,
  ClaimType,
  EvidenceItem,
  EvidenceOutcome,
  IntegrationRecord,
  StepId,
  VerificationRun,
} from "./types";

export const DEMO_USER = {
  name: "Jordan Doe",
  initials: "JD",
  wallet: "0x7A3...c9F1",
};

export const STEPS: { id: StepId; label: string }[] = [
  { id: "claim", label: "Claim" },
  { id: "challenge", label: "Challenge" },
  { id: "evidence", label: "Evidence" },
  { id: "verification", label: "Verification" },
  { id: "verdict", label: "Verdict" },
];

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  "smart-contract": "Code (Smart Contract)",
  factual: "Factual Statement",
  credential: "Credential / Work History",
};

/** Claim types the demo engine can generate challenges for. */
export const SUPPORTED_CLAIM_TYPES: ClaimType[] = ["smart-contract"];

export const SAMPLE_CLAIM_TEXT = "This smart contract prevents unauthorized withdrawals.";

interface ChallengeTemplate {
  name: string;
  description: (scope: string) => string;
  expected: string;
  outcome: EvidenceOutcome;
  observed: string;
  logs: (scope: string) => string[];
  implication: string;
}

/**
 * Challenge plan for access-control claims. Outcomes are fixed so the demo
 * always reproduces the same result: the non-owner withdrawal succeeds.
 */
export const ACCESS_CONTROL_TEMPLATE: ChallengeTemplate[] = [
  {
    name: "Valid withdrawal (owner)",
    description: () => "Check if the authorized owner can withdraw",
    expected: "Owner withdrawal succeeds and balance decreases by 1.0 ETH",
    outcome: "passed",
    observed: "Withdrawal succeeded. Contract balance 5.0 → 4.0 ETH.",
    implication: "The owner could not withdraw, so the contract does not behave as intended.",
    logs: (scope) => [
      "deploy Vault (owner = 0xA11c…0001), fund 5.0 ETH",
      `call ${scope} as 0xA11c…0001, amount = 1.0 ETH`,
      "tx status: success",
      "assert balance == 4.0 ETH  ✓",
    ],
  },
  {
    name: "Unauthorized withdrawal",
    description: () => "Attempt a withdrawal from a non-owner account",
    expected: "Call reverts with an access-control error",
    outcome: "failed",
    observed: "Call did not revert. Non-owner withdrew 1.0 ETH.",
    implication: "An unauthorized account was able to withdraw funds, which contradicts the claim.",
    logs: (scope) => [
      "deploy Vault (owner = 0xA11c…0001), fund 5.0 ETH",
      `call ${scope} as 0xBEEF…0002 (non-owner), amount = 1.0 ETH`,
      "tx status: success (expected: revert)",
      "assert revert  ✗  — funds transferred to 0xBEEF…0002",
    ],
  },
  {
    name: "Access control check",
    description: () => "Verify the onlyOwner modifier is enforced",
    expected: "Admin functions guarded by onlyOwner reject non-owners",
    outcome: "passed",
    observed: "setOwner() and pause() revert for non-owner callers.",
    implication: "Admin functions are callable by non-owners, which contradicts the claim.",
    logs: () => [
      "static scan: onlyOwner present on setOwner(), pause()",
      "call setOwner() as 0xBEEF…0002 → revert \"Ownable: caller is not the owner\"",
      "call pause() as 0xBEEF…0002 → revert \"Ownable: caller is not the owner\"",
      "note: modifier not applied to withdraw()",
    ],
  },
];

export function buildChallenges(claimId: string, scope: string): Challenge[] {
  return ACCESS_CONTROL_TEMPLATE.map((t, i) => ({
    id: `${claimId}-T${i + 1}`,
    index: i + 1,
    name: t.name,
    description: t.description(scope),
    expected: t.expected,
  }));
}

export function buildEvidence(
  challenge: Challenge,
  scope: string,
  collectedAt: string,
): EvidenceItem {
  const t = ACCESS_CONTROL_TEMPLATE[challenge.index - 1];
  return {
    challengeId: challenge.id,
    outcome: t.outcome,
    source: "Test Runner (mock)",
    collectedAt,
    observed: t.observed,
    logs: t.logs(scope),
    implication: t.implication,
  };
}

export function buildIntegrations(final: boolean): IntegrationRecord[] {
  return [
    {
      id: "0g-storage",
      name: "0G Storage",
      role: "Evidence storage",
      mode: "simulated",
      detail: final
        ? "Evidence bundle prepared. Not uploaded — integration not connected."
        : "Upload pending verdict. Integration not connected.",
    },
    {
      id: "hedera",
      name: "Hedera",
      role: "Verification transaction",
      mode: "simulated",
      detail: "No transaction submitted. Integration not connected.",
    },
    {
      id: "whitechain",
      name: "Whitechain",
      role: "Settlement",
      mode: "simulated",
      detail: "No settlement executed. Integration not connected.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Seed runs
// ---------------------------------------------------------------------------

const clm001Challenges = buildChallenges("CLM-001", "withdraw()");
const clm001Times = ["2025-04-26T10:26:00Z", "2025-04-26T10:27:00Z", "2025-04-26T10:28:00Z"];

const demoRun: VerificationRun = {
  claim: {
    id: "CLM-001",
    text: SAMPLE_CLAIM_TEXT,
    type: "smart-contract",
    scope: "withdraw() function",
    submittedBy: DEMO_USER.wallet,
    createdAt: "2025-04-26T10:24:00Z",
  },
  step: "evidence",
  status: "in-progress",
  challenges: clm001Challenges,
  evidence: Object.fromEntries(
    clm001Challenges.map((c, i) => [c.id, buildEvidence(c, "withdraw()", clm001Times[i])]),
  ),
  result: {
    verdict: "refuted",
    confidence: 98,
    reason:
      "An unauthorized account was able to withdraw funds, which contradicts the claim.",
    finalized: false,
  },
  receipt: {
    id: "PR-7842",
    claimId: "CLM-001",
    verdict: "refuted",
    confidence: 98,
    evidenceCount: 3,
    evidenceDigest: "sim-3f9a0c71e2b4d815",
    issuedAt: "2025-04-26T10:28:00Z",
    status: "draft",
    integrations: buildIntegrations(false),
  },
};

const pauseChallenges: Challenge[] = [
  {
    id: "CLM-002-T1",
    index: 1,
    name: "Admin pause",
    description: "Admin account calls pause()",
    expected: "Contract enters paused state",
  },
  {
    id: "CLM-002-T2",
    index: 2,
    name: "Non-admin pause",
    description: "Non-admin account calls pause()",
    expected: "Call reverts",
  },
];

const verifiedRun: VerificationRun = {
  claim: {
    id: "CLM-002",
    text: "Only the admin role can pause token transfers.",
    type: "smart-contract",
    scope: "pause() function",
    submittedBy: DEMO_USER.wallet,
    createdAt: "2025-04-25T15:02:00Z",
  },
  step: "verdict",
  status: "completed",
  challenges: pauseChallenges,
  evidence: {
    "CLM-002-T1": {
      challengeId: "CLM-002-T1",
      outcome: "passed",
      source: "Test Runner (mock)",
      collectedAt: "2025-04-25T15:04:00Z",
      observed: "paused() == true after admin call.",
      logs: ["call pause() as admin → success", "assert paused() == true  ✓"],
    },
    "CLM-002-T2": {
      challengeId: "CLM-002-T2",
      outcome: "passed",
      source: "Test Runner (mock)",
      collectedAt: "2025-04-25T15:05:00Z",
      observed: "Reverted with AccessControl error.",
      logs: ["call pause() as 0xBEEF…0002 → revert", "assert revert  ✓"],
    },
  },
  result: {
    verdict: "verified",
    confidence: 95,
    reason: "Every challenge confirmed that only the admin role can pause transfers.",
    finalized: true,
  },
  receipt: {
    id: "PR-7839",
    claimId: "CLM-002",
    verdict: "verified",
    confidence: 95,
    evidenceCount: 2,
    evidenceDigest: "sim-8b21e4f09d3c6a52",
    issuedAt: "2025-04-25T15:06:00Z",
    status: "issued",
    integrations: buildIntegrations(true),
  },
};

const reentrancyChallenges: Challenge[] = [
  {
    id: "CLM-003-T1",
    index: 1,
    name: "Guard present",
    description: "Check nonReentrant on external value transfers",
    expected: "All payable exits guarded",
  },
  {
    id: "CLM-003-T2",
    index: 2,
    name: "Reentrant callback",
    description: "Re-enter claim() from a malicious receiver",
    expected: "Second call reverts",
  },
];

const inconclusiveRun: VerificationRun = {
  claim: {
    id: "CLM-003",
    text: "The staking contract is not vulnerable to reentrancy.",
    type: "smart-contract",
    scope: "claim() function",
    submittedBy: "0x19C...44aE",
    createdAt: "2025-04-24T09:41:00Z",
  },
  step: "verdict",
  status: "completed",
  challenges: reentrancyChallenges,
  evidence: {
    "CLM-003-T1": {
      challengeId: "CLM-003-T1",
      outcome: "passed",
      source: "Static Analyzer (mock)",
      collectedAt: "2025-04-24T09:43:00Z",
      observed: "nonReentrant found on claim() and exit().",
      logs: ["scan modifiers → claim(): nonReentrant, exit(): nonReentrant"],
    },
    "CLM-003-T2": {
      challengeId: "CLM-003-T2",
      outcome: "inconclusive",
      source: "Test Runner (mock)",
      collectedAt: "2025-04-24T09:46:00Z",
      observed: "Harness timed out before the callback executed.",
      logs: ["deploy MaliciousReceiver", "call claim() → timeout after 30s"],
    },
  },
  result: {
    verdict: "inconclusive",
    confidence: 61,
    reason: "One challenge could not complete, so the evidence neither confirms nor refutes the claim.",
    finalized: true,
  },
  receipt: {
    id: "PR-7835",
    claimId: "CLM-003",
    verdict: "inconclusive",
    confidence: 61,
    evidenceCount: 2,
    evidenceDigest: "sim-c04d7719ae5f2b90",
    issuedAt: "2025-04-24T09:47:00Z",
    status: "issued",
    integrations: buildIntegrations(true),
  },
};

const notVerifiableRun: VerificationRun = {
  claim: {
    id: "CLM-004",
    text: "Our protocol is the most trusted DeFi platform.",
    type: "factual",
    scope: "Marketing statement",
    submittedBy: "0x19C...44aE",
    createdAt: "2025-04-23T17:12:00Z",
  },
  step: "verdict",
  status: "completed",
  challenges: [],
  evidence: {},
  result: {
    verdict: "not-verifiable",
    confidence: 100,
    reason: "The claim is subjective and cannot be reduced to testable challenges.",
    finalized: true,
  },
  receipt: {
    id: "PR-7831",
    claimId: "CLM-004",
    verdict: "not-verifiable",
    confidence: 100,
    evidenceCount: 0,
    evidenceDigest: "sim-0000000000000000",
    issuedAt: "2025-04-23T17:13:00Z",
    status: "issued",
    integrations: buildIntegrations(true),
  },
};

export const SEED_RUNS: VerificationRun[] = [demoRun, verifiedRun, inconclusiveRun, notVerifiableRun];

export const DEMO_RUN_ID = demoRun.claim.id;
