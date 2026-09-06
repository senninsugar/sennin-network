import React, { useEffect, useState } from "react";
import {
  getApps,
  installApp,
  uninstallApp
} from "../api";

export default function Store({
  user,
  installedApps,
  onRefresh,
  onOpenApp
}) {
  const [apps, setApps] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadApps(value = "") {
    setLoading(true);

    try {
      const result = await getApps(value);

      setApps(result.apps || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApps();
  }, []);

  function isInstalled(id) {
    return installedApps.some(
      app => app.id === id
    );
  }

  async function install(app) {
    if (!user) {
      setMessage(
        "アプリをインストールするにはログインしてください。"
      );
      return;
    }

    try {
      await installApp(app.id);

      setMessage(
        `${app.name} をインストールしました。`
      );

      await onRefresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function uninstall(app) {
    try {
      await uninstallApp(app.id);

      setMessage(
        `${app.name} をアンインストールしました。`
      );

      await onRefresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <div className="page-heading">
        <h1>App Store</h1>

        <p>
          Web OS用アプリケーションを探してインストールできます。
        </p>
      </div>

      <div className="store-toolbar">
        <input
          className="search-box"
          placeholder="アプリを検索..."
          value={search}
          onChange={event => {
            setSearch(event.target.value);
          }}
          onKeyDown={event => {
            if (event.key === "Enter") {
              loadApps(search);
            }
          }}
        />

        <button
          className="primary-button"
          onClick={() => loadApps(search)}
        >
          Search
        </button>
      </div>

      {message && (
        <div className="error-box">
          {message}
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          Loading Store...
        </div>
      ) : apps.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 45 }}>
            🔍
          </div>

          <h3>
            No apps found
          </h3>

          <p>
            まだ公開されているアプリがありません。
          </p>
        </div>
      ) : (
        <div className="app-grid">
          {apps.map(app => {
            const installed = isInstalled(app.id);

            return (
              <div
                key={app.id}
                className="app-card"
              >
                <div>
                  <div className="app-icon">
                    {app.icon || "🧩"}
                  </div>

                  <div className="app-name">
                    {app.name}
                  </div>

                  <div className="app-description">
                    {app.description}
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      color: "rgba(255,255,255,.45)",
                      fontSize: 12
                    }}
                  >
                    {Math.round(app.size / 1024)} KB
                    {" · "}
                    {app.installs || 0} installs
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 18
                  }}
                >
                  {installed ? (
                    <>
                      <button
                        className="primary-button"
                        onClick={() =>
                          onOpenApp(app)
                        }
                      >
                        Open
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() =>
                          uninstall(app)
                        }
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <button
                      className="primary-button"
                      onClick={() =>
                        install(app)
                      }
                    >
                      Install
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
