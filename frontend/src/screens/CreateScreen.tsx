import { useEffect, useMemo, useState } from "react";
import { getAddress, isAddress } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Link } from "react-router-dom";
import { DEMO_CAPSULE_NAME, DEMO_MESSAGES, DEMO_THRESHOLD, useDemo } from "../demo/DemoContext";
import { encryptUint64Input } from "../lib/cofhe";
import { TIME_CAPSULE_ADDRESS, timeCapsuleAbi } from "../lib/contracts";
import { errorTextBlob, extractErrorSelector, logTransactionError } from "../lib/logTxError";

function toUnix(dateString: string) {
  return BigInt(Math.floor(new Date(dateString).getTime() / 1000));
}

function memberInitials(addr: string) {
  return addr.slice(2, 4).toUpperCase();
}

function formatDatetimeLocal(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const { active } = useDemo();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [step, setStep] = useState(1);
  const [capsuleName, setCapsuleName] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(1);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sealStampPlay, setSealStampPlay] = useState(false);
  const [didSealSucceed, setDidSealSucceed] = useState(false);
  const [status, setStatus] = useState("");
  const [cooldownLeft, setCooldownLeft] = useState(0);

  const trimmedName = capsuleName.trim();
  const trimmedMessage = message.trim();
  const unlockDateUnix = unlockDate ? Math.floor(new Date(unlockDate).getTime() / 1000) : NaN;
  const isStep1Valid = Boolean(trimmedName) && Number.isFinite(unlockDateUnix) && unlockDateUnix > 0;
  const isStep2Valid =
    members.length > 0 && Number.isInteger(threshold) && threshold >= 1 && threshold <= members.length;
  const isStep3Valid = Boolean(trimmedMessage);
  const isStep4Valid = isStep1Valid && isStep2Valid && isStep3Valid;

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  useEffect(() => {
    if (!active) return;
    const addr =
      address && isAddress(address)
        ? getAddress(address)
        : ("0x742d35Cc6634C0532925a3b844Bc454e4438f44e" as const);
    const unlock = new Date(Date.now() - 60_000);
    setCapsuleName(DEMO_CAPSULE_NAME);
    setUnlockDate(formatDatetimeLocal(unlock));
    setMembers([addr, addr, addr]);
    setThreshold(DEMO_THRESHOLD);
    setMessage(DEMO_MESSAGES[0]);
  }, [active, address]);

  const messageAsUint64 = useMemo(() => {
    const encoded = new TextEncoder().encode(message);
    let value = 0n;
    for (let i = 0; i < Math.min(encoded.length, 8); i++) {
      value = (value << 8n) + BigInt(encoded[i]);
    }
    return value;
  }, [message]);

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
    if (active) {
      setStatus("demo mode is preview-only — no on-chain transactions. use exit demo in the nav for the real flow.");
      return;
    }
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
      const encryptedMsg = await encryptUint64Input(messageAsUint64, publicClient, walletClient);

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
      const submitHash = await walletClient.writeContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "submitMessage",
        args: [nextId, encryptedMsg],
        account: address,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: submitHash });

      localStorage.setItem(`capsule:${nextId}:members`, JSON.stringify(members));
      setStatus(`all set — capsule #${nextId.toString()}. tell your friends the id ♡`);
      setDidSealSucceed(true);
    } catch (error: unknown) {
      logTransactionError(`CreateScreen (${phase})`, error);
      const blob = errorTextBlob(error);
      const selector = extractErrorSelector(error);
      const msg = String(
        (error as { shortMessage?: string })?.shortMessage ||
          (error as { message?: string })?.message ||
          "something went wrong."
      );
      const looksRateLimited =
        phase === "submitMessage" &&
        (blob.includes("rate limit") ||
          blob.includes("rate limited") ||
          blob.includes("too many requests") ||
          blob.includes("429"));
      if (looksRateLimited) {
        setCooldownLeft(60);
        const selectorHint = selector ? ` selector: ${selector}.` : "";
        setStatus(
          `the network asked for a breather during submitMessage. wait 60s and try again.${selectorHint} check console for full cause/data and run npx cofhe-errors <selector>.`
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

  if (didSealSucceed) {
    return (
      <section className="flow-panel seal-success">
        <div className="seal-envelope-stack seal-envelope-stack--success">
          <img src="/envelope.png" alt="" className="seal-envelope-stack__envelope" />
          <img src="/seal.png" alt="wax seal" className="seal-envelope-stack__seal" />
        </div>
        <h1 className="seal-success__title">sealed. ✦</h1>
        <p className="seal-success__text">your secrets are safe until it&apos;s time.</p>
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
      <SealedEnvelopeIllustration />
      <div className="paper-card">
        <p className="page-counter">{step} / 4</p>

        {active && (
          <div className="demo-banner">
            you&apos;re in <strong>demo mode</strong> — this form is prefilled for preview only.{" "}
            <Link to="/unlock">open the demo capsule</Link>
          </div>
        )}

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
            <h2 className="h-display">your turn.</h2>
            <p className="note-above">your friends won&apos;t see this until you all open it together.</p>
            <div className="diary-paper">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="dear future us…"
              />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="h-display">ready to seal it?</h2>
            <ul className="summary-list">
              <li>
                <strong>name:</strong> {trimmedName || "—"}
              </li>
              <li>
                <strong>opens:</strong> {unlockDate || "—"}
              </li>
              <li>
                <strong>friends:</strong> {members.length}
              </li>
              <li>
                <strong>threshold:</strong> {threshold}
              </li>
            </ul>
            <div className="seal-envelope-stack">
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
              className="btn-seal"
              disabled={isSubmitting || cooldownLeft > 0}
              onClick={handleSealClick}
            >
              {isSubmitting ? "sealing…" : "seal the capsule"}
            </button>
            <p className="seal-hint">once sealed, nobody can read these until it&apos;s time.</p>
            {cooldownLeft > 0 && <p className="seal-hint">retry in {cooldownLeft}s.</p>}
            {!isStep4Valid && <p className="seal-hint">go back if anything is missing.</p>}
          </>
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
