import { ConnectButton } from "@rainbow-me/rainbowkit";
import { NavLink, Route, Routes } from "react-router-dom";
import { HomeScreen } from "./screens/HomeScreen";
import { CreateScreen } from "./screens/CreateScreen";
import { UnlockScreen } from "./screens/UnlockScreen";

export default function App() {
  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand">TimeCapsule</div>
        <nav className="nav-links">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/create">Create</NavLink>
          <NavLink to="/unlock">Unlock</NavLink>
        </nav>
        <ConnectButton />
      </header>

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
