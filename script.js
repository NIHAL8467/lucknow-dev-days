const HISTORY_KEY = "notice-copilot-history-v1";
const DEMO_NOTICE = `OFFICE OF THE CONTROLLER OF EXAMINATIONS
END SEMESTER EXAMINATION FORM NOTICE
Date of issue: 1 October 2026

All final-year undergraduate and postgraduate students enrolled for the October 2026 semester examinations must submit their examination form through the college examination portal by 15 October 2026.

Examination fee: ₹1,200. Pay the fee through the portal by 10 October 2026.

Before starting the form, prepare: College ID card, Enrollment ID, fee receipt, and one recent passport-size photograph.

Students with outstanding library dues must clear them before submission.

After submitting the form, save the confirmation page for your records. Contact the Office of the Controller of Examinations for help.

Venue: Submit online through the college examination portal.
Reporting time: Not specified in this notice.`;

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const DATE_PATTERN = /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{4})\b|\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b|\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/gi;
const DOCUMENTS = [
  ["College ID card", /\bcollege\s+id(?:\s+card)?\b/i],
  ["Enrollment ID", /\benrollment\s+id\b/i],
  ["Fee receipt", /\bfee\s+receipt\b/i],
  ["Passport-size photograph", /\bpassport[- ]size\s+(?:photograph|photo)\b/i],
  ["Fee payment proof", /\bfee\s+payment\s+proof\b/i],
  ["Application form", /\bapplication\s+form\b/i],
  ["Mark sheet", /\bmarksheet\b|\bmark\s+sheet\b/i],
  ["Category certificate", /\bcategory\s+certificate\b/i],
];
const menuButton = document.querySelector("#menu-toggle");
const navigation = document.querySelector("#primary-nav");
const uploadInput = document.querySelector("#notice-file");
const dropZone = document.querySelector("#drop-zone");
const fileSelection = document.querySelector("#file-selection");
const fileName = document.querySelector("#file-name");
const uploadError = document.querySelector("#upload-error");
const analyzeTextButton = document.querySelector("#analyze-text");
const pastedText = document.querySelector("#notice-text");
const processingCard = document.querySelector("#processing-card");
const processingMessage = document.querySelector("#processing-message");
const processingStep = document.querySelector("#processing-step");
const analysisError = document.querySelector("#analysis-error");
const results = document.querySelector("#results");
const historyGrid = document.querySelector("#history-grid");
const historyCount = document.querySelector("#history-count");
const questionForm = document.querySelector("#question-form");
const questionInput = document.querySelector("#question-input");
const answerBox = document.querySelector("#answer-box");
const tabs = [...document.querySelectorAll(".input-tab")];

let history = readHistory();
let activeNotice = null;
let analysisSequence = 0;

renderHistory();

function readHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((item) => item && typeof item.id === "string" && typeof item.text === "string") : [];
  } catch {
    return [];
  }
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch {
    showAnalysisError("This browser could not save your notice.", "You can still read the analysis, but it won’t appear in My Notices after you leave this page.");
    return false;
  }
}

function makeId() {
  return window.crypto && typeof window.crypto.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function setMenuOpen(isOpen) {
  menuButton.setAttribute("aria-expanded", String(isOpen));
  navigation.classList.toggle("is-open", isOpen);
}

menuButton.addEventListener("click", () => {
  setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
});

navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
    setMenuOpen(false);
    menuButton.focus();
  }
});

document.querySelector("#try-demo").addEventListener("click", () => analyze(DEMO_NOTICE, "End Semester Examination Form Notice", "Demo notice"));
document.querySelector("#try-demo-inline").addEventListener("click", () => analyze(DEMO_NOTICE, "End Semester Examination Form Notice", "Demo notice"));

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-selected", String(selected));
      document.querySelector(`#${item.getAttribute("aria-controls")}`).hidden = !selected;
    });
    clearUploadError();
  });
});

uploadInput.addEventListener("change", () => {
  const [file] = uploadInput.files || [];
  if (file) handleFile(file);
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});
dropZone.addEventListener("dragleave", (event) => {
  if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove("is-dragging");
});
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  const [file] = event.dataTransfer.files;
  if (file) handleFile(file);
});

