/*
 * デッキログ(decklog.bushiroad.com)のデッキ詳細ページで実行するブックマークレット。
 * ネオスタンダード区分(作品タイトル)とカードリストを抽出し、admin側の入力欄にそのまま
 * 貼り付けられる形式でクリップボードにコピーするためのミニパネルをページ右上に表示する。
 *
 * このファイルは可読ソース。実際に配布するブックマークレットは
 * admin/bookmarklet/install.html にこの内容を1行に圧縮して埋め込んである。
 * このファイルを編集した場合は install.html 側も手動で同期すること。
 */
(function () {
  var EXISTING_PANEL_ID = "wsdeck-bookmarklet-panel";

  var existing = document.getElementById(EXISTING_PANEL_ID);
  if (existing) existing.remove();

  /* 「ネオスタンダード区分：〇〇」というラベル行の値(span)を抽出する。
     このクラス名は他のラベル行(カラー区分など)と共通なので、テキスト内容で対象行を判定する。 */
  function extractNeoStandardTitle() {
    var rows = document.querySelectorAll(".preview-top-label-right");
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].textContent.indexOf("ネオスタンダード区分") === -1) continue;
      var span = rows[i].querySelector("span");
      if (span) return span.textContent.trim();
    }
    return "";
  }

  function extractCards() {
    var items = document.querySelectorAll(".card-item");
    var cards = [];
    items.forEach(function (item) {
      var img = item.querySelector("img.card-view-item");
      var numEl = item.querySelector(".card-controller-inner .num");
      if (!img || !numEl) return;
      var name = (img.getAttribute("alt") || "").trim();
      var count = parseInt(numEl.textContent.trim(), 10);
      if (!name || !count) return;
      cards.push({ name: name, count: count });
    });
    return cards;
  }

  function buildCardListText(cards) {
    return cards.map(function (c) { return c.name + "\t" + c.count; }).join("\n");
  }

  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(function () {
      var original = btn.textContent;
      btn.textContent = "コピーしました";
      setTimeout(function () { btn.textContent = original; }, 1500);
    }, function () {
      window.alert("コピーに失敗しました。手動で選択してコピーしてください。");
    });
  }

  var title = extractNeoStandardTitle();
  var cards = extractCards();
  var totalCount = cards.reduce(function (sum, c) { return sum + c.count; }, 0);
  var cardListText = buildCardListText(cards);

  var panel = document.createElement("div");
  panel.id = EXISTING_PANEL_ID;
  panel.style.cssText = [
    "position:fixed", "top:12px", "right:12px", "z-index:999999",
    "background:#fff", "color:#222", "border:2px solid #333", "border-radius:8px",
    "padding:12px 14px", "font-size:13px", "font-family:sans-serif",
    "box-shadow:0 4px 12px rgba(0,0,0,0.3)", "width:280px", "line-height:1.5"
  ].join(";");

  var closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = "position:absolute;top:4px;right:8px;border:none;background:none;font-size:16px;cursor:pointer;color:#666";
  closeBtn.addEventListener("click", function () { panel.remove(); });
  panel.appendChild(closeBtn);

  var titleRow = document.createElement("div");
  titleRow.style.cssText = "margin-bottom:8px;padding-right:16px;";
  titleRow.textContent = "タイトル: " + (title || "(取得できませんでした)");
  panel.appendChild(titleRow);

  var titleBtn = document.createElement("button");
  titleBtn.textContent = "タイトルをコピー";
  titleBtn.disabled = !title;
  titleBtn.style.cssText = "display:block;width:100%;margin-bottom:10px;padding:6px;cursor:pointer;";
  titleBtn.addEventListener("click", function () { copyText(title, titleBtn); });
  panel.appendChild(titleBtn);

  var cardRow = document.createElement("div");
  cardRow.style.cssText = "margin-bottom:8px;";
  cardRow.textContent = "カード: 合計" + totalCount + "枚 / " + cards.length + "種類";
  panel.appendChild(cardRow);

  var cardBtn = document.createElement("button");
  cardBtn.textContent = "カードリストをコピー";
  cardBtn.disabled = cards.length === 0;
  cardBtn.style.cssText = "display:block;width:100%;padding:6px;cursor:pointer;";
  cardBtn.addEventListener("click", function () { copyText(cardListText, cardBtn); });
  panel.appendChild(cardBtn);

  document.body.appendChild(panel);
})();
