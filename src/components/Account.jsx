import React, { useState } from "react";
import {
  login,
  register
} from "../api";

export default function Account({
  user,
  onLogin,
  onLogout
}) {
  const [mode, setMode] =
    useState("login");

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function submit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(
          username,
          password
        );
      } else {
        await register(
          username,
          password
        );
      }

      setUsername("");
      setPassword("");

      await onLogin();
    } catch (error) {
      setError(
        error.message
      );
    } finally {
      setLoading(false);
    }
  }

  if (user) {
    return (
      <>
        <div className="page-heading">
          <h1>Account</h1>

          <p>
            アカウント情報を管理します。
          </p>
        </div>

        <div className="account-card">
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: 28,
              display: "grid",
              placeItems: "center",
              fontSize: 42,
              marginBottom: 25,
              background:
                "rgba(255,255,255,.08)"
            }}
          >
            👤
          </div>

          <h2>
            {user.username}
          </h2>

          <p
            style={{
              color:
                "rgba(255,255,255,.5)"
            }}
          >
            Web OS Account
          </p>

          <p
            style={{
              color:
                "rgba(255,255,255,.5)"
            }}
          >
            Created:{" "}
            {new Date(
              user.created_at
            ).toLocaleDateString(
              "ja-JP"
            )}
          </p>

          <button
            className="danger-button"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-heading">
        <h1>
          {mode === "login"
            ? "Welcome Back"
            : "Create Account"}
        </h1>

        <p>
          Web OSを利用するにはアカウントが必要です。
        </p>
      </div>

      <div className="account-card">
        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="form-group">
            <label>
              Username
            </label>

            <input
              className="form-input"
              value={username}
              onChange={e =>
                setUsername(
                  e.target.value
                )
              }
              placeholder="username"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label>
              Password
            </label>

            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e =>
                setPassword(
                  e.target.value
                )
              }
              placeholder="8文字以上"
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              required
            />
          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
            style={{
              width: "100%"
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </form>

        <div
          style={{
            marginTop: 25,
            textAlign: "center"
          }}
        >
          <button
            className="secondary-button"
            onClick={() => {
              setMode(
                mode === "login"
                  ? "register"
                  : "login"
              );

              setError("");
            }}
          >
            {mode === "login"
              ? "Create a new account"
              : "Already have an account?"}
          </button>
        </div>
      </div>
    </>
  );
}
