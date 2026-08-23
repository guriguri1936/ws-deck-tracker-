"use strict";

/* キャノニカル順(表示順)。docs/js/common.js, admin/js/admin.js, admin/js/deck-images.js と同じ並びで同期させること。 */
var CM_CLIMAX_OPTIONS = ["袋", "扉", "風", "本", "ショット", "宝", "門", "電源", "枝", "筒", "チャンス", "フォーカス", "+2"];

var CM_TYPE_OPTIONS = [
  { value: "character", label: "キャラ" },
  { value: "event", label: "イベント" },
  { value: "climax", label: "クライマックス" }
];

var cmState = {
  /* 統合カードマスタ。 { name, type: "character"|"event"|"climax", level: number|null, climaxType: string|null, imageUrl: string } */
  cards: []
};

function cmNormalizeName(name) {
  return String(name || "").replace(/[ 　\t]+/g, " ").trim();
}

function cmTypeLabel(type) {
  var found = CM_TYPE_OPTIONS.filter(function (o) { return o.value === type; })[0];
  return found ? found.label : (type || "-");
}

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

/* 大会結果入力タブの一括貼り付け解析から呼ばれる。登録済みカードのうち種別が
   クライマックスのものと名前が一致すれば、そのクライマックス種別を返す(未登録・非クライマックスは null)。 */
function findClimaxForCardName(name) {
  var normalized = cmNormalizeName(name);
  if (!normalized) return null;
  var match = cmState.cards.filter(function (c) {
    return c.type === "climax" && cmNormalizeName(c.name) === normalized;
  })[0];
  return match ? match.climaxType : null;
}

/* ---------- 一括登録 ---------- */

function cmResolveType(raw) {
  var v = String(raw || "").trim();
  if (!v) return null;
  var byValue = CM_TYPE_OPTIONS.filter(function (o) { return o.value === v; })[0];
  if (byValue) return byValue.value;
  var byLabel = CM_TYPE_OPTIONS.filter(function (o) { return o.label === v; })[0];
  return byLabel ? byLabel.value : null;
}

/* 一括登録テキストを解析する。1行1件、タブまたはカンマ区切りで
   カード名・種別(character/event/climax またはキャラ/イベント/クライマックス)・
   レベル(キャラ/イベント)またはクライマックス種別・画像URL(任意)の順。
   #で始まる行、空行は無視する。 */
function parseCmBulkText(text) {
  var lines = String(text || "").split(/\r?\n/);
  var entries = [];
  var errors = [];

  lines.forEach(function (raw) {
    var line = raw.trim();
    if (!line || line.charAt(0) === "#") return;

    var cols = line.indexOf("\t") !== -1 ? line.split("\t") : line.split(",");
    cols = cols.map(function (c) { return c.trim(); });

    var name = cmNormalizeName(cols[0]);
    if (!name) { errors.push({ raw: raw, reason: "カード名が空です" }); return; }

    var type = cmResolveType(cols[1]);
    if (!type) { errors.push({ raw: raw, reason: "種別が不明です(キャラ/イベント/クライマックス、またはcharacter/event/climaxで指定してください)" }); return; }

    var thirdRaw = cols[2] || "";
    var level = null;
    var climaxType = null;
    if (type === "climax") {
      if (!thirdRaw) { errors.push({ raw: raw, reason: "クライマックス種別を指定してください" }); return; }
      if (CM_CLIMAX_OPTIONS.indexOf(thirdRaw) === -1) { errors.push({ raw: raw, reason: "クライマックス種別「" + thirdRaw + "」は選択肢にありません" }); return; }
      climaxType = thirdRaw;
    } else if (thirdRaw) {
      var levelNum = parseInt(thirdRaw, 10);
      if (isNaN(levelNum) || levelNum < 0) { errors.push({ raw: raw, reason: "レベルは0以上の整数で指定してください" }); return; }
      level = levelNum;
    }

    var imageUrl = cols[3] || "";
    if (imageUrl && !isHttpUrl(imageUrl)) { errors.push({ raw: raw, reason: "画像URLはhttp(s)://で始めてください" }); return; }

    entries.push({ name: name, type: type, level: level, climaxType: climaxType, imageUrl: imageUrl });
  });

  return { entries: entries, errors: errors };
}

