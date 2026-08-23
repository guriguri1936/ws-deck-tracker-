"use strict";
/* 大会結果一覧ページ(tournament.html)固有の処理。共通処理は js/common.js を参照。
   URLクエリ: ?event=<大会ID> */

function parseTournamentQuery() {
  var params = new URLSearchParams(window.location.search);
  return { eventId: params.get("event") || "" };
}

function renderTournamentResults(results, tournamentFormat) {
  var container = document.getElementById("tournamentResultsSection");
  container.innerHTML = "";

  var sorted = results.slice().sort(function (a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (a.team || 0) - (b.team || 0);
  });

  var table = document.createElement("table");
  table.className = "recent-group-table";
  var tbody = document.createElement("tbody");

  sorted.forEach(function (r) {
    var tr = document.createElement("tr");

    var tdRank = document.createElement("td");
    tdRank.className = "rg-rank";
    var rankText = isNaN(r.rank) ? "-" : rankLabel(r.rank);
    if (tournamentFormat === "trio" && r.team) rankText += " チーム" + r.team;
    var rankBadge = document.createElement("span");
    rankBadge.className = "rg-rank-badge";
    rankBadge.textContent = rankText;
    tdRank.appendChild(rankBadge);
    tr.appendChild(tdRank);

    var tdDeck = document.createElement("td");
    tdDeck.className = "rg-deck";
    var deckLink = document.createElement("a");
    deckLink.href = buildDeckDetailUrl(r.deckTitle, r.climax, null, r);
    deckLink.target = "_blank";
    deckLink.rel = "noopener noreferrer";
    deckLink.textContent = r.deckLabel;
    tdDeck.appendChild(deckLink);
    tr.appendChild(tdDeck);

    var tdPlayer = document.createElement("td");
    tdPlayer.className = "rg-player";
    tdPlayer.textContent = r.player || "-";
    tr.appendChild(tdPlayer);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderTournamentDetail(query, data) {
  var event = data.events.filter(function (ev) { return ev.id === query.eventId; })[0];
  if (!event) {
    document.getElementById("tournamentNotFound").style.display = "block";
    return;
  }

  var headerSection = document.getElementById("tournamentHeaderSection");
  headerSection.innerHTML = "";

  var h1 = document.createElement("h1");
  h1.textContent = event.eventName;
  headerSection.appendChild(h1);

  var meta = document.createElement("p");
  meta.className = "deck-meta";
  meta.textContent = organizerLabel(event.organizerType) + " ・ " + tournamentFormatLabel(event.tournamentFormat) + " ・ " + event.date;
  headerSection.appendChild(meta);

  if (event.sourceUrl) {
    var srcP = document.createElement("p");
    srcP.className = "deck-meta";
    var srcLink = document.createElement("a");
    srcLink.href = event.sourceUrl;
    srcLink.target = "_blank";
    srcLink.rel = "noopener noreferrer";
    srcLink.textContent = "出典";
    srcP.appendChild(srcLink);
    headerSection.appendChild(srcP);
  }

  var results = data.flatResults.filter(function (r) { return r.eventId === event.id; });
  renderTournamentResults(results, event.tournamentFormat);
}

function init() {
  var query = parseTournamentQuery();
  if (!query.eventId) {
    document.getElementById("tournamentNotFound").style.display = "block";
    document.getElementById("tournamentNotFound").textContent = "大会が指定されていません。";
    return;
  }
  loadTournamentData()
    .then(function (data) {
      renderTournamentDetail(query, data);
    })
    .catch(showLoadError);
}

document.addEventListener("DOMContentLoaded", init);
