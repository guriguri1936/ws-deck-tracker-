"use strict";

/* キャノニカル順(表示順)。docs/js/main.js, admin/js/deck-images.js と同じ並びで同期させること。 */
var CLIMAX_OPTIONS = ["袋", "扉", "風", "本", "ショット", "宝", "門", "電源", "枝", "筒", "チャンス", "フォーカス", "+2"];

var state = {
  tournaments: [],
  currentFormat: "single",
  nextTop4TeamNo: 3
};

/* 「結果の個別修正」パネルで、現在どの大会(state.tournaments のインデックス)を
   開いているか。null ならパネルは非表示。 */
var resultEditState = { tournamentIdx: null };

/* ---------- bulk paste parser ---------- */

var BULK_PATTERNS = [
  { re: /^(\d+)\s*[xX×]\s*(.+)$/, countFirst: true },
  { re: /^(.+?)\s*[xX×]\s*(\d+)$/, countFirst: false },
  { re: /^(\d+)\s*枚\s*(.+)$/, countFirst: true },
  { re: /^(.+?)\s*(\d+)\s*枚$/, countFirst: false },
  { re: /^(\d+)[\s\t　]+(.+)$/, countFirst: true },
  { re: /^(.+?)[\t　]+(\d+)$/, countFirst: false }
];

function normalizeName(name) {
  return String(name || "").replace(/[ 　\t]+/g, " ").trim();
}

function parseBulkCardText(text) {
  var lines = String(text || "").split(/\r\n|\r|\n/);
  var cardMap = {};
  var order = [];
  var mergeCounts = {};
  var errors = [];

  lines.forEach(function (rawLine) {
    var line = rawLine.trim();
    if (line === "") return;
    if (line.charAt(0) === "#") return;

    var matched = null;
    for (var i = 0; i < BULK_PATTERNS.length; i++) {
      var m = line.match(BULK_PATTERNS[i].re);
      if (m) {
        var countStr, nameStr;
        if (BULK_PATTERNS[i].countFirst) { countStr = m[1]; nameStr = m[2]; }
        else { nameStr = m[1]; countStr = m[2]; }
        matched = { name: nameStr, count: countStr };
        break;
      }
    }

    if (!matched) {
      errors.push({ raw: rawLine, reason: "解釈できませんでした" });
      return;
    }

    var countNum = parseInt(matched.count, 10);
    if (!countNum || countNum <= 0) {
      errors.push({ raw: rawLine, reason: "枚数が0以下です" });
      return;
    }

    var name = normalizeName(matched.name);
    if (!name) {
      errors.push({ raw: rawLine, reason: "カード名が空です" });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(cardMap, name)) {
      cardMap[name] += countNum;
      mergeCounts[name] = (mergeCounts[name] || 1) + 1;
    } else {
      cardMap[name] = countNum;
      order.push(name);
    }
  });

  var cards = order.map(function (name) { return { name: name, count: cardMap[name] }; });
  var merges = Object.keys(mergeCounts).map(function (name) {
    return { name: name, occurrences: mergeCounts[name] };
  });

  return { cards: cards, errors: errors, merges: merges };
}

/* ---------- id suggestion ---------- */

function generateId(date) {
  if (!date) return "";
  var count = state.tournaments.filter(function (t) { return t.date === date; }).length;
  var seq = String(count + 1).padStart(3, "0");
  return date + "-" + seq;
}

/* ---------- card section (table + bulk paste) ---------- */

function createCardRow(name, count) {
  var tr = document.createElement("tr");

  var tdName = document.createElement("td");
  var nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "card-name";
  nameInput.value = name || "";
  nameInput.placeholder = "カード名";
  tdName.appendChild(nameInput);

  var tdCount = document.createElement("td");
  var countInput = document.createElement("input");
  countInput.type = "number";
  countInput.className = "card-count";
  countInput.min = "1";
  countInput.value = count || "";
  countInput.placeholder = "枚数";
  tdCount.appendChild(countInput);

  var tdRemove = document.createElement("td");
  var removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-small btn-danger";
  removeBtn.textContent = "削除";
  removeBtn.addEventListener("click", function () { tr.remove(); });
  tdRemove.appendChild(removeBtn);

  tr.appendChild(tdName);
  tr.appendChild(tdCount);
  tr.appendChild(tdRemove);
  return tr;
}

