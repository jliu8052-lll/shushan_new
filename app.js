const STORAGE_KEY = "shushan-library-books";
const LEGACY_STORAGE_KEY = "personal-library-books";

const seedBooks = [
  {
    id: crypto.randomUUID(),
    title: "置身事内",
    author: "兰小欢",
    isbn: "9787208171336",
    coverUrl: "",
    publisher: "上海人民出版社",
    year: 2021,
    language: "zh",
    genre: "经济",
    status: "reading",
    format: "paper",
    rating: 4.5,
    tags: ["城市", "财政"],
    notes: "适合慢慢读，很多章节可以做摘录。",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: crypto.randomUUID(),
    title: "献给阿尔吉侬的花束",
    author: "Daniel Keyes",
    isbn: "9780156030304",
    coverUrl: "https://covers.openlibrary.org/isbn/9780156030304-M.jpg",
    publisher: "Mariner Books",
    year: 1959,
    language: "en",
    genre: "小说",
    status: "done",
    format: "ebook",
    rating: 5,
    tags: ["科幻", "人性"],
    notes: "读完后很难立刻开始下一本。",
    updatedAt: Date.now() - 1000 * 60 * 60 * 8,
  },
  {
    id: crypto.randomUUID(),
    title: "设计心理学",
    author: "唐纳德·诺曼",
    isbn: "9787508648330",
    coverUrl: "",
    publisher: "中信出版社",
    year: 2015,
    language: "zh",
    genre: "设计",
    status: "want",
    format: "paper",
    rating: 0,
    tags: ["产品", "体验"],
    notes: "放到下一轮产品阅读清单。",
    updatedAt: Date.now() - 1000 * 60 * 32,
  },
];

const statusText = {
  all: "全部藏书",
  reading: "正在读",
  want: "想读",
  done: "已读完",
};

const formatText = {
  paper: "纸质书",
  ebook: "电子书",
  audio: "有声书",
};

const languageText = {
  zh: "中文",
  en: "English",
  ja: "日本語",
  other: "其他",
};

const isbnOverrides = {
  9787532537365: {
    title: "插图本人间词话",
    author: "王国维",
    publisher: "上海古籍出版社",
    year: 2004,
    language: "zh",
    genre: "文学",
    isbn: "9787532537365",
  },
};

let books = loadBooks();
let activeStatus = "all";

const grid = document.querySelector("#book-grid");
const dialog = document.querySelector("#book-dialog");
const form = document.querySelector("#book-form");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const deleteButton = document.querySelector("#delete-book");
const lookupButton = document.querySelector("#lookup-isbn");
const scanButton = document.querySelector("#scan-isbn");
const lookupStatus = document.querySelector("#lookup-status");
const exportButton = document.querySelector("#export-books");
const exportMarkdownButton = document.querySelector("#export-markdown");
const importButton = document.querySelector("#import-books");
const importFile = document.querySelector("#import-file");
const scannerDialog = document.querySelector("#scanner-dialog");
const scannerVideo = document.querySelector("#scanner-video");
const scannerStatus = document.querySelector("#scanner-status");
let scannerStream;
let scannerTimer;
let zxingReader;
let zxingControls;
let scanCandidate = "";
let scanCandidateCount = 0;

document.querySelector("#open-form").addEventListener("click", () => openEditor());
document.querySelector("#close-form").addEventListener("click", closeEditor);
document.querySelector("#cancel-form").addEventListener("click", closeEditor);
document.querySelector("#close-scanner").addEventListener("click", stopScanner);
searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);
lookupButton.addEventListener("click", lookupCurrentIsbn);
scanButton.addEventListener("click", startScanner);
exportButton.addEventListener("click", exportBooks);
exportMarkdownButton.addEventListener("click", exportMarkdown);
importButton.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", importBooks);

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    activeStatus = button.dataset.status;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    render();
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#book-id").value || crypto.randomUUID();
  const existing = books.find((book) => book.id === id);
  const nextBook = {
    id,
    isbn: normalizeIsbn(valueOf("#isbn")),
    title: valueOf("#title"),
    author: valueOf("#author"),
    publisher: valueOf("#publisher"),
    coverUrl: valueOf("#cover-url") || existing?.coverUrl || "",
    year: Number(valueOf("#year")) || "",
    language: valueOf("#language"),
    genre: valueOf("#genre"),
    status: valueOf("#status"),
    format: existing?.format || "paper",
    rating: existing?.rating || 0,
    tags: valueOf("#tags")
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
    notes: valueOf("#notes"),
    updatedAt: Date.now(),
  };

  books = existing ? books.map((book) => (book.id === id ? nextBook : book)) : [nextBook, ...books];
  saveBooks();
  closeEditor();
  render();
});

