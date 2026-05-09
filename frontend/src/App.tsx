import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link, Route, Routes } from "react-router-dom";
import { HomeScreen } from "./screens/HomeScreen";
import { CreateScreen } from "./screens/CreateScreen";
import { UnlockScreen } from "./screens/UnlockScreen";

function NavChrome() {
  return (
    <header className="top-nav">
      <Link to="/" className="brand-link">
        capsule
      </Link>
      <div className="top-nav__right">
        <div className="connect-rk">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <NavChrome />

      <main className="content">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/create" element={<CreateScreen />} />
          <Route path="/unlock" element={<UnlockScreen />} />
        </Routes>
      </main>
    </div>
  );
}