function onCmBulkAdd() {
  var textarea = document.getElementById("cmBulkText");
  var statusPanel = document.getElementById("cmBulkStatus");
  statusPanel.innerHTML = "";

  var result = parseCmBulkText(textarea.value);
  if (result.entries.length === 0 && result.errors.length === 0) return;

  var duplicates = result.entries.filter(function (e) {
    return cmState.cards.some(function (c) { return cmNormalizeName(c.name) === cmNormalizeName(e.name); });
  });

  if (duplicates.length > 0) {
    var ok = window.confirm(duplicates.length + "件が既存のカード名と重複しています。上書きしますか？(いいえの場合、重複分はスキップして新規分のみ登録します)");
    if (!ok) {
      result.entries = result.entries.filter(function (e) { return duplicates.indexOf(e) === -1; });
    }
  }

  var addedCount = 0;
  var updatedCount = 0;
  result.entries.forEach(function (e) {
    var existingIdx = -1;
    cmState.cards.forEach(function (c, idx) {
      if (cmNormalizeName(c.name) === cmNormalizeName(e.name)) existingIdx = idx;
    });
    if (existingIdx !== -1) {
      cmState.cards[existingIdx] = e;
      updatedCount++;
    } else {
      cmState.cards.push(e);
      addedCount++;
    }
  });

  renderCardMasterList();
  updateCmCount();

  var summary = document.createElement("div");
  summary.textContent = "新規登録" + addedCount + "件・上書き" + updatedCount + "件";
  statusPanel.appendChild(summary);

  if (result.errors.length > 0) {
    var errDiv = document.createElement("div");
    errDiv.className = "bulk-errors";
    var title = document.createElement("div");
    title.textContent = "解析できなかった行:";
    errDiv.appendChild(title);
    var ul = document.createElement("ul");
    result.errors.forEach(function (e) {
      var li = document.createElement("li");
      li.textContent = e.raw + " ― " + e.reason;
      ul.appendChild(li);
    });
    errDiv.appendChild(ul);
    statusPanel.appendChild(errDiv);
  }

  textarea.value = "";
}

/* ---------- select / list rendering ---------- */

function buildCmTypeSelect(selectEl) {
  selectEl.innerHTML = "";
  CM_TYPE_OPTIONS.forEach(function (opt) {
    var el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    selectEl.appendChild(el);
  });
}

function buildCmClimaxTypeSelect(selectEl) {
  selectEl.innerHTML = "";
  var blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "(選択してください)";
  selectEl.appendChild(blank);
  CM_CLIMAX_OPTIONS.forEach(function (name) {
    var opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  });
}

function updateCmClimaxFieldVisibility() {
  var typeSelect = document.getElementById("cmType");
  var climaxRow = document.getElementById("cmClimaxTypeRow");
  var levelRow = document.getElementById("cmLevelRow");
  var isClimax = typeSelect.value === "climax";
  climaxRow.style.display = isClimax ? "flex" : "none";
  levelRow.style.display = isClimax ? "none" : "flex";
}

/* 一覧の「編集」ボタンから呼ばれる。上の登録フォームに既存エントリの内容を入力し直し、
   カード名欄までスクロールする(そのまま「登録」を押せば上書き確認の上で更新される)。
   種別が未設定(仮登録直後など)の場合は先頭の選択肢を仮に表示する。 */
