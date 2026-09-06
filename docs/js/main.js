"use strict";
/* このページ固有の処理。共通処理は js/common.js を参照(先に読み込まれている前提)。 */

var RECENT_EVENTS_LIMIT = 8;
var TILE_DISPLAY_LIMIT = 15;

var state = {
  events: [],
  flatResults: [],
  imageMap: {}
};

function getFilteredResults(filters) {
  return getFilteredResultsFrom(state.flatResults, filters);
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
  var summary = computeDeckSummaries(filteredResults, state.imageMap);

  renderTileGrid(state.flatResults, filteredResults, summary, filters, {
    limit: TILE_DISPLAY_LIMIT,
    moreLinkHref: buildMetagameUrl(filters)
  });
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
