import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import { useTheme } from "../../context/ThemeContext";

export default function DashboardLayout() {
  const { themeName } = useTheme();

  return (
    <div
      className={`theme-${themeName} min-h-screen w-full flex overflow-hidden transition-colors duration-300`}
      style={{ background: "var(--bg)", color: "var(--text-primary)" }}
    >
      <Sidebar />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="shrink-0">
          <TopNav />
        </header>

        <main
          className="flex-1 overflow-y-auto px-8 py-6"
          style={{ background: "var(--bg)" }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
