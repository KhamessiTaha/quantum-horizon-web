import { Route, Routes, useSearchParams } from "react-router-dom";
import Header from "./components/Header.tsx";
import Explore from "./pages/Explore.tsx";
import Landing from "./pages/Landing.tsx";
import Methods from "./pages/Methods.tsx";
import Viewer from "./pages/Viewer.tsx";

export default function App() {
  const [params] = useSearchParams();
  const embedded = params.get("embed") === "1";

  return (
    <>
      {embedded ? null : <Header />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/view" element={<Viewer />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/methods" element={<Methods />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </>
  );
}
