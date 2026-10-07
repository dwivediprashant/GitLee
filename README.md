# GitLee

<img width="200" height="200" alt="GitLee Cat Code Icon (3) (1)" src="https://github.com/user-attachments/assets/133ba71a-153c-4aa2-824a-32123c75e0e6" />

GitLee is a Manifest V3 browser extension and Express/MongoDB service that writes a user's accepted LeetCode solution to a GitHub repository. It only syncs after an accepted verdict is visible in the active LeetCode page and writes a `Description.md` plus the user's unmodified solution in one GitHub commit.

## How to setup & use

https://github.com/user-attachments/assets/17cb13bf-3b01-4df5-843d-56d432aad1bd

<!--
1. Install dependencies: `npm run install:all`.
2. Create `server/.env` from `server/.env.example`; set MongoDB, a long `JWT_SECRET`, the token-encryption key, and GitHub App credentials.
3. Create a GitHub App with a callback URL of `http://localhost:3001/api/auth/github/callback`, user authorization enabled, and **Contents: Read and write** repository permission. Install it in the account or organizations where repositories will be selected.
4. Run MongoDB, then start the server with `npm run dev:server`.
5. Build the extension: `npm run build:extension`. In Chrome, open `chrome://extensions`, enable Developer mode, and load `extension/dist` unpacked. Copy Chrome's assigned extension ID into `EXTENSION_ID`, restart the server, and reload the extension.
-->

## Steps

1. Open the popup, connect GitHub, and select a repository.
2. On a LeetCode problem, submit code and wait for the real `Accepted` result.
3. GitLee injects **_Commit to GitHub_** only after that result is present. The backend re-checks repository access, formats the page's extracted description, and uses GitHub's Git Data API to commit both files atomically.

## Description formatting

`Description.md` is built directly from the description extracted from the active LeetCode page. The backend converts its HTML into Markdown deterministically, without an LLM(AI), so it cannot add or infer problem details. No fake problem data, source code, repositories, or commits are used.

## Support

**EMAIL** : prashantdwivedi.0219@gmail.com
