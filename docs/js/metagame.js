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

function renderAll() {
  var filters = getFilters();
  var filteredResults = getFilteredResults(filters);
  var summary = computeDeckSummaries(filteredResults, state.imageMap);

  renderTileGrid(state.flatResults, filteredResults, summary, filters);

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
