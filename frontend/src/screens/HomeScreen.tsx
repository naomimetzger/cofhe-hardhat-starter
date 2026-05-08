import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useDemo } from "../demo/DemoContext";

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
      {/* TODO: add ripped-paper-top.png */}
      <section className="home-hero">
        <h1 className="h-hero">our little secret.</h1>
        <p className="body-text body-text--muted">
          write something true. lock it away. open it together when the time comes.
        </p>

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

        <p className="social-proof">for the group chats that deserve a time capsule ✦</p>
      </section>

      <div className="feature-grid">
        <div className="feature-card" style={{ ["--tilt" as string]: "-1deg" }}>
          <h3 className="feature-card__title">✦ encrypted</h3>
          <p>nobody can read your messages. not the app. not the blockchain.</p>
        </div>
        <div className="feature-card" style={{ ["--tilt" as string]: "0.5deg" }}>
          <h3 className="feature-card__title">✿ time-locked</h3>
          <p>sealed until the date you choose. no exceptions.</p>
        </div>
        <div className="feature-card" style={{ ["--tilt" as string]: "-0.4deg" }}>
          <h3 className="feature-card__title">♡ threshold unlock</h3>
          <p>you decide how many friends need to show up to open it.</p>
        </div>
      </div>

      {/* TODO: add diary-sticker.png */}
      <div className="diary-stage" aria-hidden>
        <div className="diary-book">
          <div className="diary-cover diary-cover--back" />
          <div className="diary-pages" />
          <div className="diary-cover diary-cover--front" />
        </div>
      </div>

      {/* TODO: add polaroid-frame.png */}

      <footer className="site-footer">
        made with ♡ by{" "}
        <a href="https://twitter.com/afrochicksnft" target="_blank" rel="noreferrer">
          @afrochicksnft
        </a>{" "}
        ✦ powered by fhenix cofhe
      </footer>
    </>
  );
}
