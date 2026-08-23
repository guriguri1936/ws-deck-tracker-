"use strict";

/* キャノニカル順(表示順)。docs/js/main.js, admin/js/admin.js, admin/js/deck-images.js と同じ並びで同期させること。 */
var CC_CLIMAX_OPTIONS = ["袋", "扉", "風", "本", "ショット", "宝", "門", "電源", "枝", "筒", "チャンス", "フォーカス", "+2"];

var ccState = {
  cards: [] // { name: "カード名", climax: "扉" } のように1枚=1種別
};

function ccNormalizeName(name) {
  return String(name || "").replace(/[ 　\t]+/g, " ").trim();
}

/* 大会結果入力タブの一括貼り付け解析から呼ばれる。登録済みクライマックスカードと
   名前が一致するカードがあれば、その種別を返す(未登録なら null)。 */
function findClimaxForCardName(name) {
  var normalized = ccNormalizeName(name);
  if (!normalized) return null;
  var match = ccState.cards.filter(function (c) {
    return ccNormalizeName(c.name) === normalized;
  })[0];
  return match ? match.climax : null;
}

/* ---------- select / list rendering ---------- */

function buildClimaxTypeSelect(selectEl) {
  selectEl.innerHTML = "";
  CC_CLIMAX_OPTIONS.forEach(function (name) {
    var opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  });
}

function renderClimaxCardList() {
  var tbody = document.getElementById("ccListBody");
  var empty = document.getElementById("ccListEmpty");
  tbody.innerHTML = "";

  if (ccState.cards.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  ccState.cards.forEach(function (entry, idx) {
    var tr = document.createElement("tr");

    var tdName = document.createElement("td");
    tdName.textContent = entry.name;
    tr.appendChild(tdName);

    var tdType = document.createElement("td");
    tdType.textContent = entry.climax;
    tr.appendChild(tdType);

    var tdRemove = document.createElement("td");
    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-small btn-danger";
    removeBtn.textContent = "削除";
    removeBtn.addEventListener("click", function () {
      ccState.cards.splice(idx, 1);
      renderClimaxCardList();
      updateCcCount();
    });
    tdRemove.appendChild(removeBtn);
    tr.appendChild(tdRemove);

    tbody.appendChild(tr);
  });
}

function updateCcCount() {
  document.getElementById("ccCount").textContent = ccState.cards.length + "件 登録済み";
}

/* ---------- add / load / download ---------- */

function onCcAdd() {
  var nameInput = document.getElementById("ccName");
  var typeSelect = document.getElementById("ccClimaxType");
  var errorPanel = document.getElementById("ccFormError");

  var name = ccNormalizeName(nameInput.value);
  var climax = typeSelect.value;

  if (!name) {
    errorPanel.style.display = "block";
    errorPanel.innerHTML = "<ul><li>カード名を入力してください</li></ul>";
    return;
  }
  errorPanel.style.display = "none";
  errorPanel.innerHTML = "";

  var existingIdx = -1;
  ccState.cards.forEach(function (entry, idx) {
    if (ccNormalizeName(entry.name) === name) existingIdx = idx;
  });

  if (existingIdx !== -1) {
    var ok = window.confirm("「" + name + "」は既に「" + ccState.cards[existingIdx].climax + "」として登録されています。「" + climax + "」に上書きしますか？");
    if (!ok) return;
    ccState.cards[existingIdx].climax = climax;
  } else {
    ccState.cards.push({ name: name, climax: climax });
  }

  nameInput.value = "";
  renderClimaxCardList();
  updateCcCount();
}

function onCcLoadFile(evt) {
  var file = evt.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    var status = document.getElementById("ccLoadStatus");
    try {
      var data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("配列(JSON array)ではありません");
      ccState.cards = data;
      renderClimaxCardList();
      updateCcCount();
      status.style.color = "";
      status.textContent = file.name + " を読み込みました";
    } catch (err) {
      status.style.color = "#b60000";
      status.textContent = "読み込み失敗: " + err.message;
    }
  };
  reader.readAsText(file, "utf-8");
}

function onCcDownload() {
  var filename = "climaxCards.json";
  var blob = new Blob([JSON.stringify(ccState.cards, null, 2)], { type: "application/json" });
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

function initClimaxCards() {
  buildClimaxTypeSelect(document.getElementById("ccClimaxType"));
  document.getElementById("ccFileInput").addEventListener("change", onCcLoadFile);
  document.getElementById("ccAddBtn").addEventListener("click", onCcAdd);
  document.getElementById("ccDownloadBtn").addEventListener("click", onCcDownload);
  renderClimaxCardList();
  updateCcCount();
}

document.addEventListener("DOMContentLoaded", initClimaxCards);
