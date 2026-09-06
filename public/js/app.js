import { api } from "./api.js";

const app = document.querySelector("#app");

let currentUser = null;
let currentView = "home";

let installed = JSON.parse(
  localStorage.getItem("sennin-installed-apps") || "[]"
);

let currentProject = null;
let currentFiles = [];
let currentFile = null;

const esc = (s = "") =>
  String(s).replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c])
  );

async function getCurrentUser() {
  try {
    const result = await api("/auth/me");

    currentUser = result.user;

    return currentUser;
  } catch {
    currentUser = null;

    return null;
  }
}

function nav(id, label) {
  return `
    <button
      data-view="${esc(id)}"
      class="${currentView === id ? "active" : ""}"
    >
      ${esc(label)}
    </button>
  `;
}

function layout(content) {
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          ◈ Sennin Network
        </div>

        <div class="nav">
          ${nav("home", "ホーム")}
          ${nav("store", "App Store")}
          ${nav("dev", "DevStudio")}
          ${nav("explorer", "エクスプローラー")}
          ${nav("overview", "概要")}
          ${nav("account", "アカウント")}
          ${nav("security", "セキュリティ")}
        </div>

        <div style="margin-top:20px">
          <button class="btn secondary" id="logout">
            ログアウト
          </button>
        </div>
      </aside>

      <main class="main">
        ${content}
      </main>
    </div>
  `;

  document
    .querySelectorAll("[data-view]")
    .forEach(button => {
      button.onclick = () => {
        render(button.dataset.view);
      };
    });

  const logout = document.querySelector("#logout");

  if (logout) {
    logout.onclick = async () => {
      try {
        await api("/auth/logout", {
          method: "POST"
        });
      } catch {}

      currentUser = null;

      renderAuth();
    };
  }
}

function renderAuth(message = "") {
  app.innerHTML = `
    <div class="auth">
      <div class="card">

        <h1>Sennin Network OS</h1>

        <p class="muted">
          Web上で動作するアプリプラットフォーム
        </p>

        ${
          message
            ? `
              <div class="notice">
                ${esc(message)}
              </div>
            `
            : ""
        }

        <div class="form">

          <label>
            ユーザー名
            <input
              id="username"
              type="text"
              autocomplete="username"
              maxlength="32"
              placeholder="username"
            >
          </label>

          <label>
            パスワード
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              maxlength="128"
              placeholder="8文字以上"
            >
          </label>

          <div class="row">

            <button class="btn" id="login">
              ログイン
            </button>

            <button class="btn secondary" id="signup">
              新規登録
            </button>

          </div>

          <div class="notice">
            メールアドレスは必要ありません。
            ユーザー名とパスワードだけで利用できます。
          </div>

        </div>

      </div>
    </div>
  `;

  document.querySelector("#login").onclick = () => {
    auth(false);
  };

  document.querySelector("#signup").onclick = () => {
    auth(true);
  };
}

async function auth(signup) {
  const username =
    document
      .querySelector("#username")
      .value
      .trim();

  const password =
    document
      .querySelector("#password")
      .value;

  if (!username) {
    renderAuth("ユーザー名を入力してください。");
    return;
  }

  if (password.length < 8) {
    renderAuth("パスワードは8文字以上にしてください。");
    return;
  }

  try {
    if (signup) {
      const result = await api(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            username,
            password
          })
        }
      );

      currentUser = result.user;

      render("home");

      return;
    }

    const result = await api(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          username,
          password
        })
      }
    );

    currentUser = result.user;

    render("home");
  } catch (error) {
    renderAuth(error.message);
  }
}

async function render(view = "home") {
  currentView = view;

  if (!currentUser) {
    const user = await getCurrentUser();

    if (!user) {
      renderAuth();

      return;
    }
  }

  if (view === "home") {
    return home();
  }

  if (view === "store") {
    return store();
  }

  if (view === "dev") {
    return dev();
  }

  if (view === "explorer") {
    return explorer();
  }

  if (view === "overview") {
    return overview();
  }

  if (view === "account") {
    return account();
  }

  if (view === "security") {
    return security();
  }

  return home();
}

async function home() {
  layout(`
    <div class="topbar">

      <div>
        <h1>ホーム</h1>

        <p class="muted">
          ${esc(currentUser.username)} さんのアプリ
        </p>
      </div>

      <button class="btn" id="open-store">
        App Store
      </button>

    </div>

    <div class="grid">

      ${
        installed.length
          ? installed
              .map(
                a => `
                  <div class="card app-card">

                    <div>

                      <div class="icon">
                        ${esc(a.icon || "◈")}
                      </div>

                      <h3>
                        ${esc(a.name)}
                      </h3>

                      <p class="muted">
                        ${esc(a.description || "")}
                      </p>

                    </div>

                    <button
                      class="btn"
                      data-launch="${esc(a.slug)}"
                    >
                      起動
                    </button>

                  </div>
                `
              )
              .join("")
          : `
            <div class="card">

              <h3>
                アプリがありません
              </h3>

              <p class="muted">
                App Storeからアプリをインストールしてください。
              </p>

            </div>
          `
      }

    </div>
  `);

  document.querySelector("#open-store").onclick = () => {
    render("store");
  };

  document
    .querySelectorAll("[data-launch]")
    .forEach(button => {
      button.onclick = () => {
        launch(button.dataset.launch);
      };
    });
}

async function store() {
  try {
    const { apps } = await api("/apps");

    layout(`
      <div class="topbar">

        <div>
          <h1>App Store</h1>

          <p class="muted">
            紹介情報・コメント・出品者を確認してからインストール
          </p>
        </div>

      </div>

      <div class="grid">

        ${
          apps.length
            ? apps
                .map(
                  a => `
                    <div class="card app-card">

                      <div>

                        <div class="icon">
                          ${esc(a.icon || "◈")}
                        </div>

                        <h3>
                          ${esc(a.name)}
                        </h3>

                        <p class="muted">
                          ${esc(a.description)}
                        </p>

                        <small class="muted">
                          v${a.version}
                          · ★ ${Number(a.rating || 0).toFixed(1)}
                          (${a.rating_count || 0})
                          · ${a.downloads || 0} downloads
                        </small>

                        <p>

                          <button
                            class="btn secondary"
                            data-details="${esc(a.slug)}"
                          >
                            詳細・コメント・出品者
                          </button>

                        </p>

                      </div>

                      <button
                        class="btn"
                        data-install="${esc(a.slug)}"
                      >
                        ${
                          installed.some(
                            x => x.slug === a.slug
                          )
                            ? "インストール済み"
                            : "インストール"
                        }
                      </button>

                    </div>
                  `
                )
                .join("")
            : `
              <div class="card">
                <h3>
                  公開アプリはまだありません
                </h3>
              </div>
            `
        }

      </div>
    `);

    document
      .querySelectorAll("[data-details]")
      .forEach(button => {
        button.onclick = () => {
          showStoreDetails(button.dataset.details);
        };
      });

    document
      .querySelectorAll("[data-install]")
      .forEach(button => {
        button.onclick = () => {
          installFromStore(button.dataset.install);
        };
      });
  } catch (error) {
    layout(`
      <div class="card">

        <h2>
          App Store
        </h2>

        <p>
          ${esc(error.message)}
        </p>

      </div>
    `);
  }
}

async function showStoreDetails(slug) {
  try {
    const d = await api(`/apps/${slug}`);

    const seller = await api(
      `/sellers/${d.app.owner_id}`
    );

    layout(`
      <div class="topbar">

        <div>
          <h1>
            ${esc(d.app.name)}
          </h1>

          <p class="muted">
            ${esc(d.app.description)}
          </p>
        </div>

        <button
          class="btn secondary"
          id="back-store"
        >
          App Storeへ戻る
        </button>

      </div>

      <div class="grid">

        <div class="card">

          <div class="icon">
            ${esc(d.app.icon || "◈")}
          </div>

          <h2>
            紹介情報
          </h2>

          <p>
            ${esc(d.app.description)}
          </p>

          <p class="muted">
            バージョン ${d.app.version}
            /
            ★ ${Number(d.app.rating || 0).toFixed(1)}
            /
            ${d.app.rating_count || 0}件
          </p>

          <button
            class="btn"
            id="detail-install"
          >
            インストール
          </button>

        </div>

        <div class="card">

          <h2>
            出品者
          </h2>

          <h3>
            ${esc(seller.seller.display_name)}
          </h3>

          <p class="muted">
            ${esc(seller.seller.bio || "")}
          </p>

          ${
            seller.seller.website
              ? `
                <p>
                  <a
                    href="${esc(seller.seller.website)}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Webサイト
                  </a>
                </p>
              `
              : ""
          }

          <h3>
            公開アプリ
          </h3>

          ${
            seller.apps.length
              ? seller.apps
                  .map(
                    a => `
                      <div
                        class="notice"
                        style="margin-bottom:8px"
                      >
                        ${esc(a.name)}
                        · ★
                        ${Number(a.rating || 0).toFixed(1)}
                      </div>
                    `
                  )
                  .join("")
              : `
                <p class="muted">
                  公開アプリはありません。
                </p>
              `
          }

        </div>

        <div class="card">

          <h2>
            コメント
          </h2>

          ${
            d.reviews.length
              ? d.reviews
                  .map(
                    r => `
                      <div
                        class="notice"
                        style="margin-bottom:8px"
                      >
                        ★ ${r.rating}
                        <br>
                        ${esc(r.comment)}
                      </div>
                    `
                  )
                  .join("")
              : `
                <p class="muted">
                  まだコメントはありません。
                </p>
              `
          }

          <label>
            評価

            <select id="review-rating">
              <option value="5">5</option>
              <option value="4">4</option>
              <option value="3">3</option>
              <option value="2">2</option>
              <option value="1">1</option>
            </select>
          </label>

          <label>
            コメント

            <textarea
              id="review-comment"
              maxlength="1000"
            ></textarea>
          </label>

          <button
            class="btn secondary"
            id="review-submit"
          >
            コメントを投稿
          </button>

        </div>

      </div>
    `);

    document.querySelector("#back-store").onclick = () => {
      render("store");
    };

    document.querySelector("#detail-install").onclick = () => {
      installFromStore(d.app.slug);
    };

    document.querySelector("#review-submit").onclick = async () => {
      try {
        await api(
          `/apps/${d.app.id}/reviews`,
          {
            method: "POST",
            body: JSON.stringify({
              rating: Number(
                document.querySelector(
                  "#review-rating"
                ).value
              ),
              comment:
                document.querySelector(
                  "#review-comment"
                ).value
            })
          }
        );

        await showStoreDetails(slug);
      } catch (error) {
        alert(error.message);
      }
    };
  } catch (error) {
    alert(error.message);
  }
}

async function installFromStore(slug) {
  try {
    const d = await api(`/apps/${slug}`);

    const accepted = confirm(
      `「${d.app.name}」をインストールします。\n\n` +
      `このアプリはSennin Networkの審査・自動保護を通過していても、` +
      `悪意のある動作や未知の脆弱性を完全に排除できることを保証するものではありません。\n\n` +
      `アプリの利用・インストール・データ損失・損害等について、` +
      `Sennin Network運営側が責任を負わないことに同意します。\n\n` +
      `同意してインストールしますか？`
    );

    if (!accepted) {
      return;
    }

    await api(
      `/apps/${d.app.id}/install-consent`,
      {
        method: "POST",
        body: JSON.stringify({
          accepted: true
        })
      }
    );

    const x = {
      ...d.app,
      files: d.files
    };

    installed = [
      ...installed.filter(
        a => a.slug !== x.slug
      ),
      x
    ];

    localStorage.setItem(
      "sennin-installed-apps",
      JSON.stringify(installed)
    );

    alert("インストールしました。");

    render("home");
  } catch (error) {
    alert(error.message);
  }
}

async function launch(slug) {
  try {
    const local = installed.find(
      a => a.slug === slug
    );

    const d =
      local?.files
        ? local
        : await api(`/apps/${slug}`);

    const htmlFile = d.files.find(
      f => f.path === "index.html"
    );

    if (!htmlFile) {
      alert("index.html がありません。");
      return;
    }

    const css = d.files
      .filter(f => f.path.endsWith(".css"))
      .map(
        f => `<style>${f.content}</style>`
      )
      .join("");

    const js = d.files
      .filter(f => f.path.endsWith(".js"))
      .map(
        f =>
          `<script>${f.content.replace(
            /<\/script/gi,
            "<\\\\/script"
          )}</script>`
      )
      .join("");

    const source =
      htmlFile.content
        .replace(
          /<link[^>]+href=["'][^"']+\.css["'][^>]*>/gi,
          ""
        )
        .replace(
          /<script[^>]+src=["'][^"']+\.js["'][^>]*><\/script>/gi,
          ""
        )
        .replace(
          /<\/head>/i,
          `${css}</head>`
        )
        .replace(
          /<\/body>/i,
          `${js}</body>`
        );

    app.innerHTML = `
      <div class="topbar">

        <div>
          <h1>
            ${esc(d.app.name)}
          </h1>

          <p class="muted">
            sandbox app runtime
          </p>
        </div>

        <button
          class="btn secondary"
          id="back"
        >
          ホームへ戻る
        </button>

      </div>

      <iframe
        class="preview"
        sandbox="allow-scripts"
        referrerpolicy="no-referrer"
        srcdoc="${esc(source).replace(
          /\n/g,
          "&#10;"
        )}"
      ></iframe>
    `;

    document.querySelector("#back").onclick = () => {
      render("home");
    };
  } catch (error) {
    alert(error.message);
  }
}

async function dev() {
  try {
    const { projects } =
      await api("/me/projects");

    layout(`
      <div class="topbar">

        <div>
          <h1>
            DevStudio
          </h1>

          <p class="muted">
            HTML / CSS / JavaScriptでアプリを開発
          </p>
        </div>

        <button
          class="btn"
          id="new-project"
        >
          新規アプリ
        </button>

      </div>

      <div class="grid">

        ${
          projects.length
            ? projects
                .map(
                  p => `
                    <div class="card app-card">

                      <div>

                        <div class="icon">
                          ${esc(p.icon || "◈")}
                        </div>

                        <h3>
                          ${esc(p.name)}
                        </h3>

                        <p class="muted">
                          ${esc(p.description)}
                        </p>

                      </div>

                      <button
                        class="btn secondary"
                        data-project="${esc(p.id)}"
                      >
                        開く
                      </button>

                    </div>
                  `
                )
                .join("")
            : `
              <div class="card">

                <h3>
                  プロジェクトがありません
                </h3>

                <p class="muted">
                  「新規アプリ」から作成できます。
                </p>

              </div>
            `
        }

      </div>
    `);

    document.querySelector("#new-project").onclick =
      () => createProject();

    document
      .querySelectorAll("[data-project]")
      .forEach(button => {
        button.onclick = () => {
          openProject(
            button.dataset.project
          );
        };
      });
  } catch (error) {
    alert(error.message);
  }
}

async function createProject() {
  const name = prompt(
    "アプリ名",
    "My App"
  );

  if (!name) {
    return;
  }

  try {
    const d = await api(
      "/me/projects",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          description: "Sennin Network App",
          icon: "◈",
          files: [
            {
              path: "index.html",
              content:
                "<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>My App</title><link rel=\"stylesheet\" href=\"style.css\"></head><body><h1>Hello Sennin Network</h1><script src=\"app.js\"></script></body></html>"
            },
            {
              path: "style.css",
              content:
                "body{font-family:system-ui;padding:40px;background:#f5f7fb;color:#111}"
            },
            {
              path: "app.js",
              content:
                "console.log('Sennin App');"
            }
          ]
        })
      }
    );

    await openProject(
      d.project.id
    );
  } catch (error) {
    alert(error.message);
  }
}

async function openProject(id) {
  try {
    const d =
      await api(`/me/projects/${id}`);

    currentProject = d.project;

    currentFiles = d.files;

    currentFile =
      currentFiles.find(
        f => f.path === "index.html"
      ) || currentFiles[0];

    devEditor();
  } catch (error) {
    alert(error.message);
  }
}

function devEditor() {
  layout(`
    <div class="topbar">

      <div>

        <h1>
          DevStudio /
          ${esc(currentProject.name)}
        </h1>

        <p class="muted">
          変更は保存してから公開できます。
        </p>

      </div>

      <div class="row">

        <button
          class="btn secondary"
          id="save"
        >
          保存
        </button>

        <button
          class="btn"
          id="publish"
        >
          App Storeへ公開
        </button>

      </div>

    </div>

    <div class="dev-layout">

      <div class="card files">

        <h3>
          Explorer
        </h3>

        ${
          currentFiles
            .map(
              f => `
                <div
                  class="file ${
                    currentFile.path === f.path
                      ? "selected"
                      : ""
                  }"
                  data-file="${esc(f.path)}"
                >
                  ${esc(f.path)}
                </div>
              `
            )
            .join("")
        }

      </div>

      <div class="card">

        <label>

          ${esc(currentFile.path)}

          <textarea
            id="editor"
            class="editor"
          ></textarea>

        </label>

      </div>

      <div class="card">

        <h3>
          Preview
        </h3>

        <iframe
          id="dev-preview"
          class="preview"
          sandbox="allow-scripts"
          referrerpolicy="no-referrer"
        ></iframe>

      </div>

    </div>
  `);

  const editor =
    document.querySelector("#editor");

  editor.value =
    currentFile.content;

  updatePreview();

  editor.oninput = () => {
    currentFile.content =
      editor.value;

    updatePreview();
  };

  document
    .querySelectorAll("[data-file]")
    .forEach(button => {
      button.onclick = () => {
        currentFile =
          currentFiles.find(
            f =>
              f.path ===
              button.dataset.file
          );

        devEditor();
      };
    });

  document.querySelector("#save").onclick =
    saveProject;

  document.querySelector("#publish").onclick =
    publishProject;
}

function buildSource() {
  const html =
    currentFiles.find(
      f => f.path === "index.html"
    )?.content || "";

  const css =
    currentFiles
      .filter(
        f => f.path.endsWith(".css")
      )
      .map(
        f => `<style>${f.content}</style>`
      )
      .join("");

  const js =
    currentFiles
      .filter(
        f => f.path.endsWith(".js")
      )
      .map(
        f =>
          `<script>${f.content.replace(
            /<\/script/gi,
            "<\\\\/script"
          )}</script>`
      )
      .join("");

  return html
    .replace(
      /<link[^>]+href=["'][^"']+\.css["'][^>]*>/gi,
      ""
    )
    .replace(
      /<script[^>]+src=["'][^"']+\.js["'][^>]*><\/script>/gi,
      ""
    )
    .replace(
      /<\/head>/i,
      `${css}</head>`
    )
    .replace(
      /<\/body>/i,
      `${js}</body>`
    );
}

function updatePreview() {
  const preview =
    document.querySelector(
      "#dev-preview"
    );

  if (!preview) {
    return;
  }

  preview.srcdoc =
    buildSource();
}

async function saveProject() {
  try {
    await api(
      `/me/projects/${currentProject.id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          ...currentProject,
          files: currentFiles
        })
      }
    );

    alert("保存しました。");
  } catch (error) {
    alert(error.message);
  }
}

