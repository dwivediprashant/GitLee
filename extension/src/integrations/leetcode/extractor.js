// Extracts submission and problem data from the LeetCode page.

import { SELECTORS } from "./selectors.js";
import {
  parseLanguage,
  parseProblemSlugFromUrl,
  parseSourceCode,
  parseSubmissionIdFromUrl,
} from "./parser.js";

const SUPPORTED_LANGUAGE_NAMES = [
  "python3",
  "python",
  "javascript",
  "typescript",
  "csharp",
  "c++",
  "cpp",
  "java",
  "kotlin",
  "golang",
  "go",
  "swift",
  "rust",
  "ruby",
  "scala",
  "php",
  "racket",
  "erlang",
  "elixir",
  "dart",
  "r",
  "c",
];

/**
 * Tries each selector in the list and returns the first matching element.
 */
function queryFirst(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

/**
 * Extracts the problem title from the page.
 */
function extractProblemTitle() {
  for (const sel of SELECTORS.problemTitle) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) {
      // Strip leading number prefix like "1. Two Sum" → "Two Sum"
      const text = el.textContent.trim();
      const withoutNumber = text.replace(/^\d+\.\s*/, "");
      return withoutNumber || text;
    }
  }
  // Fallback: try document title
  const titleMatch = document.title.match(/^(.+?)\s*[-|]/);
  if (titleMatch) return titleMatch[1].trim();
  return null;
}

/**
 * Extracts source code from the Monaco editor.
 * Monaco renders each line as a separate DOM element.
 */
function extractCodeFromVisibleMonaco() {
  const candidates = [...document.querySelectorAll(".view-lines")]
    .map((viewLines) => {
      const lines = [...viewLines.querySelectorAll(":scope > .view-line")];
      if (!lines.length) return "";

      // Monaco virtualizes the DOM, but sorting prevents React/DOM order from
      // changing the source when the visible viewport is rerendered.
      lines.sort(
        (a, b) =>
          parseInt(a.style.top || "0", 10) - parseInt(b.style.top || "0", 10),
      );
      return lines
        .map((line) => line.innerText ?? line.textContent ?? "")
        .join("\n");
    })
    .filter(Boolean);

  return candidates.sort((a, b) => b.length - a.length)[0] || null;
}

/**
 * Extracts source from LeetCode's submission viewer/code containers.
 */
function extractCodeFromSubmissionViewer(language) {
  const candidates = [];
  const submissionRoots = [
    '[data-cy="submission-code"]',
    '[data-testid="submission-code"]',
    ".submission-view",
    '[class*="submission"]',
  ];

  function isLiveEditorElement(element) {
    return Boolean(
      element.closest(
        '.CodeMirror, .monaco-editor, [class*="editor-scrollable"], ' +
          '[class*="editor-container"], [data-cy="editor"]',
      ),
    );
  }

  function addCandidate(container) {
    if (isLiveEditorElement(container)) return;
    const text = container.innerText || container.textContent || "";
    if (text.trim() && text.trim().split("\n").length > 1)
      candidates.push(text);
  }

  // LeetCode's accepted submission pane uses a syntax-highlighted <code>
  // block. This is the submitted source, not the virtualized live editor.
  const languageClasses = [languageToCodeClass(language)].filter(Boolean);
  for (const rootSelector of submissionRoots) {
    for (const root of document.querySelectorAll(rootSelector)) {
      const codeSelectors = [
        ...languageClasses.map((className) => `code.${className}`),
        'code[class*="language-"]',
        "pre",
        ".CodeMirror-code",
        ".ace_content",
      ];
      for (const selector of codeSelectors) {
        for (const container of root.querySelectorAll(selector)) {
          addCandidate(container);
        }
      }
    }
  }

  // Submission detail routes do not always have a stable submission class.
  // On those routes, inspect code blocks globally but still exclude the live
  // editor so the accepted detail code is the only eligible source.
  if (/\/submissions(?:\/detail)?\/\d+/.test(window.location.href)) {
    for (const container of document.querySelectorAll(
      'code[class*="language-"], pre code, pre',
    )) {
      addCandidate(container);
    }
  }

  for (const rootSelector of submissionRoots) {
    for (const root of document.querySelectorAll(rootSelector)) {
      const lines = root.querySelectorAll(
        ".view-line, .CodeMirror-line, .ace_line",
      );
      if (lines.length) {
        const text = [...lines]
          .filter((line) => !isLiveEditorElement(line))
          .map((line) => line.innerText ?? line.textContent ?? "")
          .join("\n");
        if (text.trim()) candidates.push(text);
      }
    }
  }

  return (
    candidates
      .sort((a, b) => b.length - a.length)
      .find(
        (text) => text.trim().length > 1 && text.trim().split("\n").length > 1,
      ) || null
  );
}