/* カードリストから登録済みクライマックスカードを検出し、climaxContainer内の
   該当チェックボックスにチェックを入れる(検出できなかった種別は変更しない)。
   検出した種別の一覧(表示用配列)を返す。 */
function applyAutoDetectedClimax(climaxContainer, cards) {
  if (!climaxContainer || typeof findClimaxForCardName !== "function") return [];
  var detected = {};
  cards.forEach(function (c) {
    var type = findClimaxForCardName(c.name);
    if (type) detected[type] = true;
  });
  climaxContainer.querySelectorAll(".slot-climax").forEach(function (cb) {
    cb.checked = !!detected[cb.value];
  });
  return CLIMAX_OPTIONS.filter(function (name) { return detected[name]; });
}

function createCardSection(climaxContainer) {
  var cardSection = document.createElement("div");
  cardSection.className = "card-section";

  var table = document.createElement("table");
  table.className = "card-table";
  var thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>カード名</th><th>枚数</th><th></th></tr>";
  var tbody = document.createElement("tbody");
  table.appendChild(thead);
  table.appendChild(tbody);

  var addCardBtn = document.createElement("button");
  addCardBtn.type = "button";
  addCardBtn.className = "btn-small";
  addCardBtn.textContent = "カード行を追加";
  addCardBtn.addEventListener("click", function () {
    tbody.appendChild(createCardRow("", ""));
  });

  var bulkWrap = document.createElement("div");
  bulkWrap.className = "bulk-wrap";
  var bulkLabel = document.createElement("label");
  bulkLabel.textContent = "一括貼り付け(例: 4x カード名 / カード名 x4 / 4枚 カード名 / 4 カード名 / # で始まる行は無視)";
  var bulkTextarea = document.createElement("textarea");
  bulkTextarea.rows = 5;
  bulkLabel.appendChild(bulkTextarea);

  var parseBtn = document.createElement("button");
  parseBtn.type = "button";
  parseBtn.className = "btn-small";
  parseBtn.textContent = "解析してカード表に反映";

  var statusPanel = document.createElement("div");
  statusPanel.className = "bulk-status";

  parseBtn.addEventListener("click", function () {
    var hasExisting = tbody.querySelectorAll("tr").length > 0;
    if (hasExisting) {
      var ok = window.confirm("既存のカード表を解析結果で置き換えます。よろしいですか？");
      if (!ok) return;
    }
    var result = parseBulkCardText(bulkTextarea.value);
    tbody.innerHTML = "";
    result.cards.forEach(function (c) {
      tbody.appendChild(createCardRow(c.name, c.count));
    });
    var detectedClimax = applyAutoDetectedClimax(climaxContainer, result.cards);

    statusPanel.innerHTML = "";
    if (detectedClimax.length > 0) {
      var climaxDiv = document.createElement("div");
      climaxDiv.className = "bulk-climax-detected";
      climaxDiv.textContent = "クライマックスを自動検出: " + detectedClimax.join(", ") + "(手動で修正できます)";
      statusPanel.appendChild(climaxDiv);
    }
    if (result.merges.length > 0) {
      var mergeDiv = document.createElement("div");
      mergeDiv.className = "bulk-merges";
      mergeDiv.textContent = "重複合算: " + result.merges.map(function (m) {
        return m.name + "(" + m.occurrences + "件)";
      }).join(", ");
      statusPanel.appendChild(mergeDiv);
    }
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
  });

  bulkWrap.appendChild(bulkLabel);
  bulkWrap.appendChild(parseBtn);
  bulkWrap.appendChild(statusPanel);

  var photoWrap = document.createElement("div");
  photoWrap.className = "photo-url-wrap";
  var photoLabel = document.createElement("label");
  photoLabel.textContent = "デッキ画像URL(任意・カードを1枚ずつ入力できない場合の代替。Xの画像URLなど)";
  var photoInput = document.createElement("input");
  photoInput.type = "text";
  photoInput.className = "slot-photo-url";
  photoInput.placeholder = "https://...";
  photoLabel.appendChild(photoInput);
  photoWrap.appendChild(photoLabel);

  cardSection.appendChild(table);
  cardSection.appendChild(addCardBtn);
  cardSection.appendChild(bulkWrap);
  cardSection.appendChild(photoWrap);

  return cardSection;
}