async function publishProject() {
  try {
    await saveProject();

    const storeDescription =
      prompt(
        "App Storeの紹介情報を入力してください",
        currentProject.description || ""
      );

    if (storeDescription === null) {
      return;
    }

    const d = await api(
      "/me/publish",
      {
        method: "POST",
        body: JSON.stringify({
          projectId:
            currentProject.id,
          storeDescription
        })
      }
    );

    alert(
      `公開しました: ${d.app.slug}`
    );
  } catch (error) {
    alert(error.message);
  }
}

async function explorer() {
  try {
    const { projects } =
      await api("/me/projects");

    layout(`
      <div class="topbar">

        <div>

          <h1>
            エクスプローラー
          </h1>

          <p class="muted">
            あなたのプロジェクトとファイル
          </p>

        </div>

      </div>

      <div class="grid">

        ${
          projects.length
            ? projects
                .map(
                  p => `
                    <div class="card">

                      <h3>
                        ${esc(p.name)}
                      </h3>

                      <p class="muted">
                        ${esc(p.description)}
                      </p>

                      <button
                        class="btn secondary"
                        data-open="${esc(p.id)}"
                      >
                        DevStudioで開く
                      </button>

                    </div>
                  `
                )
                .join("")
            : `
              <div class="card">
                <h3>
                  ファイルがありません
                </h3>
              </div>
            `
        }

      </div>
    `);

    document
      .querySelectorAll("[data-open]")
      .forEach(button => {
        button.onclick = () => {
          openProject(
            button.dataset.open
          );
        };
      });
  } catch (error) {
    alert(error.message);
  }
}

