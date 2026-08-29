"use strict";
/* 殿堂入りカードランキングページ(cards.html)固有の処理。共通処理は js/common.js を参照。 */

var HALL_OF_FAME_LIMIT = 30;

var state = {
  flatResults: [],
  cardMap: {}
};

function getFilters() {
  var periodDays = Number(document.getElementById("filterPeriod").value);
  return {
    organizerType: document.getElementById("filterOrganizerType").value,
    tournamentFormat: document.getElementById("filterTournamentFormat").value,
    periodDays: periodDays,
    dateFrom: periodDays ? computeCutoffDate(periodDays) : ""
  };
}

function renderRanking() {
  var filters = getFilters();
  var filteredResults = getFilteredResultsFrom(state.flatResults, filters);
  var ranking = computeHallOfFameRanking(filteredResults);

  var poolNote = document.getElementById("poolNote");
  var section = document.getElementById("rankingSection");
  var empty = document.getElementById("rankingEmpty");
  section.innerHTML = "";

  poolNote.textContent = "集計対象: カードリストが記録されている " + ranking.poolSize + "件の記録(" +
    (filters.periodDays ? "直近" + filters.periodDays + "日" : "全期間") + ")";

  if (ranking.entries.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  var shown = ranking.entries.slice(0, HALL_OF_FAME_LIMIT);

  var table = document.createElement("table");
  table.className = "detail-card-table";
  var thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>順位</th><th>カード名</th><th>合計採用枚数</th><th>採用率</th><th>採用デッキ種類数</th><th>平均枚数</th></tr>";
  table.appendChild(thead);

  var tbody = document.createElement("tbody");
  shown.forEach(function (c, i) {
    var tr = document.createElement("tr");

    var tdRank = document.createElement("td");
    tdRank.className = "rg-rank";
    var rankBadge = document.createElement("span");
    rankBadge.className = "rg-rank-badge";
    rankBadge.textContent = (i + 1) + "位";
    tdRank.appendChild(rankBadge);
    tr.appendChild(tdRank);

    var tdName = document.createElement("td");
    tdName.textContent = c.name;
    attachCardHoverPreview(tdName, c.name, state.cardMap);
    tr.appendChild(tdName);

    var tdTotal = document.createElement("td");
    tdTotal.textContent = c.totalCopies + "枚";
    tr.appendChild(tdTotal);

    var tdRate = document.createElement("td");
    tdRate.textContent = formatPercent(c.adoptionRate);
    tr.appendChild(tdRate);

    var tdDecks = document.createElement("td");
    tdDecks.textContent = c.deckCount + "種類";
    tr.appendChild(tdDecks);

    var tdAvg = document.createElement("td");
    tdAvg.textContent = c.avgCopies === null ? "-" : c.avgCopies.toFixed(2);
    tr.appendChild(tdAvg);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  section.appendChild(table);
}

function wireEvents() {
  ["filterOrganizerType", "filterTournamentFormat", "filterPeriod"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function () {
      renderRanking();
    });
  });
}

function init() {
  wireEvents();
  loadTournamentData()
    .then(function (data) {
      state.flatResults = data.flatResults;
      state.cardMap = data.cardMap;
      renderRanking();
    })
    .catch(showLoadError);
}

document.addEventListener("DOMContentLoaded", init);