deleteButton.addEventListener("click", () => {
  const id = document.querySelector("#book-id").value;
  if (!id) return;
  books = books.filter((book) => book.id !== id);
  saveBooks();
  closeEditor();
  render();
});

function loadBooks() {
  const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!stored) return seedBooks;
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeBook) : seedBooks;
  } catch {
    return seedBooks;
  }
}

function normalizeBook(book) {
  return {
    isbn: "",
    publisher: "",
    title: "",
    author: "",
    coverUrl: "",
    language: guessLanguage(book.title || ""),
    ...book,
    tags: Array.isArray(book.tags) ? book.tags : [],
    updatedAt: book.updatedAt || Date.now(),
  };
}

function saveBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function valueOf(selector) {
  return document.querySelector(selector).value.trim();
}

function getVisibleBooks() {
  const query = searchInput.value.trim().toLowerCase();
  return books
    .filter((book) => activeStatus === "all" || book.status === activeStatus)
    .filter((book) => {
      const haystack = [book.title, book.author, book.isbn, book.publisher, book.genre, book.notes, ...(book.tags || [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (sortSelect.value === "title") return a.title.localeCompare(b.title, "zh-CN");
      if (sortSelect.value === "year") return (b.year || 0) - (a.year || 0);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

function render() {
  renderStats();
  const visibleBooks = getVisibleBooks();
  grid.innerHTML = "";

  if (!visibleBooks.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>没有找到书</h3>
        <p>换个关键词，或者添加一本新的藏书。</p>
      </div>
    `;
    return;
  }

  visibleBooks.forEach((book) => {
    const card = document.createElement("article");
    card.className = `book-card ${book.coverUrl ? "" : "no-cover"}`;
    card.innerHTML = `
      ${book.coverUrl ? `<img class="cover-image" src="${escapeHtml(book.coverUrl)}" alt="${escapeHtml(book.title)}封面" loading="lazy" />` : ""}
      <div class="book-info">
        <h3>${escapeHtml(book.title)}</h3>
        <p>${escapeHtml(book.author)}${book.publisher ? ` · ${escapeHtml(book.publisher)}` : ""}${book.year ? ` · ${book.year}` : ""}</p>
        <div class="meta-row">
          ${book.isbn ? `<span class="pill tag">ISBN ${escapeHtml(book.isbn)}</span>` : ""}
          <span class="pill">${languageText[book.language] || languageText.other}</span>
          <button class="pill status-pill" type="button" data-next="${book.id}">${statusText[book.status]}</button>
        </div>
        <div class="tag-row">
          ${(book.tags || []).map((tag) => `<span class="pill tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="card-actions">
          <button class="small-button" type="button" data-edit="${book.id}">编辑</button>
        </div>
      </div>
    `;
    grid.append(card);
  });

  grid.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => openEditor(books.find((book) => book.id === button.dataset.edit)));
  });

  grid.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", () => cycleStatus(button.dataset.next));
  });
}

function renderStats() {
  const counts = {
    all: books.length,
    reading: books.filter((book) => book.status === "reading").length,
    want: books.filter((book) => book.status === "want").length,
    done: books.filter((book) => book.status === "done").length,
  };
  Object.entries(counts).forEach(([key, count]) => {
    document.querySelector(`#count-${key}`).textContent = count;
  });

  const thirtyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;

  document.querySelector("#month-count").textContent = `${books.filter((book) => book.updatedAt > thirtyDaysAgo).length} 本`;
}

function openEditor(book) {
  form.reset();
  lookupStatus.textContent = "";
  document.querySelector("#dialog-title").textContent = book ? "编辑书籍" : "添加书籍";
  deleteButton.style.visibility = book ? "visible" : "hidden";

  setValue("#book-id", book?.id || "");
  setValue("#cover-url", book?.coverUrl || "");
  setValue("#isbn", book?.isbn || "");
  setValue("#title", book?.title || "");
  setValue("#author", book?.author || "");
  setValue("#publisher", book?.publisher || "");
  setValue("#year", book?.year || "");
  setValue("#language", book?.language || "zh");
  setValue("#genre", book?.genre || "");
  setValue("#status", book?.status || "reading");
  setValue("#tags", (book?.tags || []).join("，"));
  setValue("#notes", book?.notes || "");

  dialog.showModal();
}

function setValue(selector, value) {
  document.querySelector(selector).value = value;
}

function closeEditor() {
  stopScanner();
  dialog.close();
}

function cycleStatus(id) {
  const order = ["reading", "want", "done"];
  books = books.map((book) => {
    if (book.id !== id) return book;
    const nextStatus = order[(order.indexOf(book.status) + 1) % order.length];
    return { ...book, status: nextStatus, updatedAt: Date.now() };
  });
  saveBooks();
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function lookupCurrentIsbn() {
  const isbn = normalizeIsbn(valueOf("#isbn"));
  if (!isbn) {
    lookupStatus.textContent = "请先输入或扫描 ISBN。";
    return;
  }

  setValue("#isbn", isbn);
  lookupButton.disabled = true;
  lookupStatus.textContent = "正在查询书籍信息…";

  try {
    const bookInfo = await fetchBookByIsbn(isbn);
    if (!bookInfo) {
      lookupStatus.textContent = "暂时没有查到，可以手动补充。";
      return;
    }
    applyBookInfo(bookInfo);
    lookupStatus.textContent = bookInfo.partial
      ? "只查到拼音版信息，已保留中文字段，可手动补充。"
      : "已填入查到的信息，你可以继续修改。";
  } catch {
    lookupStatus.textContent = "查询失败，请检查网络，或先手动录入。";
  } finally {
    lookupButton.disabled = false;
  }
}

async function fetchBookByIsbn(isbn) {
  if (isbnOverrides[isbn]) return isbnOverrides[isbn];

  const results = await Promise.allSettled([
    fetchGoogleBook(isbn, "zh"),
    fetchGoogleBook(isbn),
    fetchOpenLibraryBook(isbn),
  ]);
  const candidates = results
    .filter((result) => result.status === "fulfilled" && result.value)
    .map((result) => result.value);
  if (!candidates.length) return null;

  const scored = candidates
    .map((candidate) => ({ candidate, score: scoreBookInfo(candidate, isbn) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0].candidate;
  if (isLikelyChineseIsbn(isbn) && !hasCjkBookInfo(best)) {
    return {
      isbn,
      title: "",
      author: "",
      publisher: "",
      year: best.year || "",
      language: "zh",
      genre: "",
      coverUrl: best.coverUrl || "",
      partial: true,
    };
  }
  return best;
}

async function fetchGoogleBook(isbn, language) {
  const langParam = language ? `&langRestrict=${encodeURIComponent(language)}` : "";
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}${langParam}`);
  if (!response.ok) return null;
  const data = await response.json();
  const info = data.items?.[0]?.volumeInfo;
  if (!info) return null;

  return {
    title: info.title || "",
    author: (info.authors || []).join(", "),
    publisher: info.publisher || "",
    coverUrl: getGoogleCover(info),
    year: getYear(info.publishedDate),
    language: normalizeLanguage(info.language || ""),
    genre: info.categories?.[0] || "",
    isbn,
  };
}

async function fetchOpenLibraryBook(isbn) {
  const response = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
  if (!response.ok) return null;
  const data = await response.json();
  const author = await fetchOpenLibraryAuthors(data.authors || []);
  return {
    title: data.title || "",
    author,
    publisher: (data.publishers || []).join(", "),
    coverUrl: `https://covers.openlibrary.org/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`,
    year: getYear(data.publish_date),
    language: guessLanguage(data.title || ""),
    genre: (data.subjects || [])[0] || "",
    isbn,
  };
}

async function fetchOpenLibraryAuthors(authors) {
  const keys = authors.map((author) => author.key).filter(Boolean).slice(0, 3);
  const names = await Promise.all(
    keys.map(async (key) => {
      try {
        const response = await fetch(`https://openlibrary.org${key}.json`);
        if (!response.ok) return "";
        const data = await response.json();
        return data.name || "";
      } catch {
        return "";
      }
    }),
  );
  return names.filter(Boolean).join(", ");
}

function applyBookInfo(bookInfo) {
  setValue("#title", bookInfo.title || valueOf("#title"));
  setValue("#author", bookInfo.author || valueOf("#author"));
  setValue("#publisher", bookInfo.publisher || valueOf("#publisher"));
  setValue("#year", bookInfo.year || valueOf("#year"));
  setValue("#language", bookInfo.language || guessLanguage(bookInfo.title || valueOf("#title")));
  setValue("#genre", bookInfo.genre || valueOf("#genre"));
  setValue("#cover-url", bookInfo.coverUrl || valueOf("#cover-url"));
}

function scoreBookInfo(bookInfo, isbn) {
  let score = 0;
  if (bookInfo.title) score += 4;
  if (bookInfo.author) score += 2;
  if (bookInfo.publisher) score += 2;
  if (bookInfo.year) score += 1;
  if (bookInfo.coverUrl) score += 1;
  if (hasCjkBookInfo(bookInfo)) score += isLikelyChineseIsbn(isbn) ? 20 : 4;
  if (isLikelyChineseIsbn(isbn) && !hasCjkBookInfo(bookInfo)) score -= 20;
  return score;
}

function hasCjkBookInfo(bookInfo) {
  return /[\u4e00-\u9fff]/.test([bookInfo.title, bookInfo.author, bookInfo.publisher, bookInfo.genre].join(" "));
}

function isLikelyChineseIsbn(isbn) {
  return /^97[89]7/.test(normalizeIsbn(isbn));
}

function getGoogleCover(info) {
  const links = info.imageLinks || {};
  return links.thumbnail || links.smallThumbnail || "";
}

function exportBooks() {
  const payload = {
    app: "书山",
    version: 1,
    exportedAt: new Date().toISOString(),
    books,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `shushan-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportMarkdown() {
  const lines = ["# 书山藏书", "", `导出时间：${formatDateTime(new Date())}`, "", `共 ${books.length} 本`, ""];
  const groups = [
    ["reading", "正在读"],
    ["want", "想读"],
    ["done", "已读完"],
  ];

  groups.forEach(([status, label]) => {
    const groupBooks = books
      .filter((book) => book.status === status)
      .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
    lines.push(`## ${label}（${groupBooks.length}）`, "");
    if (!groupBooks.length) {
      lines.push("_暂无_", "");
      return;
    }
    groupBooks.forEach((book) => {
      lines.push(`### ${book.title || "未命名书籍"}`);
      lines.push(`- 作者：${book.author || ""}`);
      lines.push(`- 出版：${[book.publisher, book.year].filter(Boolean).join("，")}`);
      lines.push(`- 语言：${languageText[book.language] || languageText.other}`);
      if (book.genre) lines.push(`- 分类：${book.genre}`);
      if (book.isbn) lines.push(`- ISBN：${book.isbn}`);
      if (book.tags?.length) lines.push(`- 标签：${book.tags.join("、")}`);
      if (book.notes) lines.push(`- 备注：${book.notes.replace(/\r?\n/g, " ")}`);
      lines.push("");
    });
  });

  downloadText(`shushan-library-${new Date().toISOString().slice(0, 10)}.md`, lines.join("\n"), "text/markdown;charset=utf-8");
}

function downloadText(filename, content, type) {
  const blob = new Blob(["\uFEFF", content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function importBooks(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const importedBooks = Array.isArray(data) ? data : data.books;
    if (!Array.isArray(importedBooks)) throw new Error("Invalid backup");
    books = importedBooks.map(normalizeBook).filter((book) => book.title || book.isbn);
    saveBooks();
    activeStatus = "all";
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.status === "all"));
    render();
  } catch {
    window.alert("导入失败：请选择书山导出的 JSON 备份文件。");
  }
}

async function startScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    lookupStatus.textContent = "当前环境不能打开摄像头，可以手动输入 ISBN。";
    return;
  }

  scannerDialog.showModal();
  scannerStatus.textContent = "正在准备摄像头…";

  try {
    if (!("BarcodeDetector" in window)) {
      await startZxingScanner();
      return;
    }

    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    scannerVideo.srcObject = scannerStream;
    await scannerVideo.play();
    scanLoop(new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }));
  } catch {
    scannerStatus.textContent = "摄像头没有打开，可以手动输入 ISBN。";
  }
}