document.querySelector("#remove-file").addEventListener("click", () => {
  uploadInput.value = "";
  fileSelection.hidden = true;
  clearUploadError();
});

analyzeTextButton.addEventListener("click", () => {
  analyze(pastedText.value, "Pasted college notice", "Pasted text");
});

async function handleFile(file) {
  clearUploadError();
  fileName.textContent = file.name;
  fileSelection.hidden = false;
  if (file.size > 10 * 1024 * 1024) {
    showUploadError("This file is over 10 MB. Choose a smaller notice or paste its text instead.");
    return;
  }
  if (!/\.txt$/i.test(file.name) && file.type !== "text/plain") {
    showUploadError("This no-backend demo can read TXT files. PDF, DOC, DOCX, and image OCR need a document extraction service, which isn’t connected here. Paste the notice text to analyze it locally.");
    return;
  }
  try {
    const text = await file.text();
    if (!text.trim()) {
      showUploadError("This file appears to be empty. Try another file or paste the notice text.");
      return;
    }
    analyze(text, file.name.replace(/\.txt$/i, ""), "Text file");
  } catch {
    showUploadError("We couldn’t read this file. Try saving it as UTF-8 plain text or paste the notice text.");
  }
}

function showUploadError(message) {
  uploadError.textContent = message;
  uploadError.hidden = false;
}

function clearUploadError() {
  uploadError.hidden = true;
  uploadError.textContent = "";
}

function showAnalysisError(title, message) {
  document.querySelector("#analysis-error-title").textContent = title;
  document.querySelector("#analysis-error-message").textContent = message;
  analysisError.hidden = false;
}

function clearAnalysisError() {
  analysisError.hidden = true;
}

async function analyze(text, fallbackTitle, source) {
  clearUploadError();
  clearAnalysisError();
  const content = String(text || "").trim();
  if (!content) {
    showAnalysisError("Your notice is empty.", "Paste the notice text or choose a TXT file before starting an analysis.");
    return;
  }
  if (content.length < 30) {
    showAnalysisError("We couldn’t confidently read this notice.", "There isn’t enough text to identify useful details. Try a clearer copy or paste the complete notice.");
    return;
  }
  const sequence = ++analysisSequence;
  processingCard.hidden = false;
  results.hidden = true;
  processingMessage.textContent = source === "Demo notice" ? "Reading the sample notice…" : "Reading your notice…";
  processingStep.textContent = "Looking for dates, documents, and actions";
  if (source === "Demo notice") document.querySelector("#analyze").scrollIntoView({ behavior: "smooth", block: "start" });
  await new Promise((resolve) => window.setTimeout(resolve, source === "Demo notice" ? 420 : 620));
  if (sequence !== analysisSequence) return;

  const extracted = extractNotice(content, fallbackTitle);
  activeNotice = {
    id: makeId(),
    title: extracted.title,
    text: content,
    source,
    analyzedAt: new Date().toISOString(),
    model: "local",
    ...extracted,
    tasks: extracted.tasks.map((task, index) => ({ ...task, id: `task-${index}`, done: false })),
  };
  history = [activeNotice, ...history.filter((item) => item.id !== activeNotice.id)].slice(0, 20);
  persistHistory();
  renderAnalysis(activeNotice);
  processingCard.hidden = true;
  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: source === "Demo notice" ? "start" : "start" });
}

