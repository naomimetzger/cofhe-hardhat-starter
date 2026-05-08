import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { decryptCiphertextForTx } from "../lib/cofhe";
import { TIME_CAPSULE_ADDRESS, timeCapsuleAbi } from "../lib/contracts";
import { decodeUint64Message } from "../lib/messageCodec";
import { useDemo } from "../demo/DemoContext";

type CapsuleView = {
  name: string;
  threshold: number;
  unlockDate: bigint;
  unlocked: boolean;
  signatures: number;
};

function shortenAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function memberInitials(addr: string) {
  return addr.slice(2, 4).toUpperCase();
}

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

function UnlockDemoPanel() {
  const { state, unlockUnix, signSlot, openTogether, capsuleName, messages, threshold } = useDemo();

  const sigCount = state.signedSlots.filter(Boolean).length;
  const thresholdMet = sigCount >= threshold;
  const unlockTimePassed = Math.floor(Date.now() / 1000) >= unlockUnix;

  const canOpenTogether =
    thresholdMet && unlockTimePassed && !state.revealed && state.busy !== "open" && state.busy !== "sign";

  return (
    <section className="flow-panel">
      <h1 className="unlock-heading">time to open it 📖</h1>
      <p className="body-text body-text--muted" style={{ marginBottom: "1.25rem" }}>
        everyone who signed gets to read everything at once
      </p>

      <p className="body-text body-text--muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
        demo ✦ pretend capsule — same address on all three chips so you can &quot;sign&quot; as each slot
      </p>

      <div className="paper-card paper-card--gold-border">
        <p className="h-display" style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>
          {capsuleName}
        </p>
        <p className="body-text body-text--muted" style={{ fontSize: "0.85rem" }}>
          opens {new Date(unlockUnix * 1000).toLocaleString()} (demo: already passed)
        </p>

        <p className="body-text" style={{ margin: "1rem 0 0.35rem", fontSize: "0.95rem" }}>
          {sigCount} of {threshold} friends have shown up
        </p>
        <div className="hearts-progress" aria-hidden>
          {Array.from({ length: threshold }, (_, i) => (
            <span key={i} className={`heart ${i < sigCount ? "heart--filled" : ""}`}>
              ♡
            </span>
          ))}
        </div>

        {!thresholdMet && (
          <p className="waiting-msg">
            waiting for the group… once {threshold} of you sign, everything unlocks at once
          </p>
        )}

        <div style={{ marginTop: "1rem" }}>
          <p className="field-label" style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            the crew
          </p>
          <div className="member-row-create" style={{ gap: "0.45rem", alignItems: "stretch" }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`member-tag ${state.signedSlots[i] ? "member-tag--signed" : ""}`}
                style={{ ["--tag-tilt" as string]: `${(i % 3) - 1}deg` }}
              >
                <span className="avatar-chip" style={{ width: 28, height: 28, fontSize: "0.65rem" }}>
                  {memberInitials(state.memberAddress)}
                </span>
                {shortenAddress(state.memberAddress)}
                <span style={{ marginLeft: "0.25rem" }}>{state.signedSlots[i] ? "✓" : ""}</span>
                {!state.signedSlots[i] && (
                  <button
                    type="button"
                    className="chip-sign-btn"
                    disabled={state.busy !== null}
                    onClick={() => signSlot(i)}
                  >
                    {state.busy === "sign" && state.busySlot === i ? "…" : "sign"}
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="btn-open-together"
          disabled={!canOpenTogether}
          onClick={openTogether}
        >
          {state.busy === "open" ? "opening…" : "open together"}
        </button>
      </div>

      {state.revealed && (
        <div className="reveal-stack" key={state.revealEpoch}>
          {messages.map((msg, idx) => (
            <article
              key={`demo-${state.revealEpoch}-${idx}`}
              className="diary-page-card"
              style={{ ["--page-rot" as string]: `${((idx % 3) - 1) * 0.4}deg` }}
            >
              <p className="page-sender">{shortenAddress(state.memberAddress)} · voice {idx + 1}</p>
              <p className="page-message">{msg}</p>
              <p className="page-deco">✦</p>
            </article>
          ))}
        </div>
      )}

      {state.revealed && (
        <p className="reveal-closing">
          that&apos;s everyone ♡ — {capsuleName} — opened {new Date().toLocaleDateString()}
        </p>
      )}

      <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <Link
          to="/"
          className="body-text body-text--muted"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}
        >
          ← home
        </Link>
      </p>
    </section>
  );
}

function UnlockLivePanel() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [capsuleIdInput, setCapsuleIdInput] = useState("");
  const [capsuleId, setCapsuleId] = useState<bigint | null>(null);
  const [capsule, setCapsule] = useState<CapsuleView | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [signedMap, setSignedMap] = useState<Record<string, boolean>>({});
  const [submittedMap, setSubmittedMap] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [isOpening, setIsOpening] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);

  const progressHearts = useMemo(() => {
    if (!capsule) return { filled: 0, total: 1 };
    return { filled: Math.min(capsule.signatures, capsule.threshold), total: capsule.threshold };
  }, [capsule]);

  const unlockTimePassed = useMemo(() => {
    if (!capsule) return false;
    return Math.floor(Date.now() / 1000) >= Number(capsule.unlockDate);
  }, [capsule]);

  const canOpenTogether =
    capsule &&
    members.length > 0 &&
    capsule.unlocked &&
    unlockTimePassed &&
    members.some((m) => submittedMap[m]);

  const refreshMemberFlags = useCallback(
    async (id: bigint, memberList: string[]) => {
      if (!publicClient || memberList.length === 0) {
        setSignedMap({});
        setSubmittedMap({});
        return;
      }
      const signed: Record<string, boolean> = {};
      const submitted: Record<string, boolean> = {};
      await Promise.all(
        memberList.map(async (m) => {
          const [s, h] = await Promise.all([
            publicClient.readContract({
              address: TIME_CAPSULE_ADDRESS,
              abi: timeCapsuleAbi,
              functionName: "signedUnlock",
              args: [id, m as `0x${string}`],
            }) as Promise<boolean>,
            publicClient.readContract({
              address: TIME_CAPSULE_ADDRESS,
              abi: timeCapsuleAbi,
              functionName: "hasSubmittedMessage",
              args: [id, m as `0x${string}`],
            }) as Promise<boolean>,
          ]);
          signed[m] = s;
          submitted[m] = h;
        })
      );
      setSignedMap(signed);
      setSubmittedMap(submitted);
    },
    [publicClient]
  );

  useEffect(() => {
    if (capsuleId === null || members.length === 0) return;
    void refreshMemberFlags(capsuleId, members);
  }, [capsuleId, members, capsule?.signatures, refreshMemberFlags]);

  async function loadCapsule(clearRevealed = true) {
    if (!publicClient) return;
    setStatus("");
    if (clearRevealed) {
      setRevealed({});
      setRevealEpoch((e) => e + 1);
    }
    try {
      const id = BigInt(capsuleIdInput);
      const data = (await publicClient.readContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "capsules",
        args: [id],
      })) as [string, number, bigint, boolean, number];

      const cachedMembers = JSON.parse(localStorage.getItem(`capsule:${id}:members`) || "[]") as string[];
      setMembers(cachedMembers);
      setCapsuleId(id);
      setCapsule({
        name: data[0],
        threshold: Number(data[1]),
        unlockDate: BigInt(data[2]),
        unlocked: Boolean(data[3]),
        signatures: Number(data[4]),
      });
      await refreshMemberFlags(id, cachedMembers);
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "couldn't find that capsule.");
    }
  }

  async function refreshCapsuleFromChain(memberList: string[]) {
    if (!publicClient || capsuleId === null) return;
    const data = (await publicClient.readContract({
      address: TIME_CAPSULE_ADDRESS,
      abi: timeCapsuleAbi,
      functionName: "capsules",
      args: [capsuleId],
    })) as [string, number, bigint, boolean, number];
    setCapsule({
      name: data[0],
      threshold: Number(data[1]),
      unlockDate: BigInt(data[2]),
      unlocked: Boolean(data[3]),
      signatures: Number(data[4]),
    });
    await refreshMemberFlags(capsuleId, memberList);
  }

  async function signUnlock() {
    if (!walletClient || !publicClient || !address || capsuleId === null) return;
    setStatus("signing for the group…");
    try {
      const hash = await walletClient.writeContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "signUnlock",
        args: [capsuleId],
        account: address,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshCapsuleFromChain(members);
      setStatus("you showed up ♡");
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "signing didn't work.");
    }
  }

  const revealForMember = useCallback(
    async (member: string) => {
      if (!walletClient || !publicClient || !address || capsuleId === null) return;
      const ciphertext = (await publicClient.readContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "encryptedMessages",
        args: [capsuleId, member as `0x${string}`],
      })) as `0x${string}`;

      if (!ciphertext || ciphertext === ZERO_HASH) return;

      const result = await decryptCiphertextForTx(ciphertext, publicClient, walletClient);
      const revealHash = await walletClient.writeContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "revealMessage",
        args: [capsuleId, member as `0x${string}`, BigInt(result.decryptedValue), result.signature],
        account: address,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: revealHash });

      const plain = (await publicClient.readContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "getRevealedMessage",
        args: [capsuleId, member as `0x${string}`],
      })) as bigint;

      return plain.toString();
    },
    [walletClient, publicClient, address, capsuleId]
  );

  async function openTogether() {
    if (!canOpenTogether || !walletClient || !publicClient || !address || capsuleId === null || !capsule) {
      return;
    }
    setIsOpening(true);
    setStatus("opening it together…");
    const next: Record<string, string> = {};
    try {
      for (const m of members) {
        if (!submittedMap[m]) continue;
        try {
          const s = await revealForMember(m);
          if (s !== undefined) next[m] = s;
        } catch {
          const plain = (await publicClient.readContract({
            address: TIME_CAPSULE_ADDRESS,
            abi: timeCapsuleAbi,
            functionName: "getRevealedMessage",
            args: [capsuleId, m as `0x${string}`],
          })) as bigint;
          if (plain > 0n) next[m] = plain.toString();
        }
      }
      setRevealed((prev) => ({ ...prev, ...next }));
      setRevealEpoch((e) => e + 1);
      setStatus("");
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "opening together failed.");
    } finally {
      setIsOpening(false);
    }
  }

  const revealedMembers = useMemo(() => {
    return members.filter((m) => submittedMap[m] && revealed[m] !== undefined);
  }, [members, submittedMap, revealed]);

  const allRevealed =
    members.length > 0 &&
    members.filter((m) => submittedMap[m]).length > 0 &&
    members.filter((m) => submittedMap[m]).every((m) => revealed[m] !== undefined);

  return (
    <section className="flow-panel">
      <h1 className="unlock-heading">time to open it 📖</h1>
      <p className="body-text body-text--muted" style={{ marginBottom: "1.25rem" }}>
        everyone who signed gets to read everything at once
      </p>

      <div className="paper-card" style={{ marginBottom: "1rem" }}>
        <label className="field-label">capsule id</label>
        <div className="member-row-create">
          <input
            className="diary-line-input"
            style={{ flex: 1 }}
            placeholder="number"
            value={capsuleIdInput}
            onChange={(e) => setCapsuleIdInput(e.target.value)}
          />
          <button type="button" className="btn-pill btn-pill--primary" onClick={() => void loadCapsule()}>
            find it
          </button>
        </div>
      </div>

      {capsule && (
        <>
          <div className="paper-card paper-card--gold-border">
            <p className="h-display" style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>
              {capsule.name || `capsule #${capsuleId?.toString()}`}
            </p>
            <p className="body-text body-text--muted" style={{ fontSize: "0.85rem" }}>
              opens {new Date(Number(capsule.unlockDate) * 1000).toLocaleString()}
            </p>

            <p className="body-text" style={{ margin: "1rem 0 0.35rem", fontSize: "0.95rem" }}>
              {capsule.signatures} of {capsule.threshold} friends have shown up
            </p>
            <div className="hearts-progress" aria-hidden>
              {Array.from({ length: capsule.threshold }, (_, i) => (
                <span key={i} className={`heart ${i < progressHearts.filled ? "heart--filled" : ""}`}>
                  ♡
                </span>
              ))}
            </div>

            {!capsule.unlocked && (
              <p className="waiting-msg">
                waiting for the group… once {capsule.threshold} of you sign, everything unlocks at once
              </p>
            )}

            {members.length > 0 ? (
              <div style={{ marginTop: "1rem" }}>
                <p className="field-label" style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
                  the crew
                </p>
                <div className="member-row-create" style={{ gap: "0.45rem" }}>
                  {members.map((m, i) => (
                    <span
                      key={m}
                      className={`member-tag ${signedMap[m] ? "member-tag--signed" : ""}`}
                      style={{ ["--tag-tilt" as string]: `${(i % 3) - 1}deg` }}
                    >
                      <span className="avatar-chip" style={{ width: 28, height: 28, fontSize: "0.65rem" }}>
                        {memberInitials(m)}
                      </span>
                      {shortenAddress(m)}
                      {signedMap[m] ? " ✓" : ""}
                    </span>
                  ))}
                </div>
                {address &&
                  (() => {
                    const self = members.find((m) => m.toLowerCase() === address.toLowerCase());
                    if (!self) return null;
                    return (
                      <button
                        type="button"
                        className="btn-pill btn-pill--ghost"
                        style={{ marginTop: "0.85rem" }}
                        onClick={() => void signUnlock()}
                        disabled={!unlockTimePassed || Boolean(signedMap[self])}
                      >
                        {signedMap[self] ? "you're here ✓" : "i'm here — sign"}
                      </button>
                    );
                  })()}
              </div>
            ) : (
              <p className="body-text--muted" style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
                we don&apos;t have the friend list saved in this browser — if you created it here, try the same
                device; otherwise you can still open together if you know who wrote.
              </p>
            )}

            <button
              type="button"
              className="btn-open-together"
              disabled={!canOpenTogether || isOpening}
              onClick={() => void openTogether()}
            >
              {isOpening ? "opening…" : "open together"}
            </button>
          </div>

          {revealedMembers.length > 0 && (
            <div className="reveal-stack" key={revealEpoch}>
              {revealedMembers.map((m, idx) => (
                <article
                  key={`${m}-${revealEpoch}`}
                  className="diary-page-card"
                  style={{ ["--page-rot" as string]: `${((idx % 3) - 1) * 0.4}deg` }}
                >
                  <p className="page-sender">{shortenAddress(m)}</p>
                  <p className="page-message">{decodeUint64Message(BigInt(revealed[m]))}</p>
                  <p className="page-deco">✦</p>
                </article>
              ))}
            </div>
          )}

          {allRevealed && capsule && (
            <p className="reveal-closing">
              that&apos;s everyone ♡ — {capsule.name || "our capsule"} — opened{" "}
              {new Date().toLocaleDateString()}
            </p>
          )}
        </>
      )}

      {status && <p className="status-msg">{status}</p>}

      <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <Link
          to="/"
          className="body-text body-text--muted"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}
        >
          ← home
        </Link>
      </p>
    </section>
  );
}

export function UnlockScreen() {
  const { active } = useDemo();
  if (active) {
    return <UnlockDemoPanel />;
  }
  return <UnlockLivePanel />;
}
