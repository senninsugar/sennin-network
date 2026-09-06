import React from "react";

export default function Home({
  user,
  installedApps,
  onNavigate,
  onOpenApp
}) {
  return (
    <>
      <section className="hero">
        <div>
          <h1>
            {user
              ? `Welcome, ${user.username}`
              : "Welcome to Web OS"}
          </h1>

          <p>
            ブラウザ上で動作する次世代Web OS。
            アプリをインストールして、自分だけの環境を作れます。
          </p>

          <button
            className="primary-button"
            onClick={() => onNavigate("store")}
          >
            Open App Store
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Installed Apps</h2>

          <button
            className="secondary-button"
            onClick={() => onNavigate("store")}
          >
            Store
          </button>
        </div>

        {installedApps.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 45 }}>
              🧩
            </div>

            <h3>
              No applications installed
            </h3>

            <p>
              App Storeからアプリをインストールしてください。
            </p>

            <button
              className="primary-button"
              onClick={() => onNavigate("store")}
            >
              Browse Store
            </button>
          </div>
        ) : (
          <div className="app-grid">
            {installedApps.map(app => (
              <button
                key={app.id}
                className="app-card"
                onClick={() => onOpenApp(app)}
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
                </div>

                <div>
                  <small>
                    {app.version}
                  </small>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Quick Access</h2>
        </div>

        <div className="app-grid">
          <button
            className="app-card"
            onClick={() => onNavigate("store")}
          >
            <div>
              <div className="app-icon">
                🛍️
              </div>

              <div className="app-name">
                App Store
              </div>

              <div className="app-description">
                Web OS用アプリを探す。
              </div>
            </div>
          </button>

          <button
            className="app-card"
            onClick={() => onNavigate("studio")}
          >
            <div>
              <div className="app-icon">
                🛠️
              </div>

              <div className="app-name">
                Dev Studio
              </div>

              <div className="app-description">
                HTML、CSS、JavaScriptでアプリを作成。
              </div>
            </div>
          </button>

          <button
            className="app-card"
            onClick={() => onNavigate("account")}
          >
            <div>
              <div className="app-icon">
                👤
              </div>

              <div className="app-name">
                Account
              </div>

              <div className="app-description">
                アカウントを管理。
              </div>
            </div>
          </button>
        </div>
      </section>
    </>
  );
}