function fillCmFormForEdit(entry) {
  document.getElementById("cmName").value = entry.name;
  var typeSelect = document.getElementById("cmType");
  typeSelect.value = entry.type || "character";
  updateCmClimaxFieldVisibility();
  document.getElementById("cmLevel").value = (entry.level === null || entry.level === undefined) ? "" : entry.level;
  document.getElementById("cmClimaxType").value = entry.climaxType || "";
  document.getElementById("cmUrl").value = entry.imageUrl || "";
  document.getElementById("cmName").scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderCardMasterList() {
  var tbody = document.getElementById("cmListBody");
  var empty = document.getElementById("cmListEmpty");
  tbody.innerHTML = "";

  if (cmState.cards.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  cmState.cards.forEach(function (entry, idx) {
    var tr = document.createElement("tr");

    var tdThumb = document.createElement("td");
    if (isHttpUrl(entry.imageUrl)) {
      var img = document.createElement("img");
      img.src = entry.imageUrl;
      img.alt = "";
      img.className = "img-thumb";
      img.addEventListener("error", function () { img.style.display = "none"; });
      tdThumb.appendChild(img);
    }
    tr.appendChild(tdThumb);

    var tdName = document.createElement("td");
    tdName.textContent = entry.name;
    tr.appendChild(tdName);

    var tdType = document.createElement("td");
    tdType.textContent = cmTypeLabel(entry.type);
    tr.appendChild(tdType);

    var tdLevel = document.createElement("td");
    tdLevel.textContent = entry.type === "climax" ? "-" : (entry.level === null || entry.level === undefined ? "-" : String(entry.level));
    tr.appendChild(tdLevel);

    var tdClimaxType = document.createElement("td");
    tdClimaxType.textContent = entry.type === "climax" ? (entry.climaxType || "-") : "-";
    tr.appendChild(tdClimaxType);

    var tdActions = document.createElement("td");
    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-small";
    editBtn.textContent = "編集";
    editBtn.addEventListener("click", function () { fillCmFormForEdit(entry); });
    tdActions.appendChild(editBtn);

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-small btn-danger";
    removeBtn.textContent = "削除";
    removeBtn.addEventListener("click", function () {
      cmState.cards.splice(idx, 1);
      renderCardMasterList();
      updateCmCount();
    });
    tdActions.appendChild(removeBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

function updateCmCount() {
  document.getElementById("cmCount").textContent = cmState.cards.length + "件 登録済み";
}

/* ---------- add / load / download ---------- */

function onCmAdd() {
  var nameInput = document.getElementById("cmName");
  var typeSelect = document.getElementById("cmType");
  var levelInput = document.getElementById("cmLevel");
  var climaxTypeSelect = document.getElementById("cmClimaxType");
  var urlInput = document.getElementById("cmUrl");
  var errorPanel = document.getElementById("cmFormError");

  var name = cmNormalizeName(nameInput.value);
  var type = typeSelect.value;
  var levelVal = levelInput.value.trim();
  var level = levelVal === "" ? null : parseInt(levelVal, 10);
  var climaxType = type === "climax" ? climaxTypeSelect.value : "";
  var imageUrl = urlInput.value.trim();

  var errors = [];
  if (!name) errors.push("カード名を入力してください");
  if (type === "climax" && !climaxType) errors.push("クライマックス種別を選択してください");
  if (type !== "climax" && levelVal !== "" && (isNaN(level) || level < 0)) errors.push("レベルは0以上の整数で入力してください");
  if (imageUrl && !isHttpUrl(imageUrl)) errors.push("画像URLはhttp(s)://で始めてください");

  if (errors.length > 0) {
    errorPanel.style.display = "block";
    errorPanel.innerHTML = "";
    var ul = document.createElement("ul");
    errors.forEach(function (e) {
      var li = document.createElement("li");
      li.textContent = e;
      ul.appendChild(li);
    });
    errorPanel.appendChild(ul);
    return;
  }
  errorPanel.style.display = "none";
  errorPanel.innerHTML = "";

  var newEntry = {
    name: name,
    type: type,
    level: type === "climax" ? null : (levelVal === "" ? null : level),
    climaxType: type === "climax" ? climaxType : null,
    imageUrl: imageUrl
  };

  var existingIdx = -1;
  cmState.cards.forEach(function (entry, idx) {
    if (cmNormalizeName(entry.name) === name) existingIdx = idx;
  });

  if (existingIdx !== -1) {
    var ok = window.confirm("「" + name + "」は既に登録されています。内容を上書きしますか？");
    if (!ok) return;
    cmState.cards[existingIdx] = newEntry;
  } else {
    cmState.cards.push(newEntry);
  }

  nameInput.value = "";
  levelInput.value = "";
  urlInput.value = "";
  climaxTypeSelect.value = "";
  renderCardMasterList();
  updateCmCount();
}

function onCmLoadFile(evt) {
  var file = evt.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    var status = document.getElementById("cmLoadStatus");
    try {
      var data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("配列(JSON array)ではありません");
      cmState.cards = data;
      renderCardMasterList();
      updateCmCount();
      status.style.color = "";
      status.textContent = file.name + " を読み込みました";
    } catch (err) {
      status.style.color = "#b60000";
      status.textContent = "読み込み失敗: " + err.message;
    }
  };
  reader.readAsText(file, "utf-8");
}

function onCmDownload() {
  var filename = "cards.json";
  var blob = new Blob([JSON.stringify(cmState.cards, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

/* ---------- init ---------- */

function initCardMaster() {
  buildCmTypeSelect(document.getElementById("cmType"));
  buildCmClimaxTypeSelect(document.getElementById("cmClimaxType"));
  updateCmClimaxFieldVisibility();
  document.getElementById("cmType").addEventListener("change", updateCmClimaxFieldVisibility);
  document.getElementById("cmFileInput").addEventListener("change", onCmLoadFile);
  document.getElementById("cmAddBtn").addEventListener("click", onCmAdd);
  document.getElementById("cmBulkAddBtn").addEventListener("click", onCmBulkAdd);
  document.getElementById("cmDownloadBtn").addEventListener("click", onCmDownload);
  renderCardMasterList();
  updateCmCount();
}

document.addEventListener("DOMContentLoaded", initCardMaster);
