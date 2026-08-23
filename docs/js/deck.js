"use strict";
/* デッキ詳細ページ(deck.html)固有の処理。共通処理は js/common.js を参照。
   URLクエリ: ?title=...&climax=扉,宝&organizerType=...&tournamentFormat=...&period=60
   さらに entryEvent・entryIndex を指定すると、大会結果一覧の特定の1件(その大会で
   入賞した時のデッキリスト)をピンポイントで表示する。 */

var DECK_RECENT_LIMIT = 20;

function parseDeckQuery() {
  var params = new URLSearchParams(window.location.search);
  var title = params.get("title") || "";
  var climaxRaw = params.get("climax") || "";
  var climax = climaxRaw ? canonicalizeClimax(climaxRaw.split(",")) : [];
  var periodDays = params.get("period") ? Number(params.get("period")) : null;
  var filters = {
    organizerType: params.get("organizerType") || "",
    tournamentFormat: params.get("tournamentFormat") || "",
    dateFrom: periodDays ? computeCutoffDate(periodDays) : ""
  };
  var entryEvent = params.get("entryEvent") || "";
  var entryIndexRaw = params.get("entryIndex");
  var entryIndex = entryIndexRaw !== null && entryIndexRaw !== "" ? Number(entryIndexRaw) : null;
  return { title: title, climax: climax, periodDays: periodDays, filters: filters, entryEvent: entryEvent, entryIndex: entryIndex };
}

function filterCaptionText(query) {
  var parts = [];
  parts.push(query.filters.organizerType ? organizerLabel(query.filters.organizerType) : "すべての主催区分");
  parts.push(query.filters.tournamentFormat ? tournamentFormatLabel(query.filters.tournamentFormat) : "すべての形式");
  parts.push(query.periodDays ? "直近" + query.periodDays + "日" : "全期間");
  return "表示条件: " + parts.join("・");
}

/* 表示するデッキリストを1件選ぶ。
   - URLでentryEvent/entryIndexが指定されていれば、その記録をそのまま採用する(カード未記録でもそれを尊重する)。
   - 指定がなければ「最新の記録」を採用するが、それにカードもデッキ画像も記録されていない場合は
     カードかデッキ画像が記録されている中で一番新しいものまで遡ってフォールバックする。 */
function pickFeaturedEntry(deckResults, query) {
  if (query.entryEvent && query.entryIndex !== null) {
    var explicit = deckResults.filter(function (r) {
      return r.eventId === query.entryEvent && r.resultIndex === query.entryIndex;
    })[0];
    if (explicit) return { entry: explicit, isExplicit: true };
  }

  var sorted = deckResults.slice().sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.rank - b.rank;
  });
  var withContent = sorted.filter(function (r) { return (r.cards && r.cards.length > 0) || r.photoUrl; })[0];
  return { entry: withContent || sorted[0], isExplicit: false };
}

