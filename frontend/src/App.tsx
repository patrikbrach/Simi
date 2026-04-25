import { BrowserRouter, Route, Routes } from "react-router-dom";
import Analytics from "./pages/Analytics";
import Home from "./pages/Home";
import MatchWizard from "./pages/MatchWizard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/match/name" element={<MatchWizard mode="name" />} />
        <Route path="/match/city" element={<MatchWizard mode="city" />} />
        <Route path="/match/id" element={<MatchWizard mode="id" />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </BrowserRouter>
  );
}
