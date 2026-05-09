import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useDemo } from "../demo/DemoContext";

function HomeIllustration() {
  return (
    <div className="hero-illustration" aria-hidden>
      <svg viewBox="0 0 220 220" className="hero-illustration__svg">
        <rect x="52" y="96" width="116" height="92" rx="14" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M78 96V73c0-18 14-32 32-32s32 14 32 32v23" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M74 128h72v42H74z" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M74 128l36 24 36-24" fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    </div>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { startDemo } = useDemo();

  function tryDemo() {
    startDemo(address);
    navigate("/unlock");
  }

  return (
    <>
      <section className="home-hero">
        <p className="home-kicker">for the group chats that deserve more</p>
        <h1 className="h-hero">our little secret.</h1>
        <p className="body-text body-text--muted">write something true. seal it. open it together when it&apos;s time.</p>

        <HomeIllustration />

        <div className="home-actions">
          <button type="button" className="btn-pill btn-pill--primary" onClick={() => navigate("/create")}>
            start a capsule
          </button>
          <button type="button" className="btn-pill btn-pill--ghost" onClick={() => navigate("/unlock")}>
            open one
          </button>
        </div>

        <button type="button" className="btn-try-demo" onClick={tryDemo}>
          try the demo ✦
        </button>
      </section>

      <footer className="site-footer">
        made by{" "}
        <a href="https://twitter.com/afrochicksnft" target="_blank" rel="noreferrer">
          @afrochicksnft
        </a>{" "}
        · powered by fhenix
      </footer>
    </>
  );
}
