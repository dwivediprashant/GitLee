import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";

const BACKEND = `${import.meta.env.VITE_BACKEND_URL || "https://gitlee-backend.onrender.com"}/api`;

function AppIcon() {
  return (
    <div className="app-icon-wrap">
      <img className="app-icon" src="icons/icon128.png" alt="GitLee" />
    </div>
  );
}

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

// ─── FolderSelector ───────────────────────────────────────────────────────────

function FolderSelector({ repo, initialFolder, onSaved }) {
  const [folders, setFolders] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(initialFolder || "");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    if (!repo) return;
    setLoading(true);
    setError(null);
    apiFetch(
      `/github/folders?owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}&branch=${encodeURIComponent(repo.defaultBranch || "main")}`,
    )
      .then((data) => {
        const list = data.folders || [];
        setFolders(list);
        setTruncated(Boolean(data.truncated));
        setIsEmpty(Boolean(data.isEmpty));
        if (initialFolder && list.includes(initialFolder)) {
          setPicked(initialFolder);
        } else if (initialFolder) {
          setCustom(initialFolder);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.owner, repo?.name, repo?.defaultBranch]);

  const useCustom = picked === "__custom__";
  const effectiveFolder = useCustom ? custom.trim() : picked;
  const preview = effectiveFolder
    ? `${effectiveFolder}/<Problem>/solution.*`
    : `<Problem>/solution.* (root)`;

  const filtered = folders.filter((f) =>
    f.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const result = await apiFetch("/settings/repository", {
        method: "POST",
        body: JSON.stringify({
          owner: repo.owner,
          name: repo.name,
          fullName: repo.fullName || `${repo.owner}/${repo.name}`,
          defaultBranch: repo.defaultBranch || "main",
          private: repo.private,
          targetFolder: effectiveFolder,
        }),
      });
      await chrome.storage.local.set({
        selectedRepo: {
          ...repo,
          targetFolder: result.repository?.targetFolder ?? "",
        },
      });
      setSaveMsg("Saved ✓");
      onSaved?.(result.repository);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading">Loading folders…</div>;

  return (
    <div>
      <div className="section-label">Target Folder</div>
      {isEmpty && folders.length === 0 ? (
        <div className="helper-note">
          This repository is empty — files will go to the root level. Folders
          will appear here after your first sync.
        </div>
      ) : (
        <>
          <input
            className="search-input"
            placeholder="Search folders…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {truncated && (
            <div className="helper-note">
              Large repo — list may be partial. You can still type a custom
              path.
            </div>
          )}
          <div className="folder-list">
            <div
              className={`folder-item ${picked === "" ? "selected" : ""}`}
              onClick={() => setPicked("")}
            >
              <div className="folder-item-name">📁 Root Level / None</div>
              <div className="folder-item-meta">
                Commit directly to repo root
              </div>
            </div>
            {filtered.map((f) => (
              <div
                key={f}
                className={`folder-item ${picked === f ? "selected" : ""}`}
                onClick={() => setPicked(f)}
              >
                <div className="folder-item-name">📁 {f}</div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="folder-item">
                <span className="folder-item-meta">No folders match</span>
              </div>
            )}
            <div
              className={`folder-item ${useCustom ? "selected" : ""}`}
              onClick={() => setPicked("__custom__")}
            >
              <div className="folder-item-name">✏️ Custom path…</div>
              <div className="folder-item-meta">
                Create a new nested structure
              </div>
            </div>
          </div>
          {useCustom && (
            <input
              className="search-input folder-custom-input"
              placeholder="e.g. algorithms/arrays"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              autoFocus
            />
          )}
        </>
      )}
      {error && <div className="error-msg">{error}</div>}
      {saveMsg && <div className="save-msg">{saveMsg}</div>}
      <div className="path-preview">
        <span className="path-preview-label">Will commit to: </span>
        <span className="path-preview-value">{preview}</span>
      </div>
      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save Folder"}
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
  const [selectingFolder, setSelectingFolder] = useState(false);
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
      const saved = await new Promise((resolve) =>
        chrome.storage.local.get("selectedRepo", (r) =>
          resolve(r.selectedRepo || null),
        ),
      );
      // Preserve the previously saved target folder when switching repos only
      // if it belongs to the same repo; otherwise start at root.
      const keepFolder =
        saved &&
        saved.owner === repo.owner.login &&
        saved.name === repo.name &&
        typeof saved.targetFolder === "string"
          ? saved.targetFolder
          : "";
      await apiFetch("/settings/repository", {
        method: "POST",
        body: JSON.stringify({
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
          private: repo.private,
          targetFolder: keepFolder,
        }),
      });
      await chrome.storage.local.set({
        selectedRepo: {
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
          targetFolder: keepFolder,
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
        <AppIcon />
        <div className="loading">Loading…</div>
      </div>
    );
  }

  if (selectingRepo) {
    return (
      <div className="popup">
        <AppIcon />

        <RepoSelector
          onSelect={handleRepoSelect}
          onCancel={() => setSelectingRepo(false)}
        />
      </div>
    );
  }

  if (selectingFolder && authState?.selectedRepo) {
    return (
      <div className="popup">
        <AppIcon />

        <FolderSelector
          repo={authState.selectedRepo}
          initialFolder={authState.selectedRepo.targetFolder || ""}
          onSaved={(repository) => {
            setAuthState((prev) => ({
              ...prev,
              selectedRepo: {
                ...prev.selectedRepo,
                targetFolder: repository?.targetFolder ?? "",
              },
            }));
            setSelectingFolder(false);
          }}
        />
        <button
          className="btn btn-secondary"
          onClick={() => setSelectingFolder(false)}
        >
          Back
        </button>
      </div>
    );
  }

  const { authenticated, user, selectedRepo } = authState || {};

  return (
    <div className="popup">
      <AppIcon />

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
              <>
                <div className="repo-name">
                  {selectedRepo.fullName ||
                    `${selectedRepo.owner}/${selectedRepo.name}`}
                </div>
                <div className="folder-current">
                  📁 {selectedRepo.targetFolder || "Root Level"}
                </div>
              </>
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

          {selectedRepo && (
            <button
              className="btn btn-secondary"
              onClick={() => setSelectingFolder(true)}
            >
              {selectedRepo.targetFolder
                ? "Change Folder"
                : "Select Target Folder"}
            </button>
          )}

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
