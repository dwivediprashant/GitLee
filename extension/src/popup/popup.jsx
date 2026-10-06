import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";

const BACKEND = "https://gitlee-backend.onrender.com/api";

async function apiFetch(path, options = {}) {
  const token = await new Promise((resolve) =>
    chrome.storage.local.get("authToken", (r) => resolve(r.authToken || null)),
  );
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ─── RepoSelector ─────────────────────────────────────────────────────────────

function RepoSelector({ onSelect, onCancel }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    apiFetch("/github/repositories")
      .then((data) => setRepos(data.repositories || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="section-label">Select Repository</div>
      <input
        className="search-input"
        placeholder="Search repositories…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {loading && <div className="loading">Loading repositories…</div>}
      {error && <div className="error-msg">{error}</div>}
      {!loading && !error && (
        <div className="repo-list">
          {filtered.length === 0 && (
            <div className="repo-item">
              <span className="repo-item-meta">No repositories found</span>
            </div>
          )}
          {filtered.map((repo) => (
            <div
              key={repo.id}
              className={`repo-item ${selected?.id === repo.id ? "selected" : ""}`}
              onClick={() => setSelected(repo)}
            >
              <div className="repo-item-name">{repo.full_name}</div>
              <div className="repo-item-meta">
                {repo.private ? "🔒 Private" : "🌐 Public"} ·{" "}
                {repo.default_branch}
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        className="btn btn-primary"
        disabled={!selected}
        onClick={() => selected && onSelect(selected)}
      >
        Confirm Selection
      </button>
      <button className="btn btn-secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

// ─── Main Popup ───────────────────────────────────────────────────────────────

function Popup() {
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);
  const [selectingRepo, setSelectingRepo] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await chrome.runtime.sendMessage({
        type: "GET_AUTH_STATE",
      });
      setAuthState(state);

      if (state.authenticated) {
        // Verify token is still valid
        try {
          await apiFetch("/auth/me");
        } catch {
          // Token invalid — clear it
          await chrome.runtime.sendMessage({ type: "LOGOUT" });
          setAuthState({
            authenticated: false,
            user: null,
            selectedRepo: null,
          });
          return;
        }
      }

      const sync = await new Promise((resolve) =>
        chrome.storage.local.get("lastSync", (r) =>
          resolve(r.lastSync || null),
        ),
      );
      setLastSync(sync);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  async function handleConnect() {
    setError(null);
    const result = await chrome.runtime.sendMessage({
      type: "START_GITHUB_AUTH",
    });
    if (result.success) {
      await loadState();
    } else {
      setError(result.error || "GitHub authentication failed");
    }
  }

  async function handleDisconnect() {
    await chrome.runtime.sendMessage({ type: "LOGOUT" });
    await loadState();
  }

  async function handleRepoSelect(repo) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/settings/repository", {
        method: "POST",
        body: JSON.stringify({
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
          private: repo.private,
        }),
      });
      await chrome.storage.local.set({
        selectedRepo: {
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
        },
      });
      setSelectingRepo(false);
      await loadState();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openRepo() {
    const repo = authState?.selectedRepo;
    if (repo)
      chrome.tabs.create({
        url: `https://github.com/${repo.fullName || `${repo.owner}/${repo.name}`}`,
      });
  }

  if (loading) {
    return (
      <div className="popup">
        <div className="loading">Loading…</div>
      </div>
    );
  }

  if (selectingRepo) {
    return (
      <div className="popup">
        <div className="header">
          <span className="logo">🔗</span>
          <h1>LeetGit</h1>
        </div>
        <RepoSelector
          onSelect={handleRepoSelect}
          onCancel={() => setSelectingRepo(false)}
        />
      </div>
    );
  }

  const { authenticated, user, selectedRepo } = authState || {};

  return (
    <div className="popup">
      <div className="header">
        <span className="logo">🔗</span>
        <h1>LeetGit</h1>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* GitHub Connection */}
      <div className="section">
        <div className="section-label">GitHub</div>
        <div className="status-row">
          <div
            className={`dot ${authenticated ? "connected" : "disconnected"}`}
          />
          <span className="status-text">
            {authenticated ? user?.login || "Connected" : "Not Connected"}
          </span>
        </div>
      </div>

      {!authenticated ? (
        <button className="btn btn-primary" onClick={handleConnect}>
          Connect GitHub
        </button>
      ) : (
        <>
          {/* Repository */}
          <div className="section">
            <div className="section-label">Repository</div>
            {selectedRepo ? (
              <div className="repo-name">
                {selectedRepo.fullName ||
                  `${selectedRepo.owner}/${selectedRepo.name}`}
              </div>
            ) : (
              <div className="status-text" style={{ color: "#8b949e" }}>
                No repository selected
              </div>
            )}
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => setSelectingRepo(true)}
            disabled={saving}
          >
            {selectedRepo ? "Change Repository" : "Select Repository"}
          </button>

          {/* Last Sync */}
          {lastSync && (
            <>
              <div className="divider" />
              <div className="section">
                <div className="section-label">Recent Sync</div>
                <div className="last-sync">
                  <div className="problem-title">{lastSync.problemTitle}</div>
                  <div className="meta">
                    {lastSync.language} · Synced successfully
                  </div>
                  {lastSync.commitUrl && (
                    <a
                      className="commit-link"
                      href={lastSync.commitUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        chrome.tabs.create({ url: lastSync.commitUrl });
                      }}
                    >
                      View commit →
                    </a>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="divider" />

          {selectedRepo && (
            <button className="btn btn-secondary" onClick={openRepo}>
              Open Repository
            </button>
          )}

          <button className="btn btn-danger" onClick={handleDisconnect}>
            Disconnect GitHub
          </button>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Popup />);