function splitSentences(text) {
  return text.replace(/\r/g, "").split(/\n+|(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
}

function parseDateMatch(match) {
  let day;
  let month;
  let year;
  if (match[1]) {
    day = Number(match[1]);
    month = MONTHS[match[2].toLowerCase()];
    year = Number(match[3]);
  } else if (match[4]) {
    month = MONTHS[match[4].toLowerCase()];
    day = Number(match[5]);
    year = Number(match[6]);
  } else {
    day = Number(match[7]);
    month = Number(match[8]) - 1;
    year = Number(match[9]);
  }
  if (year < 100) year += 2000;
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return {
    iso: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    label: date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
  };
}

function findDates(text) {
  const dates = [];
  for (const sentence of splitSentences(text)) {
    DATE_PATTERN.lastIndex = 0;
    for (const match of sentence.matchAll(DATE_PATTERN)) {
      const parsed = parseDateMatch(match);
      if (!parsed) continue;
      if (dates.some((item) => item.iso === parsed.iso && item.sentence === sentence)) continue;
      dates.push({ ...parsed, sentence });
    }
  }
  return dates;
}

function urgencyFor(iso) {
  if (!iso) return { label: "NO DEADLINE", className: "urgency-none" };
  const [year, month, day] = iso.split("-").map(Number);
  const deadline = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((deadline - today) / 86400000);
  if (days < 0) return { label: "PAST", className: "urgency-none" };
  if (days <= 2) return { label: "URGENT", className: "urgency-urgent" };
  if (days <= 7) return { label: "UPCOMING", className: "urgency-upcoming" };
  return { label: "LATER", className: "urgency-later" };
}

function findDocumentNames(text) {
  return DOCUMENTS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function extractNotice(text, fallbackTitle) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sentences = splitSentences(text);
  const title = lines.find((line) => /notice|circular|notification|examination|admission|scholarship|fee/i.test(line) && !/^(office|department|directorate|controller|registrar|dean)\b/i.test(line) && line.length < 105)
    || fallbackTitle
    || "College notice";
  const issuer = lines.find((line) => /^(office|department|directorate|controller|registrar|dean)\b/i.test(line)) || "";
  const issueLine = sentences.find((line) => /issued?\s*(?:on|date)?|date\s+of\s+issue/i.test(line)) || "";
  const issueDate = findDates(issueLine)[0]?.label || "";
  const noticeType = /exam|semester/i.test(title) || /examination/i.test(text) ? "Examination notice"
    : /admission/i.test(title) ? "Admission notice"
      : /scholarship/i.test(title) ? "Scholarship notice"
        : /fee/i.test(title) ? "Fee notice" : "College notice";
  const dates = findDates(text).map((date) => ({
    ...date,
    event: /fee|payment/i.test(date.sentence) ? "Fee payment"
      : /submit|submission|form|application/i.test(date.sentence) ? "Submission deadline"
        : /exam|examination|event|report/i.test(date.sentence) ? "Important event" : "Date mentioned",
    isDeadline: /\b(?:by|before|deadline|last date|no later than)\b/i.test(date.sentence),
    urgency: urgencyFor(date.iso),
  }));

  const tasks = [];
  if (/submit.{0,80}(?:form|application|notice|document)|(?:form|application).{0,80}submit/i.test(text)) {
    const line = sentences.find((item) => /submit.{0,80}(?:form|application|document)|(?:form|application).{0,80}submit/i.test(item));
    tasks.push({ title: line ? trimSentence(line, 105) : "Submit the form mentioned in the notice", deadline: relatedDate(dates, /submit|form|application/i), documents: findDocumentNames(text) });
  }
  if (/pay.{0,50}(?:fee|amount)|(?:fee|amount).{0,50}pay/i.test(text)) {
    const line = sentences.find((item) => /pay.{0,50}(?:fee|amount)|(?:fee|amount).{0,50}pay/i.test(item));
    tasks.push({ title: line ? trimSentence(line, 105) : "Pay the fee mentioned in the notice", deadline: relatedDate(dates, /fee|pay/i), documents: findDocumentNames(line || "") });
    const feeTask = tasks[tasks.length - 1];
    if (!feeTask.documents.length && /\bfee\s+receipt\b/i.test(text)) feeTask.documents = ["Fee receipt"];
  }
  const duesLine = sentences.find((line) => /(?:clear|pay|settle).{0,60}dues|outstanding.{0,40}dues/i.test(line));
  if (duesLine) {
    tasks.push({ title: trimSentence(duesLine, 105), deadline: relatedDate(dates, /dues/i), documents: findDocumentNames(duesLine) });
  }
  const recordLine = sentences.find((line) => /save.{0,60}(?:confirmation|receipt|copy|record)/i.test(line));
  if (recordLine) {
    tasks.push({ title: trimSentence(recordLine, 105), deadline: relatedDate(dates, /confirmation|receipt/i), documents: findDocumentNames(recordLine) });
  }
  if (/bring|attach|enclose|prepare|upload.{0,40}(?:document|certificate|photo|id)/i.test(text) && !tasks.some((task) => /document|form/i.test(task.title))) {
    tasks.push({ title: "Prepare the documents listed in the notice", deadline: null, documents: findDocumentNames(text) });
  }
  const eligibilityLine = sentences.find((line) => /eligible|students? of|students? in|semester|year|course|who can|applicable to/i.test(line) && /student|semester|year|course|eligible/i.test(line)) || "";
  const summaryLines = [];
  if (eligibilityLine) summaryLines.push(trimSentence(eligibilityLine, 220));
  if (tasks.length) summaryLines.push(`${tasks.length} action${tasks.length === 1 ? "" : "s"} identified: ${tasks.map((task) => trimSentence(task.title, 90).replace(/[.?!]$/, "")).join("; ")}.`);
  else summaryLines.push("No specific action could be confidently identified in the provided notice text.");
  const deadline = dates.filter((date) => date.isDeadline).sort((a, b) => a.iso.localeCompare(b.iso))[0];
  if (deadline) summaryLines.push(`The earliest deadline mentioned is ${deadline.label}.`);
  const details = {
    fee: sentences.find((line) => /₹|rs\.?|rupees|fee|amount/i.test(line) && /\d/.test(line)) || "",
    venue: sentences.find((line) => /venue|where|submit (?:it )?(?:at|to|through|via)|online portal/i.test(line)) || "",
    reporting: sentences.find((line) => /reporting time|report at|reporting/i.test(line)) || "",
    contact: sentences.find((line) => /contact|reach out|email|phone|call/i.test(line)) || "",
    department: issuer || lines.find((line) => /office of|department of/i.test(line)) || "",
    instructions: sentences.filter((line) => /must|should|required|instructions?|ensure|before starting|after submitting/i.test(line)).slice(0, 3),
  };
  return {
    title: cleanLabel(title),
    noticeType,
    issuer: cleanLabel(issuer),
    issueDate,
    summary: summaryLines.join(" "),
    dates,
    documents: findDocumentNames(text),
    eligibility: eligibilityLine ? trimSentence(eligibilityLine, 260) : "",
    tasks,
    details,
  };
}

function relatedDate(dates, pattern) {
  return dates.find((date) => pattern.test(date.sentence)) || null;
}

function trimSentence(value, maxLength) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trimEnd()}…` : normalized;
}

function cleanLabel(value) {
  return value.replace(/^[\s:–—-]+|[\s:–—-]+$/g, "").replace(/\s+/g, " ");
}

function renderAnalysis(notice) {
  document.querySelector("#result-source").textContent = notice.source === "Demo notice" ? "DEMO NOTICE · LOCAL" : `${notice.source.toUpperCase()} · LOCAL`;
  document.querySelector("#results-title").innerHTML = `${escapeHtml(notice.title)}, <span>made clear.</span>`;
  document.querySelector("#notice-title").textContent = notice.title;
  document.querySelector("#notice-type").textContent = notice.noticeType;
  document.querySelector("#notice-issued-by").textContent = notice.issuer || "Issuer not found in notice";
  document.querySelector("#notice-issue-date").textContent = notice.issueDate || "Issue date not found";
  document.querySelector("#confidence-label").textContent = "Rule-based · local";
  document.querySelector("#summary-text").textContent = notice.summary;
  document.querySelector("#eligibility-text").textContent = notice.eligibility || "No eligibility criteria could be confidently identified in this notice.";
  renderTasks(notice);
  renderTimeline(notice.dates);
  renderDocuments(notice.documents);
  renderImportantDetails(notice.details);
  renderActionPlan(notice);
  answerBox.hidden = true;
  answerBox.textContent = "";
  questionInput.value = "";
  document.querySelector("#suggested-questions").querySelectorAll("button").forEach((button) => {
    button.onclick = () => answerQuestion(button.textContent);
  });
}

function renderTasks(notice) {
  const container = document.querySelector("#task-list");
  document.querySelector("#action-count").textContent = `${notice.tasks.length} found`;
  if (!notice.tasks.length) {
    container.innerHTML = '<p class="empty-inline">No specific actions could be confidently identified in this notice.</p>';
    return;
  }
  container.innerHTML = notice.tasks.map((task, index) => {
    const urgency = task.deadline ? task.deadline.urgency : { label: "NO DEADLINE", className: "urgency-none" };
    const deadlineLabel = task.deadline ? task.deadline.label : "Not specified";
    const documentsLabel = task.documents.length ? task.documents.map(escapeHtml).join(", ") : "Not specified";
    return `<div class="task-card"><div class="task-topline"><span class="task-number">${String(index + 1).padStart(2, "0")}</span><h4>${escapeHtml(task.title)}</h4><span class="urgency ${urgency.className}">${urgency.label}</span></div><div class="task-meta"><span>◷ Deadline: <strong>${escapeHtml(deadlineLabel)}</strong></span><span>▤ Documents: ${documentsLabel}</span><span>Status: <strong>Pending</strong></span></div></div>`;
  }).join("");
}

function renderTimeline(dates) {
  const container = document.querySelector("#timeline-list");
  const empty = document.querySelector("#timeline-empty");
  empty.hidden = dates.length > 0;
  container.hidden = dates.length === 0;
  container.innerHTML = dates.map((date) => `<div class="timeline-item ${date.urgency.className === "urgency-urgent" ? "is-urgent" : ""}"><span class="timeline-rail"><i class="timeline-dot"></i></span><span class="timeline-copy"><strong>${escapeHtml(date.event)}</strong><span>${date.isDeadline ? "Deadline" : "Date mentioned"} · ${escapeHtml(date.sentence)}</span></span><time class="timeline-date" datetime="${date.iso}">${escapeHtml(date.label)}</time></div>`).join("");
}

function renderDocuments(documents) {
  const list = document.querySelector("#document-list");
  document.querySelector("#documents-empty").hidden = documents.length > 0;
  list.hidden = documents.length === 0;
  list.innerHTML = documents.map((document) => `<li><span class="doc-check" aria-hidden="true"></span>${escapeHtml(document)}</li>`).join("");
}

function renderImportantDetails(details) {
  const labels = [["Fees", details.fee], ["Venue / submission", details.venue], ["Reporting time", details.reporting], ["Contact", details.contact], ["Office / department", details.department], ["Instructions", details.instructions.join(" ") ]];
  const found = labels.filter(([, value]) => value);
  const container = document.querySelector("#important-details");
  container.innerHTML = found.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(trimSentence(value, 160))}</dd></div>`).join("");
  document.querySelector("#details-empty").hidden = found.length > 0;
}