async function overview() {
  try {
    const { apps } =
      await api("/apps");

    layout(`
      <div class="topbar">

        <div>

          <h1>
            概要
          </h1>

          <p class="muted">
            Sennin Network OSの状態
          </p>

        </div>

      </div>

      <div class="grid">

        <div class="card">

          <h2>
            ${apps.length}
          </h2>

          <p class="muted">
            公開アプリ
          </p>

        </div>

        <div class="card">

          <h2>
            DevStudio
          </h2>

          <p class="muted">
            HTML/CSS/JS開発環境
          </p>

        </div>

        <div class="card">

          <h2>
            Supabase
          </h2>

          <p class="muted">
            PostgreSQLデータベースとして使用
          </p>

        </div>

        <div class="card">

          <h2>
            Sandbox
          </h2>

          <p class="muted">
            アプリをsandbox iframeで実行
          </p>

        </div>

      </div>
    `);
  } catch (error) {
    alert(error.message);
  }
}

async function account() {
  try {
    const { profile } =
      await api("/me/profile");

    layout(`
      <div class="topbar">

        <div>

          <h1>
            アカウント
          </h1>

          <p class="muted">
            アカウント情報
          </p>

        </div>

      </div>

      <div class="card form">

        <label>
          ユーザー名

          <input
            value="${esc(currentUser.username)}"
            disabled
          >
        </label>

        <label>
          表示名

          <input
            id="display-name"
            maxlength="80"
            value="${esc(profile?.display_name || currentUser.username)}"
          >
        </label>

        <label>
          自己紹介

          <textarea
            id="bio"
            maxlength="500"
          >${esc(profile?.bio || "")}</textarea>
        </label>

        <label>
          Webサイト

          <input
            id="website"
            maxlength="300"
            value="${esc(profile?.website || "")}"
          >
        </label>

        <button
          class="btn"
          id="save-profile"
        >
          プロフィールを保存
        </button>

        <div class="notice">
          このサービスではメールアドレスを使用せず、
          ユーザー名とパスワードでログインします。
        </div>

      </div>
    `);

    document.querySelector(
      "#save-profile"
    ).onclick = async () => {
      try {
        await api(
          "/me/profile",
          {
            method: "PUT",
            body: JSON.stringify({
              display_name:
                document.querySelector(
                  "#display-name"
                ).value,

              bio:
                document.querySelector(
                  "#bio"
                ).value,

              website:
                document.querySelector(
                  "#website"
                ).value
            })
          }
        );

        alert(
          "プロフィールを保存しました。"
        );
      } catch (error) {
        alert(error.message);
      }
    };
  } catch (error) {
    alert(error.message);
  }
}

