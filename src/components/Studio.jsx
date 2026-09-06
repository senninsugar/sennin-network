import React, { useEffect, useMemo, useState } from "react";
import {
  createApp,
  getMyApps,
  publishApp
} from "../api";

const MAX_SIZE = 500 * 1024;

const DEFAULT_FILES = [
  {
    name: "index.html",
    content:
`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My Web OS App</title>
</head>
<body>
  <h1>Hello Web OS!</h1>

  <button onclick="hello()">
    Click me
  </button>
</body>
</html>`
  },
  {
    name: "style.css",
    content:
`body {
  font-family: sans-serif;
  padding: 40px;
  background: #10131a;
  color: white;
}

button {
  padding: 12px 18px;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}`
  },
  {
    name: "app.js",
    content:
`function hello() {
  alert("Hello from Web OS!");
}`
  }
];

export default function Studio({
  user
}) {
  const [files, setFiles] = useState(
    DEFAULT_FILES
  );

  const [selectedFile, setSelectedFile] =
    useState("index.html");

  const [name, setName] =
    useState("My Web OS App");

  const [description, setDescription] =
    useState("My first Web OS application.");

  const [icon, setIcon] =
    useState("🧩");

  const [category, setCategory] =
    useState("Utility");

  const [version, setVersion] =
    useState("1.0.0");

  const [myApps, setMyApps] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [creating, setCreating] =
    useState(false);

  const currentFile = useMemo(
    () =>
      files.find(
        file => file.name === selectedFile
      ),
    [files, selectedFile]
  );

  const totalSize = useMemo(() => {
    return files.reduce(
      (sum, file) =>
        sum +
        new Blob([file.content]).size,
      0
    );
  }, [files]);

  const percent = Math.min(
    100,
    (totalSize / MAX_SIZE) * 100
  );

  useEffect(() => {
    if (!user) {
      setMyApps([]);
      return;
    }

    getMyApps()
      .then(result =>
        setMyApps(result.apps || [])
      )
      .catch(() => {});
  }, [user]);

  function updateCurrentFile(content) {
    setFiles(old =>
      old.map(file =>
        file.name === selectedFile
          ? {
              ...file,
              content
            }
          : file
      )
    );
  }

  function addFile() {
    const name = window.prompt(
      "ファイル名を入力してください",
      "new.js"
    );

    if (!name) {
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      setMessage(
        "ファイル名に使用できない文字があります。"
      );
      return;
    }

    if (
      files.some(
        file => file.name === name
      )
    ) {
      setMessage(
        "そのファイルは既に存在します。"
      );
      return;
    }

    setFiles(old => [
      ...old,
      {
        name,
        content: ""
      }
    ]);

    setSelectedFile(name);
  }

  function deleteFile() {
    if (files.length <= 1) {
      return;
    }

    setFiles(old =>
      old.filter(
        file => file.name !== selectedFile
      )
    );

    setSelectedFile(
      files.find(
        file => file.name !== selectedFile
      )?.name || files[0].name
    );
  }

  function preview() {
    const html =
      files.find(
        file => file.name === "index.html"
      )?.content || "";

    const css =
      files.find(
        file => file.name === "style.css"
      )?.content || "";

    const js =
      files.find(
        file => file.name === "app.js"
      )?.content || "";

    const win = window.open(
      "",
      "_blank",
      "width=1000,height=700"
    );

    if (!win) {
      setMessage(
        "ポップアップがブロックされています。"
      );
      return;
    }

    const documentHtml =
`${html}
<style>
${css}
</style>
<script>
${js}
<\/script>`;

    win.document.open();
    win.document.write(
      documentHtml
    );
    win.document.close();
  }

  async function create() {
    if (!user) {
      setMessage(
        "Dev Studioを使用するにはログインしてください。"
      );
      return;
    }

    if (
      totalSize > MAX_SIZE
    ) {
      setMessage(
        "アプリサイズが500KBを超えています。"
      );
      return;
    }

    if (
      !files.some(
        file => file.name === "index.html"
      )
    ) {
      setMessage(
        "index.htmlが必要です。"
      );
      return;
    }

    setCreating(true);
    setMessage("");

    try {
      const result =
        await createApp({
          name,
          description,
          icon,
          category,
          version,
          files
        });

      setMessage(
        `アプリを保存しました。ID: ${result.id}`
      );

      const apps =
        await getMyApps();

      setMyApps(
        apps.apps || []
      );
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setCreating(false);
    }
  }

  async function publish(id) {
    try {
      await publishApp(id);

      const result =
        await getMyApps();

      setMyApps(
        result.apps || []
      );

      setMessage(
        "App Storeへ公開しました。"
      );
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  if (!user) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: 55 }}>
          🛠️
        </div>

        <h2>
          Dev Studio
        </h2>

        <p>
          アプリを開発するにはアカウントが必要です。
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="page-heading">
        <h1>Dev Studio</h1>

        <p>
          HTML / CSS / JavaScriptでWeb OSアプリを開発。
          最大500KBまで。
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 12,
          marginBottom: 20
        }}
      >
        <input
          className="form-input"
          placeholder="アプリ名"
          value={name}
          onChange={e =>
            setName(e.target.value)
          }
        />

        <input
          className="form-input"
          placeholder="アイコン"
          value={icon}
          onChange={e =>
            setIcon(e.target.value)
          }
        />

        <input
          className="form-input"
          placeholder="バージョン"
          value={version}
          onChange={e =>
            setVersion(e.target.value)
          }
        />

        <select
          className="form-input"
          value={category}
          onChange={e =>
            setCategory(e.target.value)
          }
        >
          <option>Utility</option>
          <option>Game</option>
          <option>Education</option>
          <option>Entertainment</option>
          <option>Tools</option>
          <option>Other</option>
        </select>
      </div>

      <textarea
        className="form-input"
        style={{
          minHeight: 90,
          marginBottom: 20,
          resize: "vertical"
        }}
        placeholder="アプリの説明"
        value={description}
        onChange={e =>
          setDescription(e.target.value)
        }
      />

      {message && (
        <div className="error-box">
          {message}
        </div>
      )}

      <div className="studio">
        <aside className="file-sidebar">
          <h3>Files</h3>

          {files.map(file => (
            <button
              key={file.name}
              className={
                "file-item " +
                (
                  selectedFile === file.name
                    ? "active"
                    : ""
                )
              }
              onClick={() =>
                setSelectedFile(
                  file.name
                )
              }
            >
              {file.name}
            </button>
          ))}

          <button
            className="secondary-button"
            style={{
              width: "100%",
              marginTop: 10
            }}
            onClick={addFile}
          >
            + File
          </button>

          <button
            className="danger-button"
            style={{
              width: "100%",
              marginTop: 8
            }}
            onClick={deleteFile}
          >
            Delete
          </button>

          <div className="size-meter">
            <strong>
              Size
            </strong>

            <div>
              {Math.round(
                totalSize / 1024
              )} KB / 500 KB
            </div>

            <div className="size-meter-bar">
              <div
                className="size-meter-fill"
                style={{
                  width:
                    `${percent}%`
                }}
              />
            </div>
          </div>
        </aside>

        <section className="editor-area">
          <div className="editor-toolbar">
            <strong>
              {selectedFile}
            </strong>

            <div
              style={{
                display: "flex",
                gap: 8
              }}
            >
              <button
                className="secondary-button"
                onClick={preview}
              >
                Preview
              </button>

              <button
                className="primary-button"
                disabled={creating}
                onClick={create}
              >
                {creating
                  ? "Saving..."
                  : "Save App"}
              </button>
            </div>
          </div>

          <textarea
            className="code-editor"
            value={
              currentFile?.content || ""
            }
            onChange={e =>
              updateCurrentFile(
                e.target.value
              )
            }
            spellCheck={false}
          />
        </section>
      </div>

      <section className="section">
        <div className="section-header">
          <h2>
            My Applications
          </h2>
        </div>

        {myApps.length === 0 ? (
          <div className="empty-state">
            保存したアプリはありません。
          </div>
        ) : (
          <div className="app-grid">
            {myApps.map(app => (
              <div
                className="app-card"
                key={app.id}
              >
                <div>
                  <div className="app-icon">
                    {app.icon}
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
                      fontSize: 12,
                      color:
                        "rgba(255,255,255,.5)"
                    }}
                  >
                    {Math.round(
                      app.size / 1024
                    )} KB
                    {" · "}
                    {app.published
                      ? "Published"
                      : "Draft"}
                  </div>
                </div>

                {!app.published && (
                  <button
                    className="primary-button"
                    onClick={() =>
                      publish(app.id)
                    }
                  >
                    Publish
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
