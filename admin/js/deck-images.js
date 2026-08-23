"use strict";

/* キャノニカル順(表示順)。docs/js/main.js, admin/js/admin.js と同じ並びで同期させること。 */
var IMG_CLIMAX_OPTIONS = ["袋", "扉", "風", "本", "ショット", "宝", "門", "電源", "枝", "筒", "チャンス", "フォーカス", "+2"];

var imgState = {
  deckImages: []
};

function imgNormalizeTitle(title) {
  return String(title || "").replace(/[ 　\t]+/g, " ").trim();
}

function imgCanonicalizeClimax(arr) {
  if (!Array.isArray(arr)) return [];
  var set = {};
  arr.forEach(function (c) {
    if (IMG_CLIMAX_OPTIONS.indexOf(c) !== -1) set[c] = true;
  });
  return IMG_CLIMAX_OPTIONS.filter(function (c) { return set[c]; });
}

function imgBuildDeckLabel(title, climax) {
  var t = imgNormalizeTitle(title);
  var c = imgCanonicalizeClimax(climax);
  if (c.length === 0) return t;
  if (c.length === 1) return t + " 8" + c[0];
  return t + " " + c.join("");
}

function imgSameClimax(a, b) {
  var ca = imgCanonicalizeClimax(a);
  var cb = imgCanonicalizeClimax(b);
  if (ca.length !== cb.length) return false;
  for (var i = 0; i < ca.length; i++) {
    if (ca[i] !== cb[i]) return false;
  }
  return true;
}

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

/* ---------- climax checkbox picker ---------- */

function buildClimaxCheckboxes(container) {
  container.innerHTML = "";
  IMG_CLIMAX_OPTIONS.forEach(function (name) {
    var optLabel = document.createElement("label");
    optLabel.className = "climax-option";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = name;
    cb.className = "img-climax";
    optLabel.appendChild(cb);
    optLabel.appendChild(document.createTextNode(name));
    container.appendChild(optLabel);
  });
}

function readCheckedClimax(container) {
  var out = [];
  container.querySelectorAll(".img-climax:checked").forEach(function (cb) {
    out.push(cb.value);
  });
  return imgCanonicalizeClimax(out);
}

function clearCheckedClimax(container) {
  container.querySelectorAll(".img-climax:checked").forEach(function (cb) { cb.checked = false; });
}

/* 一覧の「編集」ボタンから呼ばれる。上の登録フォームに既存エントリの内容を入力し直し、
   タイトル欄までスクロールする(そのまま「登録」を押せば上書き確認の上で更新される)。 */
function fillImgFormForEdit(entry) {
  document.getElementById("imgTitle").value = entry.title;
  document.getElementById("imgUrl").value = entry.imageUrl || "";
  var climaxContainer = document.getElementById("imgClimaxOptions");
  clearCheckedClimax(climaxContainer);
  var canonical = imgCanonicalizeClimax(entry.climax);
  climaxContainer.querySelectorAll(".img-climax").forEach(function (cb) {
    cb.checked = canonical.indexOf(cb.value) !== -1;
  });
  document.getElementById("imgTitle").scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ---------- list rendering ---------- */

function renderImageList() {
  var tbody = document.getElementById("imgListBody");
  var empty = document.getElementById("imgListEmpty");
  tbody.innerHTML = "";

  if (imgState.deckImages.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  imgState.deckImages.forEach(function (entry, idx) {
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

    var tdLabel = document.createElement("td");
    tdLabel.textContent = imgBuildDeckLabel(entry.title, entry.climax);
    tr.appendChild(tdLabel);

    var tdUrl = document.createElement("td");
    tdUrl.className = "img-url-cell";
    if (isHttpUrl(entry.imageUrl)) {
      tdUrl.textContent = entry.imageUrl;
    } else {
      tdUrl.textContent = "(画像未登録)";
      tdUrl.classList.add("img-url-empty");
    }
    tr.appendChild(tdUrl);

    var tdActions = document.createElement("td");
    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-small";
    editBtn.textContent = "編集";
    editBtn.addEventListener("click", function () { fillImgFormForEdit(entry); });
    tdActions.appendChild(editBtn);

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-small btn-danger";
    removeBtn.textContent = "削除";
    removeBtn.addEventListener("click", function () {
      imgState.deckImages.splice(idx, 1);
      renderImageList();
      updateImgCount();
    });
    tdActions.appendChild(removeBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

function updateImgCount() {
  document.getElementById("imgCount").textContent = imgState.deckImages.length + "件 登録済み";
}

/* ---------- add / load / download ---------- */

function onImgAdd() {
  var titleInput = document.getElementById("imgTitle");
  var urlInput = document.getElementById("imgUrl");
  var climaxContainer = document.getElementById("imgClimaxOptions");
  var errorPanel = document.getElementById("imgFormError");

  var title = titleInput.value.trim();
  var url = urlInput.value.trim();
  var climax = readCheckedClimax(climaxContainer);

  var errors = [];
  if (!title) errors.push("タイトルを入力してください");
  if (!url) errors.push("画像URLを入力してください");
  else if (!isHttpUrl(url)) errors.push("画像URLはhttp(s)://で始めてください");

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

  var existingIdx = -1;
  imgState.deckImages.forEach(function (entry, idx) {
    if (imgNormalizeTitle(entry.title) === imgNormalizeTitle(title) && imgSameClimax(entry.climax, climax)) {
      existingIdx = idx;
    }
  });

  if (existingIdx !== -1) {
    var ok = window.confirm("「" + imgBuildDeckLabel(title, climax) + "」は既に登録されています。画像URLを上書きしますか？");
    if (!ok) return;
    imgState.deckImages[existingIdx].imageUrl = url;
  } else {
    imgState.deckImages.push({ title: title, climax: climax, imageUrl: url });
  }

  titleInput.value = "";
  urlInput.value = "";
  clearCheckedClimax(climaxContainer);
  renderImageList();
  updateImgCount();
  if (typeof refreshDeckTitleList === "function") refreshDeckTitleList();
}

function onImgLoadFile(evt) {
  var file = evt.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    var status = document.getElementById("imgLoadStatus");
    try {
      var data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("配列(JSON array)ではありません");
      imgState.deckImages = data;
      renderImageList();
      updateImgCount();
      if (typeof refreshDeckTitleList === "function") refreshDeckTitleList();
      status.style.color = "";
      status.textContent = file.name + " を読み込みました";
    } catch (err) {
      status.style.color = "#b60000";
      status.textContent = "読み込み失敗: " + err.message;
    }
  };
  reader.readAsText(file, "utf-8");
}

function onImgDownload() {
  var filename = "deckImages.json";
  var blob = new Blob([JSON.stringify(imgState.deckImages, null, 2)], { type: "application/json" });
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

function initDeckImages() {
  buildClimaxCheckboxes(document.getElementById("imgClimaxOptions"));
  document.getElementById("imgFileInput").addEventListener("change", onImgLoadFile);
  document.getElementById("imgAddBtn").addEventListener("click", onImgAdd);
  document.getElementById("imgDownloadBtn").addEventListener("click", onImgDownload);
  renderImageList();
  updateImgCount();
}

document.addEventListener("DOMContentLoaded", initDeckImages);