/* ---------- player slot (1人分の入力) ---------- */

function createPlayerSlot(rank, team) {
  var slot = document.createElement("div");
  slot.className = "player-slot";
  slot.dataset.rank = String(rank);
  if (team) slot.dataset.team = String(team);

  var header = document.createElement("div");
  header.className = "player-slot-header";

  var titleLabel = document.createElement("label");
  titleLabel.textContent = "デッキタイトル";
  var titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "slot-deck-title";
  titleInput.setAttribute("list", "deckTitleList");
  titleInput.setAttribute("autocomplete", "off");
  titleLabel.appendChild(titleInput);

  header.appendChild(titleLabel);
  slot.appendChild(header);

  var climaxWrap = document.createElement("div");
  climaxWrap.className = "climax-picker";
  var climaxLabel = document.createElement("div");
  climaxLabel.className = "climax-picker-label";
  climaxLabel.textContent = "クライマックス構成(任意・複数選択可)";
  climaxWrap.appendChild(climaxLabel);

  var climaxOptions = document.createElement("div");
  climaxOptions.className = "climax-options";
  CLIMAX_OPTIONS.forEach(function (name) {
    var optLabel = document.createElement("label");
    optLabel.className = "climax-option";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = name;
    cb.className = "slot-climax";
    optLabel.appendChild(cb);
    optLabel.appendChild(document.createTextNode(name));
    climaxOptions.appendChild(optLabel);
  });
  climaxWrap.appendChild(climaxOptions);
  slot.appendChild(climaxWrap);

  slot.appendChild(createCardSection(climaxOptions));

  return slot;
}

/* ---------- team group (トリオ: 3人1組) ---------- */

function createTeamGroup(rank, teamNumber, removable) {
  var group = document.createElement("div");
  group.className = "team-group";
  group.dataset.team = String(teamNumber);

  var header = document.createElement("div");
  header.className = "team-group-header";
  var label = document.createElement("span");
  label.textContent = "チーム(3人)";
  header.appendChild(label);
  if (removable) {
    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-small btn-danger";
    removeBtn.textContent = "このチームを削除";
    removeBtn.addEventListener("click", function () { group.remove(); });
    header.appendChild(removeBtn);
  }
  group.appendChild(header);

  for (var i = 0; i < 3; i++) {
    group.appendChild(createPlayerSlot(rank, teamNumber));
  }
  return group;
}

function createSingleTop4Unit() {
  var wrapper = document.createElement("div");
  wrapper.className = "top4-single-unit";
  var slot = createPlayerSlot(3, null);
  var removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-small btn-danger";
  removeBtn.textContent = "この枠を削除";
  removeBtn.addEventListener("click", function () { wrapper.remove(); });
  wrapper.appendChild(slot);
  wrapper.appendChild(removeBtn);
  return wrapper;
}

/* ---------- 結果セクション全体の構築 ---------- */

function createFixedTier(label, rank, format) {
  var section = document.createElement("div");
  section.className = "result-tier";
  var h3 = document.createElement("h3");
  h3.textContent = label;
  section.appendChild(h3);

  var body = document.createElement("div");
  body.className = "tier-body";
  if (format === "trio") {
    body.appendChild(createTeamGroup(rank, rank, false));
  } else {
    body.appendChild(createPlayerSlot(rank, null));
  }
  section.appendChild(body);
  return section;
}

