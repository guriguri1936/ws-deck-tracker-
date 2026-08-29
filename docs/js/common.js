"use strict";

/* index.html(メタゲーム一覧)と deck.html(デッキ詳細)の両方から使う共通処理。
   どちらのページでも <script src="js/common.js"> を先に読み込むこと。 */

var UNTITLED_LABEL = "(タイトル未記入)";

/* キャノニカル順(表示順)。admin/js/admin.js, admin/js/deck-images.js, admin/js/card-master.js と同じ並びで同期させること。 */
var CLIMAX_OPTIONS = ["袋", "扉", "風", "本", "ショット", "宝", "門", "電源", "枝", "筒", "チャンス", "フォーカス", "+2"];

var RANK_LABELS = { 1: "優勝", 2: "準優勝", 3: "TOP4" };
var TOURNAMENT_FORMAT_LABELS = { single: "シングル", trio: "トリオ" };
var ORGANIZER_LABELS = { official: "公式主催", individual: "個人主催" };

/* カードマスタ(docs/data/cards.json)の種別。デッキリスト表示順は キャラ→イベント→クライマックス→未登録。 */
var CARD_TYPE_ORDER = { character: 0, event: 1, climax: 2 };
var CARD_TYPE_LABELS = { character: "キャラ", event: "イベント", climax: "クライマックス" };
var CARD_TYPE_UNKNOWN_LABEL = "その他(未登録)";

function normalizeTitle(title) {
  if (title === null || title === undefined) return "";
  return String(title).replace(/[ 　\t]+/g, " ").trim();
}

function normalizeCardName(name) {
  return normalizeTitle(name);
}

function safeDivide(numerator, denominator) {
  if (!denominator) return null;
  return numerator / denominator;
}

function formatPercent(ratio) {
  if (ratio === null || ratio === undefined) return "-";
  return (ratio * 100).toFixed(1) + "%";
}

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function organizerLabel(type) {
  return ORGANIZER_LABELS[type] || type || "-";
}

function tournamentFormatLabel(fmt) {
  return TOURNAMENT_FORMAT_LABELS[fmt] || fmt || "-";
}

function rankLabel(rank) {
  return RANK_LABELS[rank] || String(rank);
}

function pad2(n) { return n < 10 ? "0" + n : String(n); }

