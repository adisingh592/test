"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { SEED_RUNS } from "@/lib/mock-data";
import {
  evaluateEvidence,
  generateChallengePlan,
  issueReceipt,
  runChallenge,
} from "@/lib/verification-service";
import type { ClaimInput, VerificationRun } from "@/lib/types";

interface VerificationStore {
  runs: VerificationRun[];
  getRun: (id: string) => VerificationRun | undefined;
  /** Creates a claim and runs the full pipeline. Returns the new claim ID. */
  submitClaim: (input: ClaimInput) => string;
  /** Continues a run paused after evidence collection through to the verdict. */
  finalizeRun: (id: string) => void;
  isBusy: (id: string) => boolean;
}

const StoreContext = createContext<VerificationStore | null>(null);

const nextId = (ids: string[], prefix: string, fallback: number) => {
  const max = ids.reduce((m, id) => Math.max(m, Number(id.replace(prefix, "")) || 0), fallback);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
};

export function VerificationStoreProvider({ children }: { children: React.ReactNode }) {
  const [runs, setRuns] = useState<VerificationRun[]>(SEED_RUNS);
  const runsRef = useRef(runs);
  runsRef.current = runs;
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const save = useCallback((run: VerificationRun) => {
    setRuns((prev) =>
      prev.some((r) => r.claim.id === run.claim.id)
        ? prev.map((r) => (r.claim.id === run.claim.id ? run : r))
        : [run, ...prev],
    );
  }, []);

  const setBusyFlag = useCallback((id: string, value: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /** Verification → Verdict: evaluate evidence and issue the receipt. */
  const conclude = useCallback(
    async (start: VerificationRun) => {
      let run: VerificationRun = { ...start, step: "verification", result: undefined };
      save(run);
      const result = await evaluateEvidence(run.challenges, run.evidence);
      run = { ...run, result };
      save(run);

      const receiptId =
        start.receipt?.id ??
        nextId(
          runsRef.current.flatMap((r) => (r.receipt ? [r.receipt.id] : [])),
          "PR-",
          7800,
        );
      const receipt = await issueReceipt(run, receiptId);
      save({ ...run, receipt, step: "verdict", status: "completed" });
    },
    [save],
  );

  const submitClaim = useCallback(
    (input: ClaimInput) => {
      const id = nextId(
        runsRef.current.map((r) => r.claim.id),
        "CLM-",
        0,
      );
      let run: VerificationRun = {
        claim: { ...input, id, createdAt: new Date().toISOString() },
        step: "claim",
        status: "in-progress",
        challenges: [],
        evidence: {},
      };
      save(run);
      setBusyFlag(id, true);

      (async () => {
        run = { ...run, step: "challenge" };
        save(run);
        const challenges = await generateChallengePlan(run.claim);
        run = { ...run, challenges, step: "evidence" };
        save(run);

        for (const challenge of challenges) {
          run = { ...run, runningChallengeId: challenge.id };
          save(run);
          const item = await runChallenge(run.claim, challenge);
          run = { ...run, evidence: { ...run.evidence, [challenge.id]: item } };
          save(run);
        }
        run = { ...run, runningChallengeId: undefined };

        await conclude(run);
      })().finally(() => setBusyFlag(id, false));

      return id;
    },
    [conclude, save, setBusyFlag],
  );

  const finalizeRun = useCallback(
    (id: string) => {
      const run = runsRef.current.find((r) => r.claim.id === id);
      if (!run || run.status === "completed" || busy.has(id)) return;
      setBusyFlag(id, true);
      conclude(run).finally(() => setBusyFlag(id, false));
    },
    [busy, conclude, setBusyFlag],
  );

  const value = useMemo<VerificationStore>(
    () => ({
      runs,
      getRun: (id) => runs.find((r) => r.claim.id === id),
      submitClaim,
      finalizeRun,
      isBusy: (id) => busy.has(id),
    }),
    [runs, submitClaim, finalizeRun, busy],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useVerificationStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useVerificationStore must be used inside VerificationStoreProvider");
  return store;
}