function createTop4Tier(format) {
  var section = document.createElement("div");
  section.className = "result-tier";
  var h3 = document.createElement("h3");
  h3.textContent = "TOP4";
  section.appendChild(h3);

  var unitsContainer = document.createElement("div");
  unitsContainer.className = "top4-units";
  section.appendChild(unitsContainer);

  state.nextTop4TeamNo = 3;

  var addUnit = function () {
    if (format === "trio") {
      var teamNo = state.nextTop4TeamNo++;
      unitsContainer.appendChild(createTeamGroup(3, teamNo, true));
    } else {
      unitsContainer.appendChild(createSingleTop4Unit());
    }
  };

  var addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-small";
  addBtn.textContent = format === "trio" ? "+ TOP4チームを追加" : "+ TOP4を追加";
  addBtn.addEventListener("click", addUnit);
  section.appendChild(addBtn);

  addUnit();
  addUnit();

  return section;
}

function buildResultTiers(format) {
  var container = document.getElementById("resultTiersContainer");
  container.innerHTML = "";
  container.appendChild(createFixedTier("優勝", 1, format));
  container.appendChild(createFixedTier("準優勝", 2, format));
  container.appendChild(createTop4Tier(format));
}

function resultTiersHaveData() {
  var container = document.getElementById("resultTiersContainer");
  var inputs = container.querySelectorAll("input[type=text], textarea, input[type=number]");
  for (var i = 0; i < inputs.length; i++) {
    if (inputs[i].value.trim() !== "") return true;
  }
  return container.querySelectorAll("input[type=checkbox]:checked").length > 0;
}

/* ---------- 結果1件分の入力欄 ⇔ result オブジェクトの相互変換 ---------- */

/* player-slot 1個から result オブジェクトを組み立てる。エラーは呼び出し側から
   渡された errors 配列に文字列を追記する形で報告する(呼び出し側でまとめて判定する)。 */
function extractResultFromSlot(slot, rank, team, slotLabel, errors) {
  var deckTitle = slot.querySelector(".slot-deck-title").value.trim();
  var climax = [];
  slot.querySelectorAll(".slot-climax:checked").forEach(function (cb) {
    climax.push(cb.value);
  });

  if (!deckTitle) errors.push(slotLabel + ": デッキタイトルを入力してください");

  var photoUrl = slot.querySelector(".slot-photo-url").value.trim();
  if (photoUrl && !isHttpUrl(photoUrl)) errors.push(slotLabel + ": デッキ画像URLはhttp(s)://で始めてください");

  var cards = [];
  slot.querySelectorAll(".card-table tbody tr").forEach(function (tr, cIdx) {
    var name = tr.querySelector(".card-name").value.trim();
    var countVal = tr.querySelector(".card-count").value;
    var count = parseInt(countVal, 10);
    if (!name && !countVal) return;
    if (!name) { errors.push(slotLabel + " カード行" + (cIdx + 1) + ": カード名が空です"); return; }
    if (!count || count <= 0) { errors.push(slotLabel + " カード行" + (cIdx + 1) + ": 枚数が0以下です"); return; }
    cards.push({ name: name, count: count });
  });

  var result = {
    rank: rank,
    deckTitle: deckTitle,
    climax: climax,
    cards: cards
  };
  if (team) result.team = team;
  if (photoUrl) result.photoUrl = photoUrl;
  return result;
}

/* 既存の result オブジェクトの内容を player-slot の入力欄に読み込み直す(個別修正の編集フォーム用)。 */
function fillPlayerSlot(slot, result) {
  slot.querySelector(".slot-deck-title").value = result.deckTitle || "";

  var climax = Array.isArray(result.climax) ? result.climax : [];
  slot.querySelectorAll(".slot-climax").forEach(function (cb) {
    cb.checked = climax.indexOf(cb.value) !== -1;
  });

  var tbody = slot.querySelector(".card-table tbody");
  tbody.innerHTML = "";
  (Array.isArray(result.cards) ? result.cards : []).forEach(function (c) {
    tbody.appendChild(createCardRow(c.name, c.count));
  });

  slot.querySelector(".slot-photo-url").value = result.photoUrl || "";
}

/* ---------- form collection / validation ---------- */

