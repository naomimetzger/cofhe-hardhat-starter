import { useMemo, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { decryptCiphertextForTx } from "../lib/cofhe";
import { TIME_CAPSULE_ADDRESS, timeCapsuleAbi } from "../lib/contracts";

type CapsuleView = {
  name: string;
  threshold: number;
  unlockDate: bigint;
  unlocked: boolean;
  signatures: number;
};

export function UnlockScreen() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [capsuleIdInput, setCapsuleIdInput] = useState("");
  const [capsuleId, setCapsuleId] = useState<bigint | null>(null);
  const [capsule, setCapsule] = useState<CapsuleView | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const progress = useMemo(() => {
    if (!capsule || capsule.threshold === 0) return 0;
    return Math.min(100, Math.round((capsule.signatures / capsule.threshold) * 100));
  }, [capsule]);

  async function loadCapsule() {
    if (!publicClient) return;
    setStatus("");
    try {
      const id = BigInt(capsuleIdInput);
      const data = (await publicClient.readContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "capsules",
        args: [id],
      })) as [string, number, bigint, boolean, number];

      const cachedMembers = JSON.parse(localStorage.getItem(`capsule:${id}:members`) || "[]");
      setMembers(cachedMembers);
      setCapsuleId(id);
      setCapsule({
        name: data[0],
        threshold: Number(data[1]),
        unlockDate: BigInt(data[2]),
        unlocked: Boolean(data[3]),
        signatures: Number(data[4]),
      });
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Could not load capsule.");
    }
  }

  async function signUnlock() {
    if (!walletClient || !publicClient || !address || capsuleId === null) return;
    setStatus("Submitting unlock signature...");
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
      await loadCapsule();
      setStatus("Signed unlock successfully.");
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Unlock signature failed.");
    }
  }

  async function decryptAndReveal(member: string) {
    if (!walletClient || !publicClient || !address || capsuleId === null) return;
    setStatus(`Decrypting ${member} message...`);
    try {
      const ciphertext = (await publicClient.readContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: timeCapsuleAbi,
        functionName: "encryptedMessages",
        args: [capsuleId, member as `0x${string}`],
      })) as `0x${string}`;

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
      setRevealed((prev) => ({ ...prev, [member]: plain.toString() }));
      setStatus("Reveal completed.");
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Reveal failed.");
    }
  }

  return (
    <section className="panel">
      <h2>Unlock Capsule</h2>
      <div className="inline-row">
        <input
          placeholder="Capsule ID"
          value={capsuleIdInput}
          onChange={(e) => setCapsuleIdInput(e.target.value)}
        />
        <button className="btn btn-primary" onClick={loadCapsule}>
          Load
        </button>
      </div>

      {capsule && (
        <>
          <div className="card">
            <p>
              <strong>{capsule.name || `Capsule #${capsuleId}`}</strong>
            </p>
            <p>Threshold: {capsule.signatures} / {capsule.threshold}</p>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="hint">
              Unlock date: {new Date(Number(capsule.unlockDate) * 1000).toLocaleString()}
            </p>
          </div>

          {members.length > 0 ? (
            <div className="card">
              <h3>Members</h3>
              <ul className="list">
                {members.map((member) => (
                  <li key={member} className="member-row">
                    <span>{member}</span>
                    <button
                      className="btn btn-ghost"
                      onClick={signUnlock}
                      disabled={!address || address.toLowerCase() !== member.toLowerCase()}
                    >
                      Sign
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => decryptAndReveal(member)}
                      disabled={capsule.signatures < capsule.threshold}
                    >
                      Decrypt & Reveal
                    </button>
                    {revealed[member] && <span className="badge">Plaintext: {revealed[member]}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="hint">
              No member list found locally for this capsule. Create flow stores members in browser
              storage to render this list.
            </p>
          )}
        </>
      )}

      {status && <p className="status">{status}</p>}
    </section>
  );
}
