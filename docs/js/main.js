"use strict";
/* このページ固有の処理。共通処理は js/common.js を参照(先に読み込まれている前提)。 */

var MIN_SAMPLE_HIGHLIGHT = 5;
var RECENT_EVENTS_LIMIT = 8;
var TILE_KEY_CARD_LIMIT = 3;

/* 急上昇デッキの判定基準。「直近期間」の件数がこの値以上、かつ「その直前の同じ長さの期間」との
   差がこの値以上あるデッキにバッジを付ける(件数が少ない集計初期段階でのノイズを避けるための閾値)。 */
var TRENDING_MIN_COUNT = 2;
var TRENDING_MIN_DELTA = 2;

var state = {
  events: [],
  flatResults: [],
  imageMap: {}
};

function getFilters() {
  var periodDays = Number(document.getElementById("filterPeriod").value);
  return {
    organizerType: document.getElementById("filterOrganizerType").value,
    tournamentFormat: document.getElementById("filterTournamentFormat").value,
    periodDays: periodDays,
    dateFrom: computeCutoffDate(periodDays)
  };
}

function getFilteredResults(filters) {
  return getFilteredResultsFrom(state.flatResults, filters);
}

/* ---------- 集計 ---------- */

function computeDeckSummaries(filteredResults) {
  var denominator = filteredResults.length;
  var groups = {};
  filteredResults.forEach(function (r) {
    var g = groups[r.deckLabel];
    if (!g) {
      g = { label: r.deckLabel, title: r.deckTitle, climax: r.climax, count: 0, wins: 0 };
      groups[r.deckLabel] = g;
    }
    g.count += 1;
    if (r.rank === 1) g.wins += 1;
  });
  var list = Object.keys(groups).map(function (label) {
    var g = groups[label];
    return {
      label: g.label,
      title: g.title,
      climax: g.climax,
      count: g.count,
      usageRate: safeDivide(g.count, denominator),
      wins: g.wins,
      championshipRate: safeDivide(g.wins, g.count),
      imageUrl: state.imageMap[deckImageKey(g.title, g.climax)] || ""
    };
  });
  list.sort(function (a, b) { return b.count - a.count; });
  return { denominator: denominator, list: list };
}

/* 「直近期間(現在のフィルタと同じ長さ)」と「その直前の同じ長さの期間」を比べて、
   件数が伸びているデッキラベルの集合を返す(急上昇バッジ用)。組織区分・大会形式の絞り込みは
   現在のフィルタに合わせるが、期間フィルタが「全期間」(periodDays未指定)の時は比較対象がないので
   空を返す。 */
function computeTrendingDeckLabels(flatResults, filters) {
  if (!filters.periodDays) return {};

  var currentFrom = filters.dateFrom;
  var prevFrom = computeCutoffDate(filters.periodDays * 2);

  var currentCounts = {};
  var prevCounts = {};

  flatResults.forEach(function (r) {
    if (filters.organizerType && r.organizerType !== filters.organizerType) return;
    if (filters.tournamentFormat && r.tournamentFormat !== filters.tournamentFormat) return;
    if (r.date >= currentFrom) {
      currentCounts[r.deckLabel] = (currentCounts[r.deckLabel] || 0) + 1;
    } else if (r.date >= prevFrom) {
      prevCounts[r.deckLabel] = (prevCounts[r.deckLabel] || 0) + 1;
    }
  });

  var trending = {};
  Object.keys(currentCounts).forEach(function (label) {
    var current = currentCounts[label];
    var prev = prevCounts[label] || 0;
    if (current >= TRENDING_MIN_COUNT && (current - prev) >= TRENDING_MIN_DELTA) {
      trending[label] = true;
    }
  });
  return trending;
}

/* ---------- rendering: tile grid ---------- */

function renderTileGrid(filteredResults, summary, filters) {
  var grid = document.getElementById("tileGrid");
  var empty = document.getElementById("tileEmptyState");
  grid.innerHTML = "";

  if (summary.denominator === 0 || summary.list.length === 0) {
    empty.style.display = "block";
    grid.style.display = "none";
    return;
  }
  empty.style.display = "none";
  grid.style.display = "grid";

  var trending = computeTrendingDeckLabels(state.flatResults, filters);

  summary.list.forEach(function (entry) {
    var tile = document.createElement("a");
    tile.className = "tile";
    tile.href = buildDeckDetailUrl(entry.title, entry.climax, filters);
    tile.appendChild(createTileImage(entry.imageUrl, entry.label));
    if (trending[entry.label]) {
      var badge = document.createElement("span");
      badge.className = "tile-trending-badge";
      badge.textContent = "急上昇";
      tile.appendChild(badge);
    }

    var body = document.createElement("div");
    body.className = "tile-body";

    var titleEl = document.createElement("div");
    titleEl.className = "tile-title";
    titleEl.textContent = entry.label;
    body.appendChild(titleEl);

    var statsEl = document.createElement("div");
    statsEl.className = "tile-stats";
    var usageEl = document.createElement("span");
    usageEl.className = "tile-usage";
    usageEl.textContent = "使用率 " + formatPercent(entry.usageRate) + " (" + entry.count + ")";
    statsEl.appendChild(usageEl);

    var champEl = document.createElement("span");
    champEl.className = "tile-champ";
    if (entry.count < MIN_SAMPLE_HIGHLIGHT) champEl.classList.add("low-sample");
    champEl.textContent = "優勝率 " + formatPercent(entry.championshipRate) + " (" + entry.wins + "/" + entry.count + ")";
    statsEl.appendChild(champEl);
    body.appendChild(statsEl);

    var cardAdoption = computeCardAdoption(filteredResults, entry.label);
    if (cardAdoption.entries.length > 0) {
      var keyCards = document.createElement("ul");
      keyCards.className = "tile-key-cards";
      cardAdoption.entries.slice(0, TILE_KEY_CARD_LIMIT).forEach(function (c) {
        var li = document.createElement("li");
        li.textContent = c.name + " (" + formatPercent(c.adoptionRate) + ")";
        keyCards.appendChild(li);
      });
      body.appendChild(keyCards);
    }

    tile.appendChild(body);
    grid.appendChild(tile);
  });
}

