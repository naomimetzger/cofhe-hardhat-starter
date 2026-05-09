import { useNavigate } from "react-router-dom";

function HomeIllustration() {
  return (
    <div className="hero-illustration" aria-hidden>
      <img src="/envelogo.png" alt="" className="hero-illustration__img" />
    </div>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();

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
      </section>

      <footer className="site-footer">
        made by{" "}
        <a href="https://twitter.com/afrochicksnft" target="_blank" rel="noreferrer">
          @afrochicksnft
        </a>{" "}
        · built with Fhenix CoFHE
      </footer>
    </>
  );
}
