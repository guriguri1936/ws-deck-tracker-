"use strict";
/* このページ固有の処理。共通処理は js/common.js を参照(先に読み込まれている前提)。
   index.html の「もっと見る」からフィルタを引き継いで遷移してくるので、
   URLクエリパラメータをフィルタUIの初期値に反映してから描画する。 */

var state = {
  events: [],
  flatResults: [],
  imageMap: {}
};

function getFilteredResults(filters) {
  return getFilteredResultsFrom(state.flatResults, filters);
}

/* タイトル絞り込みセレクトの選択肢を、現在のフィルタ条件下に存在するデッキタイトルで更新する。
   選択中の値がまだ選択肢に存在するなら維持する。 */
function populateTitleFilterOptions(list) {
  var select = document.getElementById("deckTitleFilter");
  var previousValue = select.value;

  var titles = [];
  var seen = {};
  list.forEach(function (entry) {
    if (seen[entry.title]) return;
    seen[entry.title] = true;
    titles.push(entry.title);
  });
  titles.sort(function (a, b) { return a.localeCompare(b, "ja"); });

  select.innerHTML = "";
  var allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "すべて";
  select.appendChild(allOption);
  titles.forEach(function (title) {
    var option = document.createElement("option");
    option.value = title;
    option.textContent = title;
    select.appendChild(option);
  });

  select.value = titles.indexOf(previousValue) !== -1 ? previousValue : "";
}

function sortDeckList(list, sortKey) {
  var sorted = list.slice();
  if (sortKey === "championshipRate") {
    sorted.sort(function (a, b) {
      var ar = a.championshipRate === null ? -1 : a.championshipRate;
      var br = b.championshipRate === null ? -1 : b.championshipRate;
      if (br !== ar) return br - ar;
      return b.count - a.count;
    });
  } else if (sortKey === "label") {
    sorted.sort(function (a, b) { return a.label.localeCompare(b.label, "ja"); });
  } else {
    sorted.sort(function (a, b) { return b.count - a.count; });
  }
  return sorted;
}

function renderAll() {
  var filters = getFilters();
  var filteredResults = getFilteredResults(filters);
  var summary = computeDeckSummaries(filteredResults, state.imageMap);

  populateTitleFilterOptions(summary.list);

  var selectedTitle = document.getElementById("deckTitleFilter").value;
  var query = normalizeTitle(document.getElementById("deckSearch").value).toLowerCase();
  var sortKey = document.getElementById("deckSort").value;

  var list = summary.list;
  if (selectedTitle) {
    list = list.filter(function (entry) { return entry.title === selectedTitle; });
  }
  if (query) {
    list = list.filter(function (entry) { return entry.label.toLowerCase().indexOf(query) !== -1; });
  }
  list = sortDeckList(list, sortKey);

  renderTileGrid(state.flatResults, filteredResults, { denominator: summary.denominator, list: list }, filters);

  document.getElementById("resultCount").textContent = filteredResults.length + "件のデッキ記録";
}

function wireEvents() {
  ["filterOrganizerType", "filterTournamentFormat", "filterPeriod", "deckTitleFilter", "deckSort"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function () {
      renderAll();
    });
  });
  document.getElementById("deckSearch").addEventListener("input", function () {
    renderAll();
  });
}

function init() {
  applyFiltersFromUrl();
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
