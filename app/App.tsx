import { BrowserRouter, Routes, Route } from "react-router";
import { Titlebar } from "~/components/layout/Titlebar";
import { Sidebar } from "~/components/layout/Sidebar";
import { InterceptModal } from "~/components/intercept/InterceptModal";
import { useStore } from "~/store/index";
import Index from "~/routes/_index";
import Replay from "~/routes/replay";
import Rules from "~/routes/rules";
import Stats from "~/routes/stats";
import Settings from "~/routes/settings";
import Setup from "~/routes/setup";
import Cert from "~/routes/cert";

function LiveInterceptOverlay() {
  const intercept = useStore(s => s.intercept);
  const closeIntercept = useStore(s => s.closeIntercept);
  if (!intercept.packet) return null;
  return <InterceptModal packet={intercept.packet} onClose={closeIntercept} isLive />;
}

export function App() {
  return (
    <BrowserRouter>
      <div className="app-window">
        <Titlebar />
        <div className="main-layout">
          <Sidebar />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/replay" element={<Replay />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/cert" element={<Cert />} />
          </Routes>
        </div>
      </div>
      <LiveInterceptOverlay />
    </BrowserRouter>
  );
}