/* ---------- rendering: recent results (大会ごとにグループ化したコンパクトなリスト) ---------- */

function groupResultsByEvent(filteredResults) {
  var groups = {};
  var order = [];
  filteredResults.forEach(function (r) {
    var g = groups[r.eventId];
    if (!g) {
      g = {
        eventId: r.eventId,
        eventName: r.eventName,
        date: r.date,
        organizerType: r.organizerType,
        tournamentFormat: r.tournamentFormat,
        results: []
      };
      groups[r.eventId] = g;
      order.push(r.eventId);
    }
    g.results.push(r);
  });
  var list = order.map(function (id) { return groups[id]; });
  list.forEach(function (g) {
    g.results.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return (a.team || 0) - (b.team || 0);
    });
  });
  list.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return list;
}

function renderRecentGroups(filteredResults, filters) {
  var container = document.getElementById("recentGroups");
  var empty = document.getElementById("recentEmptyState");
  var note = document.getElementById("recentTableNote");
  container.innerHTML = "";

  if (filteredResults.length === 0) {
    empty.style.display = "block";
    note.textContent = "";
    return;
  }
  empty.style.display = "none";

  var groups = groupResultsByEvent(filteredResults);
  var shown = groups.slice(0, RECENT_EVENTS_LIMIT);

  shown.forEach(function (g) {
    var groupEl = document.createElement("div");
    groupEl.className = "recent-group";

    var header = document.createElement("div");
    header.className = "recent-group-header";
    var a = document.createElement("a");
    a.href = "tournament.html?event=" + encodeURIComponent(g.eventId);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = g.eventName;
    header.appendChild(a);
    var dateSpan = document.createElement("span");
    dateSpan.className = "recent-group-date";
    dateSpan.textContent = "(" + organizerLabel(g.organizerType) + "・" + tournamentFormatLabel(g.tournamentFormat) + "・" + g.date + ")";
    header.appendChild(dateSpan);
    groupEl.appendChild(header);

    var table = document.createElement("table");
    table.className = "recent-group-table";
    var tbody = document.createElement("tbody");
    g.results.forEach(function (r) {
      var tr = document.createElement("tr");

      var tdRank = document.createElement("td");
      tdRank.className = "rg-rank";
      var rankBadge = document.createElement("span");
      rankBadge.className = "rg-rank-badge";
      rankBadge.textContent = isNaN(r.rank) ? "-" : rankLabel(r.rank);
      tdRank.appendChild(rankBadge);
      tr.appendChild(tdRank);

      var tdDeck = document.createElement("td");
      tdDeck.className = "rg-deck";
      var deckLink = document.createElement("a");
      deckLink.href = buildDeckDetailUrl(r.deckTitle, r.climax, filters, r);
      deckLink.textContent = r.deckLabel;
      tdDeck.appendChild(deckLink);
      tr.appendChild(tdDeck);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    groupEl.appendChild(table);

    container.appendChild(groupEl);
  });

  note.textContent = groups.length + "大会中 " + shown.length + "大会を表示";
}

/* ---------- pipeline ---------- */

function renderAll() {
  var filters = getFilters();
  var filteredResults = getFilteredResults(filters);
  var summary = computeDeckSummaries(filteredResults);

  renderTileGrid(filteredResults, summary, filters);
  renderRecentGroups(filteredResults, filters);

  document.getElementById("resultCount").textContent = filteredResults.length + "件のデッキ記録";
}

function wireEvents() {
  ["filterOrganizerType", "filterTournamentFormat", "filterPeriod"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function () {
      renderAll();
    });
  });
}

function init() {
  wireEvents();
  loadTournamentData()
    .then(function (data) {
      state.events = data.events;
      state.imageMap = data.imageMap;
      state.flatResults = data.flatResults;
      renderAll();
    })
    .catch(showLoadError);
}

document.addEventListener("DOMContentLoaded", init);