function collectFormDataAsTournamentObject() {
  var errors = [];

  var idInput = document.getElementById("eventId");
  var eventNameInput = document.getElementById("eventName");
  var dateInput = document.getElementById("eventDate");
  var organizerTypeInput = document.getElementById("eventOrganizerType");
  var tournamentFormatInput = document.getElementById("eventTournamentFormat");
  var sourceUrlInput = document.getElementById("eventSourceUrl");

  var eventName = eventNameInput.value.trim();
  var date = dateInput.value;
  var organizerType = organizerTypeInput.value;
  var tournamentFormat = tournamentFormatInput.value;
  var id = idInput.value.trim() || generateId(date);

  if (!eventName) errors.push("大会名を入力してください");
  if (!date) errors.push("日付を入力してください");
  if (!organizerType) errors.push("主催区分を選択してください");
  if (!tournamentFormat) errors.push("大会形式を選択してください");

  var slots = document.querySelectorAll("#resultTiersContainer .player-slot");
  if (slots.length === 0) errors.push("結果が入力されていません");

  var rankCounters = {};
  var results = [];

  slots.forEach(function (slot) {
    var rank = Number(slot.dataset.rank);
    var team = slot.dataset.team ? Number(slot.dataset.team) : null;
    rankCounters[rank] = (rankCounters[rank] || 0) + 1;
    var rankName = { 1: "優勝", 2: "準優勝", 3: "TOP4" }[rank] || ("順位" + rank);
    var slotLabel = rankName + " " + rankCounters[rank] + "人目";

    results.push(extractResultFromSlot(slot, rank, team, slotLabel, errors));
  });

  if (errors.length > 0) {
    return { ok: false, errors: errors };
  }

  var tournament = {
    id: id,
    eventName: eventName,
    date: date,
    organizerType: organizerType,
    tournamentFormat: tournamentFormat,
    results: results
  };
  if (sourceUrlInput.value.trim()) tournament.sourceUrl = sourceUrlInput.value.trim();

  return { ok: true, tournament: tournament };
}

function resetForm() {
  document.getElementById("eventId").value = "";
  document.getElementById("eventName").value = "";
  document.getElementById("eventDate").value = "";
  document.getElementById("eventOrganizerType").value = "";
  document.getElementById("eventTournamentFormat").value = "single";
  document.getElementById("eventSourceUrl").value = "";
  state.currentFormat = "single";
  buildResultTiers("single");
}

function updateCounter() {
  document.getElementById("tournamentCount").textContent = state.tournaments.length + "件 読み込み済み";
}

var TOURNAMENT_FORMAT_LABELS = { single: "シングル", trio: "トリオ" };

/* デッキタイトル入力欄のオートコンプリート候補(datalist)を、読み込み済みの大会結果と
   代表画像マスタ(deck-images.js)の両方から集めて更新する。 */
function refreshDeckTitleList() {
  var datalist = document.getElementById("deckTitleList");
  if (!datalist) return;
  var titles = {};

  state.tournaments.forEach(function (t) {
    (t.results || []).forEach(function (r) {
      var title = String(r.deckTitle || "").trim();
      if (title) titles[title] = true;
    });
  });

  if (typeof imgState !== "undefined") {
    imgState.deckImages.forEach(function (entry) {
      var title = String(entry.title || "").trim();
      if (title) titles[title] = true;
    });
  }

  var sorted = Object.keys(titles).sort();
  datalist.innerHTML = "";
  sorted.forEach(function (title) {
    var opt = document.createElement("option");
    opt.value = title;
    datalist.appendChild(opt);
  });
}