function renderActionPlan(notice) {
  const container = document.querySelector("#plan-list");
  if (!notice.tasks.length) {
    container.innerHTML = '<p class="empty-inline">No checklist items are available for this notice yet.</p>';
    updateProgress(notice);
    return;
  }
  container.innerHTML = notice.tasks.map((task) => `<label class="plan-row ${task.done ? "is-complete" : ""}"><input type="checkbox" data-task-id="${escapeHtml(task.id)}" ${task.done ? "checked" : ""}><span>${escapeHtml(task.title)}</span></label>`).join("");
  container.querySelectorAll("input[type=checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const task = activeNotice.tasks.find((item) => item.id === checkbox.dataset.taskId);
      if (!task) return;
      task.done = checkbox.checked;
      checkbox.closest(".plan-row").classList.toggle("is-complete", task.done);
      updateProgress(activeNotice);
      persistActiveNotice();
    });
  });
  updateProgress(notice);
}

function updateProgress(notice) {
  const total = notice.tasks.length;
  const complete = notice.tasks.filter((task) => task.done).length;
  const percent = total ? Math.round((complete / total) * 100) : 0;
  document.querySelector("#progress-label").textContent = `${complete} of ${total} tasks completed`;
  document.querySelector("#progress-percent").textContent = `${percent}%`;
  document.querySelector("#progress-fill").style.width = `${percent}%`;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", String(percent));
}

