import React, { useEffect, useState } from "react";
import Home from "./components/Home";
import Store from "./components/Store";
import Studio from "./components/Studio";
import Account from "./components/Account";
import {
  getMe,
  getInstalledApps
} from "./api";

export default function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [installedApps, setInstalledApps] = useState([]);
  const [activeApp, setActiveApp] = useState(null);
  const [booting, setBooting] = useState(true);

  // Window State for Windows OS-like experience
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  async function loadAccount() {
    try {
      const result = await getMe();

      setUser(result.user);

      try {
        const installed = await getInstalledApps();

        setInstalledApps(
          installed.apps
            .map(item => item.apps)
            .filter(Boolean)
        );
      } catch {
        setInstalledApps([]);
      }
    } catch {
      setUser(null);
      setInstalledApps([]);
    }
  }

  useEffect(() => {
    loadAccount().finally(() => {
      setTimeout(() => {
        setBooting(false);
      }, 600);
    });
  }, []);

  function openApp(app) {
    setActiveApp(app);
    setIsMinimized(false);
  }

  function closeApp() {
    setActiveApp(null);
    setIsMaximized(false);
    setIsMinimized(false);
  }

  function navigate(nextPage) {
    setActiveApp(null);
    setPage(nextPage);
  }

  async function refreshApps() {
    if (!user) {
      setInstalledApps([]);
      return;
    }

    try {
      const result = await getInstalledApps();

      setInstalledApps(
        result.apps
          .map(item => item.apps)
          .filter(Boolean)
      );
    } catch {
      setInstalledApps([]);
    }
  }

  if (booting) {
    return (
      <div className="boot-screen">
        <div className="boot-logo">W</div>
        <div className="boot-title">WEB OS</div>
        <div className="boot-loader" />
      </div>
    );
  }

  return (
    <div className="os">
      <header className="top-bar">
        <button
          className="brand-button"
          onClick={() => navigate("home")}
        >
          WEB OS
        </button>

        <div className="top-status">
          <span>{user ? `@${user.username}` : "Guest"}</span>
          <span className="status-dot" />
          <span>
            {new Date().toLocaleTimeString(
              "ja-JP",
              {
                hour: "2-digit",
                minute: "2-digit"
              }
            )}
          </span>
        </div>
      </header>

      <main className="os-content">
        {page === "home" && (
          <Home
            user={user}
            installedApps={installedApps}
            onNavigate={navigate}
            onOpenApp={openApp}
            onRefresh={refreshApps}
          />
        )}

        {page === "store" && (
          <Store
            user={user}
            installedApps={installedApps}
            onRefresh={refreshApps}
            onOpenApp={openApp}
          />
        )}

        {page === "studio" && (
          <Studio
            user={user}
            onNavigate={navigate}
          />
        )}

        {page === "account" && (
          <Account
            user={user}
            onLogin={async () => {
              await loadAccount();
              navigate("home");
            }}
            onLogout={async () => {
              localStorage.removeItem("webos_token");
              setUser(null);
              setInstalledApps([]);
              navigate("home");
            }}
          />
        )}
      </main>

      <nav className="bottom-nav">
        <button
          className={page === "home" ? "active" : ""}
          onClick={() => navigate("home")}
        >
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button
          className={page === "store" ? "active" : ""}
          onClick={() => navigate("store")}
        >
          <span>▣</span>
          <small>Store</small>
        </button>

        <button
          className={page === "studio" ? "active" : ""}
          onClick={() => navigate("studio")}
        >
          <span>⌘</span>
          <small>Studio</small>
        </button>

        <button
          className={page === "account" ? "active" : ""}
          onClick={() => navigate("account")}
        >
          <span>◉</span>
          <small>Account</small>
        </button>

        {activeApp && (
          <button
            className={`active-app-taskbar-btn ${!isMinimized ? "running" : ""}`}
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <span>{activeApp.icon || "🧩"}</span>
            <small>{activeApp.name}</small>
          </button>
        )}
      </nav>

      {activeApp && (
        <div
          className={`app-window-layer ${isMinimized ? "minimized" : ""}`}
        >
          <div
            className={`app-window ${isMaximized ? "maximized" : ""}`}
          >
            <div className="app-window-header">
              <div className="app-window-title">
                <span>{activeApp.icon || "🧩"}</span>
                <span>{activeApp.name}</span>
              </div>

              <div className="window-controls">
                <button
                  className="window-control-btn minimize"
                  onClick={() => setIsMinimized(true)}
                  title="Minimize"
                >
                  &#8722;
                </button>
                <button
                  className="window-control-btn maximize"
                  onClick={() => setIsMaximized(!isMaximized)}
                  title={isMaximized ? "Restore" : "Maximize"}
                >
                  {isMaximized ? "\u2745" : "\u25A1"}
                </button>
                <button
                  className="window-close"
                  onClick={closeApp}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <iframe
              className="app-frame"
              title={activeApp.name}
              sandbox="allow-scripts"
              src={`/api/apps/${activeApp.id}/runtime`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