function renderTournamentList() {
  var tbody = document.getElementById("tournamentListBody");
  var empty = document.getElementById("tournamentListEmpty");
  tbody.innerHTML = "";

  if (state.tournaments.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  state.tournaments.forEach(function (t, idx) {
    var tr = document.createElement("tr");

    var tdDate = document.createElement("td");
    tdDate.textContent = t.date || "-";
    tr.appendChild(tdDate);

    var tdName = document.createElement("td");
    tdName.textContent = t.eventName || "-";
    tr.appendChild(tdName);

    var tdFormat = document.createElement("td");
    tdFormat.textContent = TOURNAMENT_FORMAT_LABELS[t.tournamentFormat] || t.tournamentFormat || "-";
    tr.appendChild(tdFormat);

    var tdCount = document.createElement("td");
    tdCount.textContent = Array.isArray(t.results) ? t.results.length + "件" : "-";
    tr.appendChild(tdCount);

    var tdActions = document.createElement("td");
    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-small";
    editBtn.textContent = "結果を編集";
    editBtn.addEventListener("click", function () { openResultEditPanel(idx); });
    tdActions.appendChild(editBtn);

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-small btn-danger";
    removeBtn.textContent = "削除";
    removeBtn.addEventListener("click", function () {
      var ok = window.confirm("「" + (t.eventName || "(名称未設定)") + "」(" + (t.date || "-") + ")を削除します。よろしいですか？");
      if (!ok) return;
      state.tournaments.splice(idx, 1);
      if (resultEditState.tournamentIdx === idx) resultEditState.tournamentIdx = null;
      else if (resultEditState.tournamentIdx !== null && resultEditState.tournamentIdx > idx) resultEditState.tournamentIdx--;
      updateCounter();
      renderTournamentList();
      renderResultEditList();
      refreshDeckTitleList();
    });
    tdActions.appendChild(removeBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

/* ---------- 結果の個別修正 ---------- */

function openResultEditPanel(idx) {
  resultEditState.tournamentIdx = idx;
  renderResultEditList();
  document.getElementById("resultEditPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderResultEditList() {
  var panel = document.getElementById("resultEditPanel");
  var label = document.getElementById("resultEditEventLabel");
  var tbody = document.getElementById("resultEditListBody");
  var formWrap = document.getElementById("resultEditFormWrap");
  formWrap.innerHTML = "";
  formWrap.style.display = "none";
  tbody.innerHTML = "";

  if (resultEditState.tournamentIdx === null) {
    panel.style.display = "none";
    return;
  }
  var t = state.tournaments[resultEditState.tournamentIdx];
  if (!t) {
    resultEditState.tournamentIdx = null;
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";
  label.textContent = (t.eventName || "(名称未設定)") + "(" + (t.date || "-") + ")";

  t.results.forEach(function (r, rIdx) {
    var rankName = { 1: "優勝", 2: "準優勝", 3: "TOP4" }[r.rank] || ("順位" + r.rank);
    var rankText = rankName;
    if (r.team) {
      rankText += "(チーム" + r.team + ")";
    } else {
      var sameRankCount = t.results.filter(function (x) { return x.rank === r.rank && !x.team; }).length;
      if (sameRankCount > 1) {
        var ordinal = t.results.slice(0, rIdx + 1).filter(function (x) { return x.rank === r.rank && !x.team; }).length;
        rankText += "-" + ordinal;
      }
    }

    var tr = document.createElement("tr");

    var tdRank = document.createElement("td");
    tdRank.textContent = rankText;
    tr.appendChild(tdRank);

    var tdTitle = document.createElement("td");
    tdTitle.textContent = r.deckTitle || "-";
    tr.appendChild(tdTitle);

    var tdCards = document.createElement("td");
    tdCards.textContent = (Array.isArray(r.cards) ? r.cards.length : 0) + "種類";
    tr.appendChild(tdCards);

    var tdActions = document.createElement("td");
    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-small";
    editBtn.textContent = "編集";
    editBtn.addEventListener("click", function () { openResultEditForm(rIdx); });
    tdActions.appendChild(editBtn);

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-small btn-danger";
    removeBtn.textContent = "削除";
    removeBtn.addEventListener("click", function () {
      var ok = window.confirm(rankText + "・" + (r.deckTitle || "(タイトル未設定)") + " の記録を削除します。よろしいですか？");
      if (!ok) return;
      t.results.splice(rIdx, 1);
      renderResultEditList();
      renderTournamentList();
      refreshDeckTitleList();
    });
    tdActions.appendChild(removeBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

/* 指定した結果1件の編集フォームを、既存のplayer-slot部品(createPlayerSlot)を
   流用して一覧の下に開く。保存時は同じ検証ロジック(extractResultFromSlot)を使う。 */
function openResultEditForm(rIdx) {
  var t = state.tournaments[resultEditState.tournamentIdx];
  var r = t.results[rIdx];

  var formWrap = document.getElementById("resultEditFormWrap");
  formWrap.innerHTML = "";
  formWrap.style.display = "block";

  var metaRow = document.createElement("div");
  metaRow.className = "form-grid";

  var rankLabel = document.createElement("label");
  rankLabel.textContent = "順位";
  var rankSelect = document.createElement("select");
  [[1, "優勝"], [2, "準優勝"], [3, "TOP4"]].forEach(function (pair) {
    var opt = document.createElement("option");
    opt.value = String(pair[0]);
    opt.textContent = pair[1];
    rankSelect.appendChild(opt);
  });
  rankSelect.value = String(r.rank);
  rankLabel.appendChild(rankSelect);
  metaRow.appendChild(rankLabel);

  var teamInput = null;
  if (t.tournamentFormat === "trio") {
    var teamLabel = document.createElement("label");
    teamLabel.textContent = "チーム番号";
    teamInput = document.createElement("input");
    teamInput.type = "number";
    teamInput.min = "1";
    teamInput.value = r.team || "";
    teamLabel.appendChild(teamInput);
    metaRow.appendChild(teamLabel);
  }
  formWrap.appendChild(metaRow);

  var slot = createPlayerSlot(r.rank, r.team || null);
  fillPlayerSlot(slot, r);
  formWrap.appendChild(slot);

  var errorPanel = document.createElement("div");
  errorPanel.className = "form-error";
  errorPanel.style.display = "none";
  formWrap.appendChild(errorPanel);

  var saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn-primary";
  saveBtn.textContent = "保存";
  saveBtn.addEventListener("click", function () {
    var rank = Number(rankSelect.value);
    var team = teamInput ? (parseInt(teamInput.value, 10) || null) : null;
    var rankName = { 1: "優勝", 2: "準優勝", 3: "TOP4" }[rank] || ("順位" + rank);
    var errors = [];
    var updated = extractResultFromSlot(slot, rank, team, rankName, errors);

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

    t.results[rIdx] = updated;
    var addedImages = autoRegisterDeckImages(t);
    var addedCards = autoRegisterCardMaster(t);
    refreshDeckTitleList();
    renderResultEditList();
    renderTournamentList();

    var loadStatus = document.getElementById("loadStatus");
    var notes = [];
    if (addedImages > 0) notes.push("画像マスタに新規" + addedImages + "件を仮登録しました");
    if (addedCards > 0) notes.push("カードマスタに新規" + addedCards + "件を仮登録しました");
    loadStatus.style.color = "#2f9e44";
    loadStatus.textContent = "結果を更新しました" + (notes.length > 0 ? "(" + notes.join(" / ") + ")" : "");
  });
  formWrap.appendChild(saveBtn);

  var cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn-small";
  cancelBtn.textContent = "キャンセル";
  cancelBtn.addEventListener("click", function () {
    formWrap.innerHTML = "";
    formWrap.style.display = "none";
  });
  formWrap.appendChild(cancelBtn);
}

function showFormErrors(errors) {
  var panel = document.getElementById("formError");
  if (!errors || errors.length === 0) {
    panel.style.display = "none";
    panel.innerHTML = "";
    return;
  }
  panel.style.display = "block";
  panel.innerHTML = "";
  var ul = document.createElement("ul");
  errors.forEach(function (e) {
    var li = document.createElement("li");
    li.textContent = e;
    ul.appendChild(li);
  });
  panel.appendChild(ul);
}

/* ---------- file load / download ---------- */

function onLoadFile(evt) {
  var file = evt.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    var loadStatus = document.getElementById("loadStatus");
    try {
      var data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("配列(JSON array)ではありません");
      state.tournaments = data;
      resultEditState.tournamentIdx = null;
      updateCounter();
      renderTournamentList();
      renderResultEditList();
      refreshDeckTitleList();
      loadStatus.style.color = "";
      loadStatus.textContent = file.name + " を読み込みました";
    } catch (err) {
      loadStatus.style.color = "#b60000";
      loadStatus.textContent = "読み込み失敗: " + err.message;
    }
  };
  reader.readAsText(file, "utf-8");
}

/* 大会結果に登場したタイトル+クライマックスを、代表画像マスタ(deck-images.js)へ
   画像URL空欄で仮登録する。同じ組み合わせが既にあれば何もしない(重複を作らない)。 */
function autoRegisterDeckImages(tournament) {
  if (typeof imgState === "undefined") return 0;
  var added = 0;
  tournament.results.forEach(function (r) {
    var title = imgNormalizeTitle(r.deckTitle);
    if (!title) return;
    var climax = imgCanonicalizeClimax(r.climax);
    var exists = imgState.deckImages.some(function (entry) {
      return imgNormalizeTitle(entry.title) === title && imgSameClimax(entry.climax, climax);
    });
    if (!exists) {
      imgState.deckImages.push({ title: title, climax: climax, imageUrl: "" });
      added++;
    }
  });
  if (added > 0) {
    renderImageList();
    updateImgCount();
  }
  return added;
}

/* 大会結果で使われたカード名のうち、カードマスタ(card-master.js)にまだ無いものを
   種別・レベル未設定の状態で仮登録する。同じ名前が既にあれば何もしない(重複を作らない)。 */
function autoRegisterCardMaster(tournament) {
  if (typeof cmState === "undefined") return 0;
  var added = 0;
  tournament.results.forEach(function (r) {
    r.cards.forEach(function (c) {
      var name = cmNormalizeName(c.name);
      if (!name) return;
      var exists = cmState.cards.some(function (entry) {
        return cmNormalizeName(entry.name) === name;
      });
      if (!exists) {
        cmState.cards.push({ name: name, type: "", level: null, climaxType: null, imageUrl: "" });
        added++;
      }
    });
  });
  if (added > 0) {
    renderCardMasterList();
    updateCmCount();
  }
  return added;
}

function onAddTournament() {
  var res = collectFormDataAsTournamentObject();
  if (!res.ok) {
    showFormErrors(res.errors);
    return;
  }
  showFormErrors([]);
  state.tournaments.push(res.tournament);
  updateCounter();
  renderTournamentList();
  var addedImages = autoRegisterDeckImages(res.tournament);
  var addedCards = autoRegisterCardMaster(res.tournament);
  refreshDeckTitleList();
  resetForm();
  var loadStatus = document.getElementById("loadStatus");
  loadStatus.style.color = "#2f9e44";
  var notes = [];
  if (addedImages > 0) notes.push("画像マスタに新規" + addedImages + "件を仮登録しました(「代表画像マスタ管理」タブで登録してください)");
  if (addedCards > 0) notes.push("カードマスタに新規" + addedCards + "件を仮登録しました(「カードマスタ管理」タブで種別・レベルを登録してください)");
  loadStatus.textContent = "「" + res.tournament.eventName + "」を追加しました" +
    (notes.length > 0 ? "(" + notes.join(" / ") + ")" : "");
}

function onDownload() {
  var filename = "tournaments.json";
  var blob = new Blob([JSON.stringify(state.tournaments, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

/* ---------- tabs ---------- */

function wireTabs() {
  var buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
}

/* ---------- init ---------- */

function init() {
  wireTabs();

  document.getElementById("fileInput").addEventListener("change", onLoadFile);
  document.getElementById("genIdBtn").addEventListener("click", function () {
    document.getElementById("eventId").value = generateId(document.getElementById("eventDate").value);
  });
  document.getElementById("eventTournamentFormat").addEventListener("change", function (evt) {
    var newFormat = evt.target.value;
    if (resultTiersHaveData()) {
      var ok = window.confirm("大会形式を変更すると、入力済みの結果欄がリセットされます。よろしいですか？");
      if (!ok) {
        evt.target.value = state.currentFormat;
        return;
      }
    }
    state.currentFormat = newFormat;
    buildResultTiers(newFormat);
  });
  document.getElementById("addTournamentBtn").addEventListener("click", onAddTournament);
  document.getElementById("downloadBtn").addEventListener("click", onDownload);
  document.getElementById("resultEditCloseBtn").addEventListener("click", function () {
    resultEditState.tournamentIdx = null;
    renderResultEditList();
  });

  buildResultTiers("single");
  updateCounter();
  renderTournamentList();
  refreshDeckTitleList();
}

document.addEventListener("DOMContentLoaded", init);
