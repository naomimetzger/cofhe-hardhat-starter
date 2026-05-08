import { useNavigate } from "react-router-dom";

export function HomeScreen() {
  const navigate = useNavigate();

  return (
    <section className="hero">
      <p className="chip">Private by default on Base Sepolia</p>
      <h1>Store encrypted messages now, unlock together later.</h1>
      <p className="subtext">
        TimeCapsule lets groups encrypt messages with CoFHE, set a future unlock date, and reveal
        only when a member threshold signs.
      </p>
      <div className="hero-actions">
        <button className="btn btn-primary" onClick={() => navigate("/create")}>
          Create Capsule
        </button>
        <button className="btn btn-ghost" onClick={() => navigate("/unlock")}>
          Open Capsule
        </button>
      </div>
    </section>
  );
}
