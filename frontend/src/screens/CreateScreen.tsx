import { useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { encryptUint64Input } from "../lib/cofhe";
import { TIME_CAPSULE_ADDRESS, timeCapsuleAbi } from "../lib/contracts";

function toUnix(dateString: string) {
  return BigInt(Math.floor(new Date(dateString).getTime() / 1000));
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
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      setStatus("Enter a valid wallet address.");
      return;
    }
    if (members.includes(parsed)) {
      setStatus("Member already added.");
      return;
    }
    setMembers((prev) => [...prev, parsed]);
    setThreshold((prev) => Math.min(prev, members.length + 1));
    setMemberInput("");
    setStatus("");
  }

  async function createAndSubmit() {
    if (!walletClient || !publicClient || !address) {
      setStatus("Connect wallet first.");
      return;
    }
    if (cooldownLeft > 0) {
      setStatus(`Rate limit active. Please retry in ${cooldownLeft}s.`);
      return;
    }
    if (!isStep4Valid) {
      setStatus("Please complete all 4 steps with valid values.");
      return;
    }

    setIsSubmitting(true);
    setStatus("Encrypting message...");
    try {
      const encryptedMsg = await encryptUint64Input(messageAsUint64, publicClient, walletClient);

      setStatus("Creating capsule on-chain...");
      const nextId = (await publicClient.readContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "nextCapsuleId",
      })) as bigint;

      const createHash = await walletClient.writeContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "createCapsule",
        args: [trimmedName, members as `0x${string}`[], threshold, toUnix(unlockDate)],
        account: address,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: createHash });

      setStatus("Submitting encrypted message...");
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
      setStatus(`Capsule #${nextId.toString()} created and encrypted message submitted.`);
    } catch (error: any) {
      const message = String(error?.shortMessage || error?.message || "Transaction failed.");
      if (message.toLowerCase().includes("rate limited")) {
        setCooldownLeft(60);
        setStatus("Too many requests right now. Please wait 60 seconds, then try again.");
      } else {
        setStatus(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function canGoNext(currentStep: number) {
    if (currentStep === 1) return isStep1Valid;
    if (currentStep === 2) return isStep2Valid;
    if (currentStep === 3) return isStep3Valid;
    return false;
  }

  function nextStep() {
    if (!canGoNext(step)) {
      if (step === 1) setStatus("Enter capsule name and a valid unlock date.");
      if (step === 2) setStatus("Add at least one member and set a valid threshold.");
      if (step === 3) setStatus("Enter a message to encrypt.");
      return;
    }
    setStatus("");
    setStep((s) => Math.min(4, s + 1));
  }

  return (
    <section className="panel">
      <h2>Create Capsule</h2>
      <p className="subtext">4-step flow: details, members, encrypted message, and on-chain confirm.</p>

      <div className="steps">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`step ${n === step ? "active" : ""}`}>
            Step {n}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="form-grid">
          <label>
            Capsule Name
            <input value={capsuleName} onChange={(e) => setCapsuleName(e.target.value)} />
          </label>
          <label>
            Unlock Date
            <input
              type="datetime-local"
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
            />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="form-grid">
          <label>
            Add Member Address
            <div className="inline-row">
              <input value={memberInput} onChange={(e) => setMemberInput(e.target.value)} />
              <button className="btn btn-ghost" onClick={addMember}>
                Add
              </button>
            </div>
          </label>

          <div>
            <p>Members ({members.length})</p>
            <ul className="list">
              {members.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>

          <label>
            Threshold
            <div className="inline-row">
              <button
                className="btn btn-ghost"
                onClick={() => setThreshold((t) => Math.max(1, t - 1))}
              >
                -
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
                className="btn btn-ghost"
                onClick={() => setThreshold((t) => Math.min(Math.max(1, members.length), t + 1))}
              >
                +
              </button>
            </div>
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="form-grid">
          <label>
            Message
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your time capsule message..."
            />
          </label>
          <p className="hint">
            Message is compacted to 8 bytes for `euint64` and encrypted with `@cofhe/sdk` before
            submit.
          </p>
        </div>
      )}

      {step === 4 && (
        <div className="review">
          <p>
            <strong>Name:</strong> {capsuleName}
          </p>
          <p>
            <strong>Unlock:</strong> {unlockDate}
          </p>
          <p>
            <strong>Members:</strong> {members.length}
          </p>
          <p>
            <strong>Threshold:</strong> {threshold}
          </p>
          <button
            className="btn btn-primary"
            disabled={isSubmitting || cooldownLeft > 0}
            onClick={createAndSubmit}
          >
            {isSubmitting ? "Submitting..." : "Create Capsule"}
          </button>
          {cooldownLeft > 0 && (
            <p className="hint">Rate limited. You can retry in {cooldownLeft}s.</p>
          )}
          {!isStep4Valid && (
            <p className="hint">Please ensure all previous steps are complete and valid.</p>
          )}
        </div>
      )}

      <div className="footer-row">
        <button className="btn btn-ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>
          Back
        </button>
        <button
          className="btn btn-primary"
          disabled={step === 4}
          onClick={nextStep}
        >
          Next
        </button>
      </div>

      {status && <p className="status">{status}</p>}
    </section>
  );
}
