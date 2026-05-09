import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAddress } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Link } from "react-router-dom";
import { encryptUint64Input } from "../lib/cofhe";
import { TIME_CAPSULE_ADDRESS, timeCapsuleAbi } from "../lib/contracts";
import { errorLooksRateLimited, extractErrorSelector, logTransactionError } from "../lib/logTxError";

function toUnix(dateString: string) {
  return BigInt(Math.floor(new Date(dateString).getTime() / 1000));
}

function memberInitials(addr: string) {
  return addr.slice(2, 4).toUpperCase();
}

function formatUnlockDateLong(dateString: string) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function shortenWalletAddress(addr: string | undefined) {
  if (!addr) return "0x0000…0000";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function stripLeadingDear(phrase: string): string {
  return phrase.replace(/^\s*dear\s+/i, "").trim();
}

const SALUTATION_OPTIONS = ["future us,", "to my love,", "future self,", "birthday girl,", "the squad,"].map(
  stripLeadingDear
);

function SealedEnvelopeIllustration() {
  return (
    <div className="screen-illustration" aria-hidden>
      <svg viewBox="0 0 180 110" className="screen-illustration__svg">
        <rect x="18" y="22" width="144" height="76" rx="10" fill="none" stroke="currentColor" strokeWidth="2.3" />
        <path d="M18 33l72 43 72-43" fill="none" stroke="currentColor" strokeWidth="2.3" />
      </svg>
    </div>
  );
}

export function CreateScreen() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [step, setStep] = useState(1);
  const [capsuleName, setCapsuleName] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(1);
  const [letterBody, setLetterBody] = useState("");
  const [salutationIdx, setSalutationIdx] = useState(0);
  const [salutationOpaque, setSalutationOpaque] = useState(true);
  const [salutationLocked, setSalutationLocked] = useState(false);
  const [salutationEditing, setSalutationEditing] = useState(false);
  const [salutationCustom, setSalutationCustom] = useState("");
  const [salutationDraft, setSalutationDraft] = useState("");
  /** While editing with empty draft, encrypted preview still uses this suffix */
  const [salutationEditFallback, setSalutationEditFallback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sealStampPlay, setSealStampPlay] = useState(false);
  const [didSealSucceed, setDidSealSucceed] = useState(false);
  const [sealedCapsuleId, setSealedCapsuleId] = useState<string | null>(null);
  const [shareIdCopied, setShareIdCopied] = useState(false);
  const [status, setStatus] = useState("");
  const [cooldownLeft, setCooldownLeft] = useState(0);

  const trimmedName = capsuleName.trim();
  const salutationPhraseRaw = useMemo(() => {
    if (salutationEditing) return salutationDraft.trim() || salutationEditFallback;
    if (salutationLocked) return salutationCustom;
    return SALUTATION_OPTIONS[salutationIdx];
  }, [
    salutationEditing,
    salutationDraft,
    salutationEditFallback,
    salutationLocked,
    salutationCustom,
    salutationIdx,
  ]);

  const salutationPhrase = useMemo(() => stripLeadingDear(salutationPhraseRaw), [salutationPhraseRaw]);

  const composedMessage = useMemo(() => {
    const sign = shortenWalletAddress(address);
    return `Dear ${salutationPhrase}\n\n${letterBody}\n\nSincerely,\n${sign}`;
  }, [letterBody, address, salutationPhrase]);
  const unlockDateUnix = unlockDate ? Math.floor(new Date(unlockDate).getTime() / 1000) : NaN;
  const isStep1Valid = Boolean(trimmedName) && Number.isFinite(unlockDateUnix) && unlockDateUnix > 0;
  const isStep2Valid =
    members.length > 0 && Number.isInteger(threshold) && threshold >= 1 && threshold <= members.length;
  const isStep3Valid = letterBody.trim().length > 0;
  const isStep4Valid = isStep1Valid && isStep2Valid && isStep3Valid;

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  useEffect(() => {
    if (!shareIdCopied) return;
    const t = window.setTimeout(() => setShareIdCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [shareIdCopied]);

  const salutationCycleGen = useRef(0);
  const salutationLockedRef = useRef(false);
  const salutationEditingRef = useRef(false);
  const salutationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    salutationLockedRef.current = salutationLocked;
  }, [salutationLocked]);

  useEffect(() => {
    salutationEditingRef.current = salutationEditing;
  }, [salutationEditing]);

  const runSalutationAutoCycle = useCallback((token: number) => {
    window.setTimeout(() => {
      if (salutationCycleGen.current !== token) return;
      if (salutationLockedRef.current || salutationEditingRef.current) return;
      setSalutationOpaque(false);
      window.setTimeout(() => {
        if (salutationCycleGen.current !== token) return;
        if (salutationLockedRef.current || salutationEditingRef.current) return;
        setSalutationIdx((i) => (i + 1) % SALUTATION_OPTIONS.length);
        setSalutationOpaque(true);
        runSalutationAutoCycle(token);
      }, 400);
    }, 1500);
  }, []);

  useEffect(() => {
    if (step !== 3 || salutationLocked) return;
    const token = ++salutationCycleGen.current;
    setSalutationOpaque(true);
    runSalutationAutoCycle(token);
    return () => {
      salutationCycleGen.current += 1;
    };
  }, [step, salutationLocked, runSalutationAutoCycle]);

  useEffect(() => {
    if (!salutationEditing) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const el = salutationInputRef.current;
        if (!el) return;
        el.focus({ preventScroll: true });
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [salutationEditing]);

  function beginSalutationEdit(fromCustom: boolean) {
    salutationCycleGen.current += 1;
    salutationEditingRef.current = true;
    if (fromCustom) {
      const suffix = stripLeadingDear(salutationCustom);
      setSalutationEditFallback(suffix);
      setSalutationDraft(suffix);
    } else {
      setSalutationEditFallback(SALUTATION_OPTIONS[salutationIdx]);
      setSalutationDraft("");
    }
    setSalutationEditing(true);
  }

  function commitSalutationEdit() {
    const trimmed = salutationDraft.trim();
    const saved = stripLeadingDear(trimmed || salutationEditFallback || "future us,");
    const normalized = saved || "future us,";
    setSalutationCustom(normalized);
    setSalutationLocked(true);
    setSalutationEditing(false);
    salutationEditingRef.current = false;
    salutationLockedRef.current = true;
    salutationCycleGen.current += 1;
  }

  const messageAsUint64 = useMemo(() => {
    const encoded = new TextEncoder().encode(composedMessage);
    let value = 0n;
    for (let i = 0; i < Math.min(encoded.length, 8); i++) {
      value = (value << 8n) + BigInt(encoded[i]);
    }
    return value;
  }, [composedMessage]);

  function addMember() {
    const parsed = memberInput.trim();
    if (!isAddress(parsed)) {
      setStatus("enter a valid wallet address.");
      return;
    }
    if (members.includes(parsed)) {
      setStatus("already in the group.");
      return;
    }
    setMembers((prev) => [...prev, parsed]);
    setThreshold((prev) => Math.min(prev, members.length + 1));
    setMemberInput("");
    setStatus("");
  }

  async function createAndSubmit() {
    if (!walletClient || !publicClient || !address) {
      setStatus("connect your wallet first.");
      return;
    }
    if (cooldownLeft > 0) {
      setStatus(`slow down — try again in ${cooldownLeft}s.`);
      return;
    }
    if (!isStep4Valid) {
      setStatus("fill in every page first.");
      return;
    }

    setIsSubmitting(true);
    setStatus("sealing your words…");
    let phase: "encryptUint64Input" | "readNextCapsuleId" | "createCapsule" | "submitMessage" =
      "encryptUint64Input";
    try {
      const encryptedMsgRaw = await encryptUint64Input(messageAsUint64, publicClient, walletClient);
      const encryptedMsg = encryptedMsgRaw as typeof encryptedMsgRaw & { signature: `0x${string}` };

      phase = "readNextCapsuleId";
      setStatus("creating the capsule…");
      const nextId = (await publicClient.readContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "nextCapsuleId",
      })) as bigint;

      phase = "createCapsule";
      const createHash = await walletClient.writeContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "createCapsule",
        args: [trimmedName, members as `0x${string}`[], threshold, toUnix(unlockDate)],
        account: address,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: createHash });

      phase = "submitMessage";
      setStatus("tucking the message inside…");
      // CoFHE (Base Sepolia, etc.): `FHE.asEuint64` + verifier work needs more gas than many wallets
      // default to. Estimating on-chain avoids "exceeds max transaction gas limit" from an
      // undersized cap; headroom covers execution variance (see compatibility: cofhe-docs.fhenix.zone/.../compatibility).
      let submitGas: bigint;
      try {
        const estimated = await publicClient.estimateContractGas({
          account: address,
          address: TIME_CAPSULE_ADDRESS,
          abi: timeCapsuleAbi,
          functionName: "submitMessage",
          args: [nextId, encryptedMsg],
        });
        const bumped = (estimated * 3n) / 2n + 80_000n;
        const ceiling = 12_000_000n;
        submitGas = bumped > ceiling ? ceiling : bumped;
      } catch {
        submitGas = 3_000_000n;
      }

      const submitHash = await walletClient.writeContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "submitMessage",
        args: [nextId, encryptedMsg],
        account: address,
        chain: walletClient.chain,
        gas: submitGas,
      });
      await publicClient.waitForTransactionReceipt({ hash: submitHash });

      localStorage.setItem(`capsule:${nextId}:members`, JSON.stringify(members));
      setSealedCapsuleId(nextId.toString());
      setStatus(`all set — capsule #${nextId.toString()}. tell your friends the id ♡`);
      setDidSealSucceed(true);
    } catch (error: unknown) {
      logTransactionError(`CreateScreen (${phase})`, error);
      const selector = extractErrorSelector(error);
      const msg = String(
        (error as { shortMessage?: string })?.shortMessage ||
          (error as { message?: string })?.message ||
          "something went wrong."
      );
      if (errorLooksRateLimited(error)) {
        setCooldownLeft(60);
        const selectorHint = selector ? ` selector: ${selector}.` : "";
        setStatus(
          `the RPC endpoint is rate limiting requests (failed during ${phase}). wait 60s and try again, or switch to a less busy RPC in your wallet/network settings.${selectorHint} check console for full cause/data and run npx cofhe-errors <selector> if a revert selector is shown.`
        );
      } else {
        const selectorHint = selector ? ` selector: ${selector}.` : "";
        setStatus(
          `failed at ${phase}: ${msg}.${selectorHint} see console for error.cause and error.data.`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSealClick() {
    setSealStampPlay(true);
    void createAndSubmit();
  }

  async function copySealedCapsuleId() {
    if (!sealedCapsuleId) return;
    try {
      await navigator.clipboard.writeText(sealedCapsuleId);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = sealedCapsuleId;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    setShareIdCopied(true);
  }

  if (didSealSucceed) {
    return (
      <section className="flow-panel seal-success">
        <div className="seal-envelope-stack seal-envelope-stack--success">
          <img src="/envelope.png" alt="" className="seal-envelope-stack__envelope" />
          <img src="/seal.png" alt="wax seal" className="seal-envelope-stack__seal" />
        </div>
        <h1 className="seal-success__title">sealed. ✦</h1>
        <p className="seal-success__text">your secrets are safe until it&apos;s time.</p>
        {sealedCapsuleId && (
          <div className="seal-success-share">
            <p className="seal-success-share__label">share this with your group</p>
            <div className="seal-success-share__row">
              <button
                type="button"
                className="seal-success-id-box"
                onClick={() => void copySealedCapsuleId()}
              >
                <span className="seal-success-id-box__value">{sealedCapsuleId}</span>
              </button>
              <button
                type="button"
                className="seal-success-copy-btn"
                onClick={() => void copySealedCapsuleId()}
                aria-label="Copy capsule ID"
              >
                copy
              </button>
            </div>
            {shareIdCopied && (
              <p className="seal-success-share__copied" role="status">
                copied!
              </p>
            )}
            <p className="seal-success-share__hint">
              they&apos;ll need this ID to find the capsule on the unlock screen
            </p>
          </div>
        )}
        <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <Link to="/" className="body-text body-text--muted">
            ← home
          </Link>
        </p>
      </section>
    );
  }

  function canGoNext(currentStep: number) {
    if (currentStep === 1) return isStep1Valid;
    if (currentStep === 2) return isStep2Valid;
    if (currentStep === 3) return isStep3Valid;
    return false;
  }

  function nextStep() {
    if (!canGoNext(step)) {
      if (step === 1) setStatus("name this capsule and pick an unlock moment.");
      if (step === 2) setStatus("add at least one friend and set how many need to show up.");
      if (step === 3) setStatus("write something for the capsule.");
      return;
    }
    setStatus("");
    setStep((s) => Math.min(4, s + 1));
  }

  return (
    <section className="flow-panel">
      {step !== 4 && <SealedEnvelopeIllustration />}
      <div className="paper-card">
        <p className="page-counter">{step} / 4</p>

        {step === 1 && (
          <>
            <h2 className="h-display">what do we call this?</h2>
            <label className="field-label">name</label>
            <input
              className="diary-line-input"
              value={capsuleName}
              onChange={(e) => setCapsuleName(e.target.value)}
              placeholder="e.g. summer 2026 crew"
            />
            <label className="field-label" style={{ marginTop: "1.5rem" }}>
              unlock on
            </label>
            <input
              className="diary-line-input"
              type="datetime-local"
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
            />
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="h-display">who&apos;s in the group?</h2>
            <label className="field-label">add a wallet</label>
            <div className="member-row-create">
              <input
                className="diary-line-input"
                style={{ flex: 1, minWidth: "12rem" }}
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                placeholder="0x…"
              />
              <button type="button" className="btn-pill btn-pill--ghost" onClick={addMember}>
                add
              </button>
            </div>

            {members.length > 0 && (
              <div className="member-row-create" style={{ marginTop: "1.25rem" }}>
                {members.map((m) => (
                  <span key={m} className="avatar-chip" title={m}>
                    {memberInitials(m)}
                  </span>
                ))}
              </div>
            )}

            <div className="threshold-row">
              <span className="field-label" style={{ margin: 0 }}>
                how many need to show up?
              </span>
              <button type="button" onClick={() => setThreshold((t) => Math.max(1, t - 1))}>
                −
              </button>
              <input
                type="number"
                min={1}
                max={Math.max(1, members.length)}
                value={threshold}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  setThreshold(Math.max(1, Math.min(Math.max(1, members.length), Math.floor(next))));
                }}
              />
              <button
                type="button"
                onClick={() => setThreshold((t) => Math.min(Math.max(1, members.length), t + 1))}
              >
                +
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <label className="letter-step-label">WRITE THE CARD</label>
            <p className="letter-step-note body-text body-text--muted">
              your friends won&apos;t see this until you all open it together.
            </p>
            <div className="letter-card">
              <p className="letter-card__salutation">
                <strong className="letter-card__salutation-dear">Dear</strong>
                {salutationEditing ? (
                  <input
                    ref={salutationInputRef}
                    type="text"
                    className="letter-card__salutation-input"
                    value={salutationDraft}
                    onChange={(e) => setSalutationDraft(e.target.value)}
                    onBlur={() => commitSalutationEdit()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        salutationInputRef.current?.blur();
                      }
                    }}
                    placeholder="type a name..."
                    aria-label="Name or greeting after Dear"
                    autoComplete="off"
                    spellCheck={false}
                  />
                ) : salutationLocked ? (
                  <button
                    type="button"
                    className="letter-card__salutation-custom"
                    onClick={() => beginSalutationEdit(true)}
                    aria-label="Edit greeting"
                  >
                    {salutationCustom}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`letter-card__salutation-cycle${salutationOpaque ? "" : " letter-card__salutation-cycle--hidden"}`}
                    onClick={() => beginSalutationEdit(false)}
                    aria-label="Customize greeting"
                  >
                    {SALUTATION_OPTIONS[salutationIdx]}
                  </button>
                )}
              </p>
              <textarea
                className="letter-card__body"
                value={letterBody}
                onChange={(e) => setLetterBody(e.target.value)}
                aria-label="Your message to the group"
                autoComplete="off"
                spellCheck
              />
              <p className="letter-card__signoff">
                Sincerely,
                <br />
                {shortenWalletAddress(address)}
              </p>
            </div>
          </>
        )}

        {step === 4 && (
          <div className="seal-step">
            <h2 className="seal-step__capsule-name">{trimmedName || "—"}</h2>
            <div className="seal-step__details">
              <p className="seal-step__line">opens on {formatUnlockDateLong(unlockDate)}</p>
              <p className="seal-step__line">
                {members.length} {members.length === 1 ? "friend" : "friends"}
              </p>
              <p className="seal-step__line">
                {threshold} of you need to show up to open it
              </p>
            </div>
            <div className="seal-envelope-stack seal-step__envelope">
              <img src="/envelope.png" alt="" className="seal-envelope-stack__envelope" />
              <img
                src="/seal.png"
                alt="wax seal"
                className={`seal-envelope-stack__seal${sealStampPlay ? " seal-envelope-stack__seal--stamp" : ""}`}
                onAnimationEnd={() => setSealStampPlay(false)}
              />
            </div>
            <button
              type="button"
              className="btn-seal seal-step__seal-btn"
              disabled={isSubmitting || cooldownLeft > 0}
              onClick={handleSealClick}
            >
              {isSubmitting ? "sealing…" : "seal the capsule"}
            </button>
            <p className="seal-hint">once sealed, nobody can read these until it&apos;s time.</p>
            {cooldownLeft > 0 && <p className="seal-hint">retry in {cooldownLeft}s.</p>}
            {!isStep4Valid && <p className="seal-hint">go back if anything is missing.</p>}
          </div>
        )}

        <div className="flow-footer">
          <button
            type="button"
            className="btn-pill btn-pill--ghost"
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
          >
            back
          </button>
          <button type="button" className="btn-pill btn-pill--primary" disabled={step === 4} onClick={nextStep}>
            next
          </button>
        </div>

        {status && <p className="status-msg">{status}</p>}
      </div>

      <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <Link to="/" className="body-text body-text--muted">
          ← home
        </Link>
      </p>
    </section>
  );
}