function computeCutoffDate(days) {
  var d = new Date();
  d.setDate(d.getDate() - days);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

/* ---------- クライマックス構成 ---------- */

function canonicalizeClimax(arr) {
  if (!Array.isArray(arr)) return [];
  var set = {};
  arr.forEach(function (c) {
    if (CLIMAX_OPTIONS.indexOf(c) !== -1) set[c] = true;
  });
  return CLIMAX_OPTIONS.filter(function (c) { return set[c]; });
}

function buildDeckLabel(title, climax) {
  var t = normalizeTitle(title) || UNTITLED_LABEL;
  var c = canonicalizeClimax(climax);
  if (c.length === 0) return t;
  if (c.length === 1) return t + " 8" + c[0];
  return t + " " + c.join("");
}

function deckImageKey(title, climax) {
  return normalizeTitle(title) + "|" + canonicalizeClimax(climax).join(",");
}

/* デッキ詳細ページ(deck.html)へのリンクURLを組み立てる。
   filters は { organizerType, tournamentFormat, periodDays } (いずれも省略可)。
   entry を渡すと、そのentryEvent/resultIndexを指定して、大会結果一覧内の特定の記録
   (＝その大会で入賞した時のデッキリスト)を直接表示するリンクになる(省略時は最新の記録を自動表示)。 */
function buildDeckDetailUrl(title, climax, filters, entry) {
  var params = new URLSearchParams();
  params.set("title", normalizeTitle(title));
  params.set("climax", canonicalizeClimax(climax).join(","));
  if (filters) {
    if (filters.organizerType) params.set("organizerType", filters.organizerType);
    if (filters.tournamentFormat) params.set("tournamentFormat", filters.tournamentFormat);
    if (filters.periodDays) params.set("period", String(filters.periodDays));
  }
  if (entry) {
    params.set("entryEvent", entry.eventId);
    params.set("entryIndex", String(entry.resultIndex));
  }
  return "deck.html?" + params.toString();
}

/* ---------- データ整形 ---------- */

function flatten(events) {
  var out = [];
  events.forEach(function (ev) {
    var results = Array.isArray(ev.results) ? ev.results : [];
    results.forEach(function (r, resultIndex) {
      var climax = canonicalizeClimax(r.climax);
      var title = normalizeTitle(r.deckTitle) || UNTITLED_LABEL;
      out.push({
        eventId: ev.id,
        resultIndex: resultIndex,
        eventName: ev.eventName,
        date: ev.date,
        organizerType: ev.organizerType,
        tournamentFormat: ev.tournamentFormat,
        sourceUrl: ev.sourceUrl || "",
        rank: Number(r.rank),
        team: r.team ? Number(r.team) : null,
        deckTitleRaw: r.deckTitle,
        deckTitle: title,
        climax: climax,
        deckLabel: buildDeckLabel(r.deckTitle, climax),
        cards: Array.isArray(r.cards) ? r.cards : [],
        photoUrl: r.photoUrl || ""
      });
    });
  });
  return out;
}

function buildImageMap(deckImages) {
  var map = {};
  (Array.isArray(deckImages) ? deckImages : []).forEach(function (entry) {
    if (!isHttpUrl(entry.imageUrl)) return;
    map[deckImageKey(entry.title, entry.climax)] = entry.imageUrl;
  });
  return map;
}

/* カードマスタ(docs/data/cards.json)からカード名→{type, level, climaxType, imageUrl}のマップを作る。 */
function buildCardMap(cards) {
  var map = {};
  (Array.isArray(cards) ? cards : []).forEach(function (entry) {
    var name = normalizeCardName(entry.name);
    if (!name) return;
    map[name] = {
      type: entry.type || "",
      level: (entry.level === null || entry.level === undefined || entry.level === "") ? null : Number(entry.level),
      climaxType: entry.climaxType || "",
      imageUrl: isHttpUrl(entry.imageUrl) ? entry.imageUrl : ""
    };
  });
  return map;
}

function cardTypeRank(name, cardMap) {
  var info = cardMap[normalizeCardName(name)];
  if (info && Object.prototype.hasOwnProperty.call(CARD_TYPE_ORDER, info.type)) {
    return CARD_TYPE_ORDER[info.type];
  }
  return 3;
}

function cardLevelOf(name, cardMap) {
  var info = cardMap[normalizeCardName(name)];
  return info && info.level !== null && info.level !== undefined ? info.level : Infinity;
}

/* カードリストを 種別(キャラ→イベント→クライマックス→未登録) > レベル(0→1→2→3→...→不明)
   の入れ子グループに分ける。クライマックス・未登録の種別はレベルが無いのでサブグループを作らない。
   戻り値: [{ label, subgroups: [{ label, cards }, ...] } または { label, cards } , ...]
   (該当カードが無い種別/レベルは含めない) */
function groupCardsByTypeAndLevel(cards, cardMap) {
  var buckets = [[], [], [], []];
  cards.forEach(function (c) {
    buckets[cardTypeRank(c.name, cardMap)].push(c);
  });
  var labels = [CARD_TYPE_LABELS.character, CARD_TYPE_LABELS.event, CARD_TYPE_LABELS.climax, CARD_TYPE_UNKNOWN_LABEL];
  var result = [];
  buckets.forEach(function (bucket, rank) {
    if (bucket.length === 0) return;
    if (rank === 2 || rank === 3) {
      /* クライマックス・未登録: レベルの概念が無いのでそのまま1グループ */
      result.push({ label: labels[rank], cards: bucket.slice() });
      return;
    }
    var byLevel = {};
    var levelOrder = [];
    bucket.forEach(function (c) {
      var level = cardLevelOf(c.name, cardMap);
      if (!Object.prototype.hasOwnProperty.call(byLevel, level)) {
        byLevel[level] = [];
        levelOrder.push(level);
      }
      byLevel[level].push(c);
    });
    levelOrder.sort(function (a, b) { return a - b; });
    var subgroups = levelOrder.map(function (level) {
      return {
        label: level === Infinity ? "レベル不明" : "レベル" + level,
        cards: byLevel[level]
      };
    });
    result.push({ label: labels[rank], subgroups: subgroups });
  });
  return result;
}

/* ---------- フィルタ ---------- */

/* filters: { organizerType, tournamentFormat, dateFrom } (いずれも省略可、空文字/未指定は「絞り込みなし」) */
function matchesFilters(r, filters) {
  if (!filters) return true;
  if (filters.organizerType && r.organizerType !== filters.organizerType) return false;
  if (filters.tournamentFormat && r.tournamentFormat !== filters.tournamentFormat) return false;
  if (filters.dateFrom && r.date < filters.dateFrom) return false;
  return true;
}

function getFilteredResultsFrom(flatResults, filters) {
  return flatResults.filter(function (r) { return matchesFilters(r, filters); });
}

/* ---------- 集計 ---------- */

/* カード採用率・平均枚数の計算対象は、カードリストが記録されている(cardsが空でない)デッキに限る。
   使用率・優勝率(computeDeckSummaries)はデッキ記録があれば全件対象なので、この関数とは母数が異なる。 */
function computeCardAdoption(filteredResults, deckLabel) {
  var pool = filteredResults.filter(function (r) {
    return r.deckLabel === deckLabel && Array.isArray(r.cards) && r.cards.length > 0;
  });
  var poolSize = pool.length;
  var decksContaining = {};
  var totalCopies = {};
  var order = [];
  pool.forEach(function (r) {
    var seen = {};
    r.cards.forEach(function (c) {
      var name = normalizeCardName(c.name);
      if (!name) return;
      var count = Number(c.count) || 0;
      if (!Object.prototype.hasOwnProperty.call(totalCopies, name)) {
        totalCopies[name] = 0;
        order.push(name);
      }
      totalCopies[name] += count;
      if (count > 0 && !seen[name]) {
        decksContaining[name] = (decksContaining[name] || 0) + 1;
        seen[name] = true;
      }
    });
  });
  var entries = order.map(function (name) {
    return {
      name: name,
      decksContaining: decksContaining[name] || 0,
      adoptionRate: safeDivide(decksContaining[name] || 0, poolSize),
      avgCopies: safeDivide(totalCopies[name] || 0, poolSize)
    };
  });
  entries.sort(function (a, b) { return b.decksContaining - a.decksContaining; });
  return { poolSize: poolSize, entries: entries };
}

/* 殿堂入りカードランキング用: デッキの種類を問わず、全記録を横断してカードの採用状況を集計する。
   母数はcomputeCardAdoptionと同じくカードリストが記録されている記録のみ。 */
function computeHallOfFameRanking(filteredResults) {
  var pool = filteredResults.filter(function (r) {
    return Array.isArray(r.cards) && r.cards.length > 0;
  });
  var poolSize = pool.length;
  var recordsContaining = {};
  var totalCopies = {};
  var deckLabelSets = {};
  var order = [];
  pool.forEach(function (r) {
    var seen = {};
    r.cards.forEach(function (c) {
      var name = normalizeCardName(c.name);
      if (!name) return;
      var count = Number(c.count) || 0;
      if (!Object.prototype.hasOwnProperty.call(totalCopies, name)) {
        totalCopies[name] = 0;
        deckLabelSets[name] = {};
        order.push(name);
      }
      totalCopies[name] += count;
      if (count > 0 && !seen[name]) {
        recordsContaining[name] = (recordsContaining[name] || 0) + 1;
        deckLabelSets[name][r.deckLabel] = true;
        seen[name] = true;
      }
    });
  });
  var entries = order.map(function (name) {
    return {
      name: name,
      totalCopies: totalCopies[name] || 0,
      recordsContaining: recordsContaining[name] || 0,
      adoptionRate: safeDivide(recordsContaining[name] || 0, poolSize),
      avgCopies: safeDivide(totalCopies[name] || 0, poolSize),
      deckCount: Object.keys(deckLabelSets[name] || {}).length
    };
  });
  entries.sort(function (a, b) {
    if (b.totalCopies !== a.totalCopies) return b.totalCopies - a.totalCopies;
    return b.deckCount - a.deckCount;
  });
  return { poolSize: poolSize, entries: entries };
}

/* ---------- rendering ---------- */

function createTileImage(imageUrl, title) {
  var wrap = document.createElement("div");
  wrap.className = "tile-image";
  if (imageUrl) {
    var img = document.createElement("img");
    img.src = imageUrl;
    img.alt = title;
    img.addEventListener("error", function () {
      wrap.classList.add("tile-image-placeholder");
      wrap.innerHTML = "";
      wrap.textContent = title;
      img = null;
    });
    wrap.appendChild(img);
  } else {
    wrap.classList.add("tile-image-placeholder");
    wrap.textContent = title;
  }
  return wrap;
}

/* ---------- カードのマウスオーバー画像プレビュー ---------- */

function ensureCardHoverPreviewEl() {
  var el = document.getElementById("cardHoverPreview");
  if (el) return el;
  el = document.createElement("img");
  el.id = "cardHoverPreview";
  el.className = "card-hover-preview";
  el.alt = "";
  document.body.appendChild(el);
  return el;
}

function positionCardHoverPreview(preview, x, y) {
  var offset = 16;
  var maxLeft = window.innerWidth - preview.offsetWidth - 8;
  var maxTop = window.innerHeight - preview.offsetHeight - 8;
  preview.style.left = Math.max(8, Math.min(x + offset, maxLeft)) + "px";
  preview.style.top = Math.max(8, Math.min(y + offset, maxTop)) + "px";
}

/* カード名を表示する要素にマウスオーバー画像プレビューを付ける。
   cardMap にそのカードの画像URLが登録されていない場合は何もしない。 */
function attachCardHoverPreview(el, cardName, cardMap) {
  var info = cardMap[normalizeCardName(cardName)];
  if (!info || !info.imageUrl) return;
  var preview = ensureCardHoverPreviewEl();
  el.classList.add("has-card-preview");
  el.addEventListener("mouseenter", function () {
    preview.src = info.imageUrl;
    preview.style.display = "block";
  });
  el.addEventListener("mousemove", function (evt) {
    positionCardHoverPreview(preview, evt.clientX, evt.clientY);
  });
  el.addEventListener("mouseleave", function () {
    preview.style.display = "none";
  });
}

/* ---------- 通販サイトへのリンク(カード購入用) ---------- */

/* genre=9 はトレトク側でのヴァイスシュヴァルツのカテゴリID、stock=1は在庫ありのみ表示。 */
function buildToretokuSearchUrl(cardName) {
  return "https://www.toretoku.jp/item?kw=" + encodeURIComponent(cardName) + "&genre=9&stock=1";
}

function buildMercariSearchUrl(cardName) {
  return "https://jp.mercari.com/search?keyword=" + encodeURIComponent(cardName);
}

/* カード名の横に添える「トレトク」「メルカリ」検索リンクの小さなspanを作る。 */
function createShopLinks(cardName) {
  var wrap = document.createElement("span");
  wrap.className = "shop-links";

  var toretoku = document.createElement("a");
  toretoku.href = buildToretokuSearchUrl(cardName);
  toretoku.target = "_blank";
  toretoku.rel = "noopener noreferrer";
  toretoku.className = "shop-link";
  toretoku.textContent = "トレトク";
  wrap.appendChild(toretoku);

  var mercari = document.createElement("a");
  mercari.href = buildMercariSearchUrl(cardName);
  mercari.target = "_blank";
  mercari.rel = "noopener noreferrer";
  mercari.className = "shop-link";
  mercari.textContent = "メルカリ";
  wrap.appendChild(mercari);

  return wrap;
}

/* ---------- data loading ---------- */

function loadJson(path) {
  return fetch(path).then(function (res) {
    if (!res.ok) throw new Error(path + ": HTTP " + res.status);
    return res.json();
  });
}

function loadTournamentData() {
  return Promise.all([loadJson("data/tournaments.json"), loadJson("data/deckImages.json"), loadJson("data/cards.json")])
    .then(function (results) {
      var events = Array.isArray(results[0]) ? results[0] : [];
      var imageMap = buildImageMap(results[1]);
      var cardMap = buildCardMap(results[2]);
      return { events: events, imageMap: imageMap, cardMap: cardMap, flatResults: flatten(events) };
    });
}

function showLoadError(err) {
  var el = document.getElementById("loadError");
  if (!el) return;
  el.style.display = "block";
  el.textContent = "データの読み込みに失敗しました: " + err.message;
  console.error(err);
}