function persistActiveNotice() {
  if (!activeNotice) return;
  history = history.map((notice) => notice.id === activeNotice.id ? activeNotice : notice);
  persistHistory();
  renderHistory();
}

function answerQuestion(question) {
  if (!activeNotice) return;
  const query = question.toLowerCase();
  const sentences = splitSentences(activeNotice.text);
  let matches = [];
  if (/when|deadline|date|due|last day|last date/.test(query)) {
    matches = sentences.filter((line) => findDates(line).length && /\b(?:by|before|deadline|last date|no later than)\b/i.test(line));
  } else if (/document|bring|need to submit|prepare/.test(query)) {
    matches = sentences.filter((line) => DOCUMENTS.some(([, pattern]) => pattern.test(line)));
  } else if (/who|eligible|semester|year|course|student/.test(query)) {
    matches = sentences.filter((line) => /eligible|student|semester|year|course|applicable/i.test(line));
  } else if (/fee|cost|amount|pay|price/.test(query)) {
    matches = sentences.filter((line) => /₹|rs\.?|rupees|fee|amount/i.test(line) && /\d/.test(line));
  } else if (/where|venue|submit|office|department/.test(query)) {
    matches = sentences.filter((line) => /venue|where|submit|portal|office|department/i.test(line));
  } else if (/contact|email|phone|call/.test(query)) {
    matches = sentences.filter((line) => /contact|reach out|email|phone|call/i.test(line));
  } else {
    const terms = query.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((word) => word.length > 3);
    matches = sentences.filter((line) => terms.some((term) => line.toLowerCase().includes(term)));
  }
  const answer = matches.length ? [...new Set(matches)].slice(0, 3).join(" ") : "I couldn't find this information in the uploaded notice.";
  answerBox.classList.toggle("is-not-found", !matches.length);
  answerBox.innerHTML = `<strong>${matches.length ? "From the notice" : "Not found in the notice"}</strong>${escapeHtml(answer)}`;
  answerBox.hidden = false;
}

questionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (question) answerQuestion(question);
});

document.querySelector("#new-analysis").addEventListener("click", () => {
  results.hidden = true;
  document.querySelector("#analyze").scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#tab-paste").click();
  pastedText.focus();
});

function renderHistory() {
  historyCount.textContent = String(history.length);
  if (!history.length) {
    historyGrid.innerHTML = '<div class="history-empty"><span aria-hidden="true">▤</span><h3>No notices just yet.</h3><p>Analyze your first notice or try the demo to see it here.</p><a class="text-link" href="#analyze">Analyze a notice <span aria-hidden="true">↗</span></a></div>';
    return;
  }
  historyGrid.innerHTML = history.map((notice) => {
    const deadline = (notice.dates || []).filter((date) => date.isDeadline).sort((a, b) => a.iso.localeCompare(b.iso))[0];
    const pending = (notice.tasks || []).filter((task) => !task.done).length;
    const dateAnalyzed = new Date(notice.analyzedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    return `<article class="history-card" data-history-id="${escapeHtml(notice.id)}"><div class="history-card-top"><span class="history-card-icon" aria-hidden="true">▤</span><div style="min-width:0"><h3 title="${escapeHtml(notice.title)}">${escapeHtml(notice.title)}</h3><small>Analyzed ${escapeHtml(dateAnalyzed)}</small></div><button class="history-card-menu" type="button" data-delete-notice="${escapeHtml(notice.id)}" aria-label="Delete ${escapeHtml(notice.title)}">×</button></div><div class="history-card-facts"><span>Deadline: <strong>${escapeHtml(deadline ? deadline.label : "Not found")}</strong></span><span>·</span><span><strong>${pending}</strong> pending ${pending === 1 ? "action" : "actions"}</span></div><div class="history-card-actions"><span class="history-status ${pending ? "has-pending" : ""}">${pending ? "In progress" : "All done"}</span><span><button class="history-open" type="button" data-open-notice="${escapeHtml(notice.id)}">Open</button><button class="history-delete" type="button" data-delete-notice="${escapeHtml(notice.id)}">Delete</button></span></div></article>`;
  }).join("");

  historyGrid.querySelectorAll("[data-open-notice]").forEach((button) => {
    button.addEventListener("click", () => {
      const notice = history.find((item) => item.id === button.dataset.openNotice);
      if (!notice) return;
      activeNotice = notice;
      renderAnalysis(notice);
      results.hidden = false;
      document.querySelector("#analyze").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  historyGrid.querySelectorAll("[data-delete-notice]").forEach((button) => {
    button.addEventListener("click", () => {
      history = history.filter((item) => item.id !== button.dataset.deleteNotice);
      if (activeNotice?.id === button.dataset.deleteNotice) {
        activeNotice = null;
        results.hidden = true;
      }
      persistHistory();
      renderHistory();
    });
  });
}

document.querySelector("#my-notices").addEventListener("click", (event) => {
  if (event.target.matches(".history-empty .text-link")) setMenuOpen(false);
});