function languageToCodeClass(language) {
  const classNames = {
    cpp: "language-cpp",
    csharp: "language-csharp",
    javascript: "language-javascript",
    python: "language-python",
    python3: "language-python",
    java: "language-java",
    typescript: "language-typescript",
    kotlin: "language-kotlin",
    go: "language-go",
    rust: "language-rust",
    ruby: "language-ruby",
    swift: "language-swift",
  };
  return classNames[language] || null;
}

/**
 * Reads the complete Monaco model from the page's JavaScript context.
 * Monaco virtualizes the DOM, so .view-lines only contains the visible viewport.
 */
function extractCodeFromMonacoModel(language) {
  return new Promise((resolve) => {
    const requestId = `gitlee-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timeout = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(null);
    }, 1000);

    function onMessage(event) {
      if (event.source !== window || event.data?.source !== "gitlee-monaco")
        return;
      if (event.data.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve(typeof event.data.code === "string" ? event.data.code : null);
    }

    window.addEventListener("message", onMessage);
    const script = document.createElement("script");
    script.textContent = `(() => {
      const requestId = ${JSON.stringify(requestId)};
      const language = ${JSON.stringify(language)};
      let models = [];
      try {
        const editors = window.monaco?.editor?.getEditors?.() || [];
        models = editors.map(editor => editor.getModel?.()).filter(Boolean);
        if (!models.length) models = window.monaco?.editor?.getModels?.() || [];
        const matching = models.find(model => {
          const id = model.getLanguageId?.();
          return id === language || (language === 'python' && id === 'python3') ||
            (language === 'cpp' && id === 'c++');
        });
        const model = matching || models[0];
        window.postMessage({
          source: 'gitlee-monaco',
          requestId,
          code: model?.getValue?.() || null
        }, '*');
      } catch {
        window.postMessage({ source: 'gitlee-monaco', requestId, code: null }, '*');
      }
    })();`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  });
}

/**
 * Extracts the currently selected language from the editor toolbar.
 */
function extractLanguage() {
  const selectedLanguage = extractExplicitlySelectedLanguage();
  if (selectedLanguage) return selectedLanguage;

  for (const sel of SELECTORS.languageSelector) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) {
      const language = findSupportedLanguage(el.textContent);
      if (language) return language;
    }
  }

  // LeetCode changes class names frequently. As a cautious fallback, inspect only
  // controls in the current Monaco editor's own container—not the whole page.
  const editor = document.querySelector(".monaco-editor");
  let container = editor;
  for (
    let level = 0;
    container && level < 5;
    level += 1, container = container.parentElement
  ) {
    const candidates = [
      ...container.querySelectorAll(
        'button, [role="button"], [role="combobox"]',
      ),
    ]
      .map((el) => findSupportedLanguage(el.textContent))
      .filter(Boolean);
    const uniqueCandidates = [...new Set(candidates)];
    if (uniqueCandidates.length === 1) return uniqueCandidates[0];
  }

  // In some LeetCode layouts the top editor bar is a sibling rather than an
  // ancestor of Monaco. Accept it only when the page exposes one unambiguous
  // supported-language control; this still reads the user-selected dropdown.
  const pageCandidates = [
    ...document.querySelectorAll(
      'button, [role="button"], [role="combobox"], select',
    ),
  ]
    .map((el) =>
      findSupportedLanguage(
        `${el.textContent || ""} ${el.getAttribute("aria-label") || ""}`,
      ),
    )
    .filter(Boolean);
  const uniquePageCandidates = [...new Set(pageCandidates)];
  if (uniquePageCandidates.length === 1) return uniquePageCandidates[0];

  // Fallback: check URL for language hint
  const urlLang = new URLSearchParams(window.location.search).get("lang");
  if (urlLang) return parseLanguage(urlLang);

  logLanguageControls(editor);
  return null;
}

function extractExplicitlySelectedLanguage() {
  const nativeSelect = document.querySelector("select");
  if (nativeSelect?.selectedOptions?.length) {
    const language = findSupportedLanguage(
      nativeSelect.selectedOptions[0].textContent || nativeSelect.value,
    );
    if (language) return language;
  }

  const selectedControls = document.querySelectorAll(
    '[role="option"][aria-selected="true"], [aria-checked="true"], [data-state="checked"], [data-headlessui-state~="selected"]',
  );
  const languages = [...selectedControls]
    .map((el) =>
      findSupportedLanguage(
        `${el.textContent || ""} ${el.getAttribute("aria-label") || ""}`,
      ),
    )
    .filter(Boolean);
  const uniqueLanguages = [...new Set(languages)];
  return uniqueLanguages.length === 1 ? uniqueLanguages[0] : null;
}

function logLanguageControls(editor) {
  if (!editor) return;
  let container = editor;
  for (
    let level = 0;
    container && level < 5;
    level += 1, container = container.parentElement
  ) {
    const labels = [
      ...container.querySelectorAll(
        'button, [role="button"], [role="combobox"], select',
      ),
    ]
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
        ariaLabel: el.getAttribute("aria-label"),
        dataE2e: el.getAttribute("data-e2e-locator"),
        dataCy: el.getAttribute("data-cy"),
      }))
      .filter(
        (item) => item.text || item.ariaLabel || item.dataE2e || item.dataCy,
      );
    if (labels.length) {
      console.warn(
        "[GitLee] Language control candidates (share this console output for selector support):",
        labels,
      );
      return;
    }
  }
}

function findSupportedLanguage(text) {
  const normalized = (text || "").trim().toLowerCase();
  if (!normalized) return null;
  for (const name of SUPPORTED_LANGUAGE_NAMES) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (
      new RegExp(`(^|[^a-z0-9+#])${escaped}($|[^a-z0-9+#])`, "i").test(
        normalized,
      )
    ) {
      return parseLanguage(name);
    }
  }
  return null;
}

function extractSubmissionLanguage() {
  const roots = document.querySelectorAll(
    '[data-cy="submission-code"], [data-testid="submission-code"], ' +
      '.submission-view, [class*="submission"]',
  );
  const candidates = [];

  for (const root of roots) {
    const code = root.querySelector('code[class*="language-"]');
    const codeLanguage = code?.className.match(/language-([a-z0-9+#-]+)/i)?.[1];
    if (codeLanguage) candidates.push(parseLanguage(codeLanguage));

    for (const element of root.querySelectorAll(
      '[data-language], [data-lang], [aria-label*="Java"], [aria-label*="Python"], ' +
        "span, button, div",
    )) {
      const language = findSupportedLanguage(
        `${element.getAttribute("data-language") || ""} ` +
          `${element.getAttribute("data-lang") || ""} ` +
          `${element.getAttribute("aria-label") || ""} ${element.textContent || ""}`,
      );
      if (language) candidates.push(language);
    }
  }

  if (/\/submissions(?:\/detail)?\/\d+/.test(window.location.href)) {
    for (const code of document.querySelectorAll('code[class*="language-"]')) {
      if (isLiveEditorCode(code)) continue;
      const language = code.className.match(/language-([a-z0-9+#-]+)/i)?.[1];
      if (language) candidates.push(parseLanguage(language));
    }
  }

  return [...new Set(candidates)][0] || null;
}

function isLiveEditorCode(element) {
  return Boolean(
    element.closest(
      '.CodeMirror, .monaco-editor, [class*="editor-scrollable"], ' +
        '[class*="editor-container"], [data-cy="editor"]',
    ),
  );
}

/**
 * Extracts the problem description HTML/text.
 */
function extractProblemDescription() {
  for (const sel of SELECTORS.problemDescription) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) {
      return el.innerHTML; // preserve structure for LLM formatting
    }
  }
  return null;
}

/**
 * Main extraction function. Returns a submission object or throws with a reason.
 */
export async function extractSubmission() {
  const problemTitle = extractProblemTitle();
  if (!problemTitle) {
    throw new Error("Could not extract problem title from the page");
  }

  const problemSlug = parseProblemSlugFromUrl(window.location.href);

  const language = extractSubmissionLanguage() || extractLanguage();
  if (!language) {
    throw new Error("Could not determine the programming language");
  }

  // The active editor is not a valid source for sync because it is virtualized
  // and may contain unsaved or partial code. Require the expanded submission
  // viewer so the committed file always matches the accepted submission.
  const submissionViewerCode = extractCodeFromSubmissionViewer(language);
  const rawCode = submissionViewerCode;
  if (!rawCode) {
    throw new Error(
      "Could not extract the complete submitted solution. Expand the Accepted submission code panel and try again.",
    );
  }

  const sourceCode = parseSourceCode(rawCode);
  if (!sourceCode) {
    throw new Error("Extracted source code is empty after normalization");
  }

  const problemDescription = extractProblemDescription();
  if (!problemDescription || !problemDescription.trim()) {
    throw new Error(
      "Could not extract the complete problem description. Open the problem description and try again.",
    );
  }
  const submissionId = parseSubmissionIdFromUrl(window.location.href);

  return {
    problemTitle,
    problemSlug,
    problemDescription,
    sourceCode,
    language,
    submissionId,
    accepted: true, // caller must verify accepted state before calling this
    extractedAt: Date.now(),
    pageUrl: window.location.href,
  };
}