async function security() {
  layout(`
    <div class="topbar">

      <div>

        <h1>
          セキュリティ
        </h1>

        <p class="muted">
          Sennin Network OSの安全対策
        </p>

      </div>

    </div>

    <div class="grid">

      <div class="card">

        <h3>
          独自認証
        </h3>

        <p class="muted">
          Supabase Authを使用せず、
          Node.jsサーバーでパスワードをハッシュ化して管理します。
        </p>

      </div>

      <div class="card">

        <h3>
          パスワード
        </h3>

        <p class="muted">
          パスワードはscryptによってハッシュ化され、
          データベースには平文で保存されません。
        </p>

      </div>

      <div class="card">

        <h3>
          セッション
        </h3>

        <p class="muted">
          HTTP Only Cookieを使用し、
          ブラウザJavaScriptからセッション値を直接取得できない構成です。
        </p>

      </div>

      <div class="card">

        <h3>
          RLS
        </h3>

        <p class="muted">
          データベースにはRow Level Securityを設定します。
        </p>

      </div>

      <div class="card">

        <h3>
          Sandbox
        </h3>

        <p class="muted">
          公開アプリをsandbox iframeで実行します。
          完全なマルウェア防御ではないため、
          本番環境ではアプリ専用オリジン分離も推奨されます。
        </p>

      </div>

      <div class="card">

        <h3>
          API Rate Limit
        </h3>

        <p class="muted">
          APIへの大量リクエストを制限します。
        </p>

      </div>

    </div>
  `);
}

render();