function renderLatestDecklist(featured, query, cardMap) {
  var heading = document.getElementById("decklistHeading");
  var section = document.getElementById("latestDecklistSection");
  section.innerHTML = "";

  var latest = featured.entry;
  heading.textContent = featured.isExplicit ? "この大会での入賞デッキリスト" : "最新の入賞デッキリスト";

  if (featured.isExplicit) {
    var backLink = document.createElement("a");
    backLink.className = "back-link";
    backLink.href = buildDeckDetailUrl(query.title, query.climax, query.filters);
    backLink.textContent = "最新の記録を表示";
    var backP = document.createElement("p");
    backP.appendChild(backLink);
    section.appendChild(backP);
  }

  var meta = document.createElement("p");
  meta.className = "deck-meta";
  if (latest.sourceUrl) {
    var a = document.createElement("a");
    a.href = latest.sourceUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = latest.eventName;
    meta.appendChild(document.createTextNode("大会: "));
    meta.appendChild(a);
  } else {
    meta.appendChild(document.createTextNode("大会: " + latest.eventName));
  }
  var metaParts = [rankLabel(latest.rank), latest.date];
  meta.appendChild(document.createTextNode(" ・ " + metaParts.join(" ・ ")));
  section.appendChild(meta);

  if (!latest.cards || latest.cards.length === 0) {
    if (latest.photoUrl) {
      var photoNote = document.createElement("p");
      photoNote.className = "subtitle";
      photoNote.textContent = "この記録は画像で登録されています(カードリスト未登録)。";
      section.appendChild(photoNote);
      var photoImg = document.createElement("img");
      photoImg.className = "decklist-photo";
      photoImg.src = latest.photoUrl;
      photoImg.alt = "デッキ画像";
      section.appendChild(photoImg);
    } else {
      var noCards = document.createElement("p");
      noCards.className = "subtitle";
      noCards.textContent = "この記録にはカードリストが登録されていません。";
      section.appendChild(noCards);
    }
    return;
  }

  var total = latest.cards.reduce(function (sum, c) { return sum + (Number(c.count) || 0); }, 0);
  var countLabel = document.createElement("p");
  countLabel.className = "subtitle";
  countLabel.textContent = "全" + total + "枚 / " + latest.cards.length + "種類(種別→レベル順)";
  section.appendChild(countLabel);

  var groups = groupCardsByTypeAndLevel(latest.cards, cardMap);
  groups.forEach(function (group) {
    var count = group.subgroups
      ? group.subgroups.reduce(function (sum, sg) { return sum + sg.cards.length; }, 0)
      : group.cards.length;
    var groupHeading = document.createElement("h3");
    groupHeading.className = "decklist-group-heading";
    groupHeading.textContent = group.label + " (" + count + ")";
    section.appendChild(groupHeading);

    if (group.subgroups) {
      group.subgroups.forEach(function (subgroup) {
        var subHeading = document.createElement("h4");
        subHeading.className = "decklist-subgroup-heading";
        subHeading.textContent = subgroup.label + " (" + subgroup.cards.length + ")";
        section.appendChild(subHeading);
        section.appendChild(renderDecklistUl(subgroup.cards, cardMap));
      });
    } else {
      section.appendChild(renderDecklistUl(group.cards, cardMap));
    }
  });
}

function renderDecklistUl(cards, cardMap) {
  var list = document.createElement("ul");
  list.className = "decklist";
  cards.forEach(function (c) {
    var li = document.createElement("li");
    var countSpan = document.createElement("span");
    countSpan.className = "decklist-count";
    countSpan.textContent = c.count;
    var nameSpan = document.createElement("span");
    nameSpan.className = "decklist-name";
    nameSpan.textContent = c.name;
    attachCardHoverPreview(nameSpan, c.name, cardMap);
    li.appendChild(countSpan);
    li.appendChild(nameSpan);
    li.appendChild(createShopLinks(c.name));
    list.appendChild(li);
  });
  return list;
}