function scanLoop(detector) {
  scannerStatus.textContent = "把完整 ISBN 条码放进框内。";
  scannerTimer = window.setInterval(async () => {
    if (!scannerVideo.videoWidth) return;
    let isbn = "";
    try {
      const codes = await detector.detect(scannerVideo);
      const rawValue = codes.map((code) => code.rawValue).find((value) => parseScannedIsbn(value));
      isbn = parseScannedIsbn(rawValue || "");
      if (!isbn) return;
    } catch {
      scannerStatus.textContent = "识别遇到问题，可以换个角度再试。";
      return;
    }

    acceptScannedIsbn(isbn);
  }, 700);
}

function stopScanner() {
  if (scannerTimer) window.clearInterval(scannerTimer);
  scannerTimer = null;
  scanCandidate = "";
  scanCandidateCount = 0;
  if (zxingControls?.stop) {
    zxingControls.stop();
  }
  zxingControls = null;
  if (zxingReader?.reset) {
    zxingReader.reset();
  }
  zxingReader = null;
  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
  }
  scannerStream = null;
  scannerVideo.srcObject = null;
  if (scannerDialog.open) scannerDialog.close();
}

async function startZxingScanner() {
  scannerStatus.textContent = "正在加载 iPhone 兼容扫码组件…";
  try {
    await loadScript("https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js");
    const ZXingBrowser = window.ZXingBrowser;
    if (!ZXingBrowser?.BrowserMultiFormatOneDReader) throw new Error("ZXing unavailable");

    scannerStatus.textContent = "把完整 ISBN 条码放进框内，保持几秒钟。";
    zxingReader = new ZXingBrowser.BrowserMultiFormatOneDReader();
    zxingControls = await zxingReader.decodeFromConstraints(
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      scannerVideo,
      (result) => {
        const isbn = parseScannedIsbn(result?.getText?.() || result?.text || "");
        if (!isbn) return;
        acceptScannedIsbn(isbn);
      },
    );
  } catch (error) {
    scannerStatus.textContent = error?.message?.includes("ZXing")
      ? "兼容扫码组件加载失败，可以手动输入 ISBN 查询。"
      : "兼容扫码没有启动成功，请检查摄像头权限，或手动输入 ISBN。";
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

function normalizeIsbn(value) {
  return String(value || "")
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase();
}

function parseScannedIsbn(value) {
  const raw = normalizeIsbn(value);
  const candidates = [raw, ...raw.match(/\d{13}|\d{9}[\dX]/g) || []];
  return candidates.find(isValidIsbn) || "";
}

function acceptScannedIsbn(isbn) {
  if (isbn === scanCandidate) {
    scanCandidateCount += 1;
  } else {
    scanCandidate = isbn;
    scanCandidateCount = 1;
  }

  scannerStatus.textContent =
    scanCandidateCount < 2 ? `已看到 ${isbn}，请保持条码稳定…` : `已识别 ISBN ${isbn}`;
  if (scanCandidateCount < 2) return;

  setValue("#isbn", isbn);
  stopScanner();
  lookupStatus.textContent = `已识别 ISBN ${isbn}，正在查询…`;
  lookupCurrentIsbn();
}

function isValidIsbn(value) {
  const isbn = normalizeIsbn(value);
  if (isbn.length === 10) return isValidIsbn10(isbn);
  if (isbn.length === 13) return isValidIsbn13(isbn);
  return false;
}

function isValidIsbn10(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = isbn.split("").reduce((total, char, index) => {
    const value = char === "X" ? 10 : Number(char);
    return total + value * (10 - index);
  }, 0);
  return sum % 11 === 0;
}

function isValidIsbn13(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  const sum = isbn
    .slice(0, 12)
    .split("")
    .reduce((total, char, index) => total + Number(char) * (index % 2 ? 3 : 1), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn[12]);
}

function getYear(value) {
  const match = String(value || "").match(/\d{4}/);
  return match ? Number(match[0]) : "";
}

function normalizeLanguage(value) {
  const language = String(value || "").toLowerCase();
  if (language.startsWith("zh")) return "zh";
  if (language.startsWith("en")) return "en";
  if (language.startsWith("ja") || language.startsWith("jp")) return "ja";
  return "other";
}

function guessLanguage(text) {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[a-z]/i.test(text)) return "en";
  return "other";
}

render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
