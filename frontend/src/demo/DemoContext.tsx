import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import { getAddress, isAddress } from "viem";

export const DEMO_CAPSULE_NAME = "squad predictions 2024 ✦";

export const DEMO_MESSAGES = [
  "i think we'll all be living in different cities by next year 🌍",
  "one of us is definitely going to fall in love this year. not saying who 👀",
  "i bet we're all still in this group chat in 10 years ♡",
] as const;

export const DEMO_THRESHOLD = 2;

function demoMemberAddress(wallet: string | undefined): `0x${string}` {
  if (wallet && isAddress(wallet)) {
    return getAddress(wallet);
  }
  return "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
}

export type DemoBusy = null | "sign" | "open";

type DemoState = {
  memberAddress: `0x${string}`;
  signedSlots: [boolean, boolean, boolean];
  revealed: boolean;
  busy: DemoBusy;
  busySlot: number | null;
  revealEpoch: number;
};

const freshDemoState = (addr: `0x${string}`): DemoState => ({
  memberAddress: addr,
  signedSlots: [false, false, false],
  revealed: false,
  busy: null,
  busySlot: null,
  revealEpoch: 0,
});

type DemoContextValue = {
  active: boolean;
  startDemo: (walletAddress: string | undefined) => void;
  exitDemo: () => void;
  state: DemoState;
  unlockUnix: number;
  signSlot: (index: number) => void;
  openTogether: () => void;
  capsuleName: string;
  messages: readonly [string, string, string];
  threshold: number;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const demoGen = useRef(0);
  const bumpDemoGen = useCallback(() => {
    demoGen.current += 1;
  }, []);

  const [active, setActive] = useState(false);
  const [unlockUnix, setUnlockUnix] = useState(() => Math.floor(Date.now() / 1000) - 60);
  const [state, setState] = useState<DemoState>(() => freshDemoState(demoMemberAddress(undefined)));

  useEffect(() => {
    if (!active) return;
    const normalized = demoMemberAddress(address);
    setState((s) => ({ ...s, memberAddress: normalized }));
  }, [active, address]);

  const startDemo = useCallback(
    (addr: string | undefined) => {
      bumpDemoGen();
      setUnlockUnix(Math.floor(Date.now() / 1000) - 60);
      setState(freshDemoState(demoMemberAddress(addr)));
      setActive(true);
    },
    [bumpDemoGen]
  );

  const exitDemo = useCallback(() => {
    bumpDemoGen();
    setActive(false);
    setState(freshDemoState(demoMemberAddress(undefined)));
  }, [bumpDemoGen]);

  const signSlot = useCallback(
    (index: number) => {
      if (!active || index < 0 || index > 2) return;
      const gen = demoGen.current;
      setState((s) => {
        if (s.revealed || s.busy !== null || s.signedSlots[index]) return s;
        return { ...s, busy: "sign", busySlot: index };
      });
      window.setTimeout(() => {
        if (gen !== demoGen.current) return;
        setState((s) => {
          if (s.busy !== "sign" || s.busySlot !== index) return s;
          const next = [...s.signedSlots] as [boolean, boolean, boolean];
          next[index] = true;
          return { ...s, signedSlots: next, busy: null, busySlot: null };
        });
      }, 1200 + Math.random() * 600);
    },
    [active]
  );

  const openTogether = useCallback(() => {
    if (!active) return;
    const now = Math.floor(Date.now() / 1000);
    if (now < unlockUnix) return;
    setState((s) => {
      const sigCount = s.signedSlots.filter(Boolean).length;
      if (sigCount < DEMO_THRESHOLD || s.revealed || s.busy !== null) return s;
      return { ...s, busy: "open" };
    });
  }, [active, unlockUnix]);

  useEffect(() => {
    if (!active || state.busy !== "open") return;
    const gen = demoGen.current;
    const delay = 1600 + Math.random() * 500;
    const t = window.setTimeout(() => {
      if (gen !== demoGen.current) return;
      setState((s) => ({
        ...s,
        revealed: true,
        busy: null,
        revealEpoch: s.revealEpoch + 1,
      }));
    }, delay);
    return () => window.clearTimeout(t);
  }, [active, state.busy]);

  const value = useMemo<DemoContextValue>(
    () => ({
      active,
      startDemo,
      exitDemo,
      state,
      unlockUnix,
      signSlot,
      openTogether,
      capsuleName: DEMO_CAPSULE_NAME,
      messages: DEMO_MESSAGES,
      threshold: DEMO_THRESHOLD,
    }),
    [active, startDemo, exitDemo, state, unlockUnix, signSlot, openTogether]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