function renderCardAdoptionTable(allFiltered, label, cardMap) {
  var section = document.getElementById("cardAdoptionSection");
  section.innerHTML = "";

  var cardAdoption = computeCardAdoption(allFiltered, label);
  var heading = document.createElement("h2");
  heading.textContent = "カード採用率(集計: N=" + cardAdoption.poolSize + ")";
  section.appendChild(heading);

  if (cardAdoption.entries.length === 0) {
    var noCards = document.createElement("p");
    noCards.className = "subtitle";
    noCards.textContent = "このデッキにはカード情報が記録されていません。";
    section.appendChild(noCards);
    return;
  }

  var table = document.createElement("table");
  table.className = "detail-card-table";
  var thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>カード名</th><th>採用率</th><th>平均枚数</th></tr>";
  table.appendChild(thead);
  var tbody = document.createElement("tbody");
  cardAdoption.entries.forEach(function (c) {
    var tr = document.createElement("tr");
    var tdName = document.createElement("td");
    tdName.textContent = c.name;
    attachCardHoverPreview(tdName, c.name, cardMap);
    var tdRate = document.createElement("td");
    tdRate.textContent = formatPercent(c.adoptionRate);
    var tdAvg = document.createElement("td");
    tdAvg.textContent = c.avgCopies === null ? "-" : c.avgCopies.toFixed(2);
    tr.appendChild(tdName);
    tr.appendChild(tdRate);
    tr.appendChild(tdAvg);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  section.appendChild(table);
}

function renderDeckDetail(query, data) {
  var label = buildDeckLabel(query.title, query.climax);
  var allFiltered = getFilteredResultsFrom(data.flatResults, query.filters);
  var deckResults = allFiltered.filter(function (r) { return r.deckLabel === label; });

  var notFound = document.getElementById("deckNotFound");
  var headerSection = document.getElementById("deckHeaderSection");
  var latestSection = document.getElementById("latestDecklistSection");
  var adoptionSection = document.getElementById("cardAdoptionSection");

  if (deckResults.length === 0) {
    notFound.style.display = "block";
    headerSection.innerHTML = "";
    latestSection.innerHTML = "";
    adoptionSection.innerHTML = "";
    document.title = label + " - ヴァイスシュバルツ 大会結果 集計";
    return;
  }
  notFound.style.display = "none";
  document.title = label + " - ヴァイスシュバルツ 大会結果 集計";

  var count = deckResults.length;
  var wins = deckResults.filter(function (r) { return r.rank === 1; }).length;
  var usageRate = safeDivide(count, allFiltered.length);
  var championshipRate = safeDivide(wins, count);
  var imageUrl = data.imageMap[deckImageKey(query.title, query.climax)] || "";

  headerSection.innerHTML = "";
  var headRow = document.createElement("div");
  headRow.className = "detail-head";
  headRow.appendChild(createTileImage(imageUrl, label));

  var headInfo = document.createElement("div");
  var h = document.createElement("h1");
  h.textContent = label;
  headInfo.appendChild(h);

  var stats = document.createElement("p");
  stats.className = "detail-stats";
  stats.textContent = "使用率 " + formatPercent(usageRate) + " (N=" + count + ") ／ 優勝率 " +
    formatPercent(championshipRate) + " (" + wins + "/" + count + ")";
  headInfo.appendChild(stats);

  var caption = document.createElement("p");
  caption.className = "detail-caption";
  caption.textContent = filterCaptionText(query);
  headInfo.appendChild(caption);

  headRow.appendChild(headInfo);
  headerSection.appendChild(headRow);

  renderLatestDecklist(pickFeaturedEntry(deckResults, query), query, data.cardMap);
  renderCardAdoptionTable(allFiltered, label, data.cardMap);
  renderDeckRecentList(deckResults, query);
}

function renderDeckRecentList(deckResults, query) {
  var container = document.getElementById("deckRecentList");
  var empty = document.getElementById("deckRecentEmpty");
  container.innerHTML = "";

  if (deckResults.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  var sorted = deckResults.slice().sort(function (a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
  var shown = sorted.slice(0, DECK_RECENT_LIMIT);

  var table = document.createElement("table");
  table.className = "recent-group-table";
  var tbody = document.createElement("tbody");
  shown.forEach(function (r) {
    var tr = document.createElement("tr");

    var tdDate = document.createElement("td");
    tdDate.className = "rg-date";
    tdDate.textContent = r.date;
    tr.appendChild(tdDate);

    var tdEvent = document.createElement("td");
    tdEvent.className = "rg-deck";
    var link = document.createElement("a");
    link.href = buildDeckDetailUrl(query.title, query.climax, query.filters, r);
    link.textContent = r.eventName + "(" + rankLabel(r.rank) + ")";
    tdEvent.appendChild(link);
    if (r.sourceUrl) {
      var srcLink = document.createElement("a");
      srcLink.href = r.sourceUrl;
      srcLink.target = "_blank";
      srcLink.rel = "noopener noreferrer";
      srcLink.className = "rg-source-link";
      srcLink.textContent = "(出典)";
      tdEvent.appendChild(document.createTextNode(" "));
      tdEvent.appendChild(srcLink);
    }
    tr.appendChild(tdEvent);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function init() {
  var query = parseDeckQuery();
  if (!query.title && query.climax.length === 0) {
    document.getElementById("deckNotFound").style.display = "block";
    document.getElementById("deckNotFound").textContent = "デッキが指定されていません。メタゲームページからタイルをクリックして開いてください。";
    return;
  }
  loadTournamentData()
    .then(function (data) {
      renderDeckDetail(query, data);
    })
    .catch(showLoadError);
}

document.addEventListener("DOMContentLoaded", init);
