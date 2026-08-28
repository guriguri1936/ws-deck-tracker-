/*
 * 公式カードリスト(ws-tcg.com/cardlist/)の検索結果ページで実行するブックマークレット。
 * 一覧ページのDOM内には、画面上は非表示のテキスト版リスト(#js-cardListText)が常に存在し、
 * そこに表示中の全カードの「カード名・種類・レベル・画像URL」が最初から入っている。
 * モーダルを1枚ずつ開かなくても、このリストを読み取るだけで一覧ページの全カードを
 * 一括でカードマスタ管理タブの一括登録欄向けの形式(カンマ区切り)に変換できる。
 *
 * 絞り込み条件を変えたりページを送ったりして一覧の中身が変化した場合にも追従できるよう、
 * リストの変化をMutationObserverで監視し、新しく現れたカードを自動で追記する。
 *
 * このファイルは可読ソース。実際に配布するブックマークレットは
 * admin/bookmarklet/install.html にこの内容を1行に圧縮して埋め込んである。
 * このファイルを編集した場合は install.html 側も手動で同期すること。
 */
(function () {
  var PANEL_ID = "wscard-bookmarklet-panel";
  var SCAN_DEBOUNCE_MS = 300;

  var existing = document.getElementById(PANEL_ID);
  if (existing) {
    if (existing._wscardObserver) existing._wscardObserver.disconnect();
    existing.remove();
  }

  /* #js-cardListText 内の各カード項目から、名前・種類・レベル・画像URLを読み取る。
     クライマックスは公式ページに「クライマックス種別(袋/扉/風など)」の情報がないため、
     3列目(レベル相当の欄)は空欄で出力する。 */
  function extractAllCards() {
    var container = document.getElementById("js-cardListText");
    if (!container) return [];

    var items = container.querySelectorAll(".card__item");
    var results = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      var nameEl = item.querySelector(".card__name");
      if (!nameEl) continue;
      var rawName = nameEl.textContent.trim();
      /* 「カード名 (SFN/S136-001) - RR」のような表記から末尾の型番・レア度を除去する。 */
      var parenIndex = rawName.lastIndexOf(" (");
      var name = (parenIndex === -1 ? rawName : rawName.slice(0, parenIndex)).trim();
      if (!name) continue;

      var kind = "";
      var spec1Items = item.querySelectorAll(".card__spec1Lists .card__spec1Item");
      for (var a = 0; a < spec1Items.length; a++) {
        var dt1 = spec1Items[a].querySelector("dt");
        var dd1 = spec1Items[a].querySelector("dd");
        if (dt1 && dd1 && dt1.textContent.trim() === "種類") kind = dd1.textContent.trim();
      }
      if (!kind) continue;

      var level = "";
      var spec2Items = item.querySelectorAll(".card__spec2Lists .card__spec2Item");
      for (var b = 0; b < spec2Items.length; b++) {
        var dt2 = spec2Items[b].querySelector("dt");
        var dd2 = spec2Items[b].querySelector("dd");
        if (dt2 && dd2 && dt2.textContent.trim() === "レベル") level = dd2.textContent.trim();
      }

      var imgEl = item.querySelector(".card__imgLink img");
      var imageUrl = imgEl ? (imgEl.getAttribute("src") || "") : "";

      var third = kind === "クライマックス" ? "" : level;
      results.push({ name: name, line: [name, kind, third, imageUrl].join(",") });
    }
    return results;
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

  var panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText = [
    "position:fixed", "top:12px", "right:12px", "z-index:999999",
    "background:#fff", "color:#222", "border:2px solid #333", "border-radius:8px",
    "padding:12px 14px", "font-size:13px", "font-family:sans-serif",
    "box-shadow:0 4px 12px rgba(0,0,0,0.3)", "width:320px", "line-height:1.5"
  ].join(";");

  var closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = "position:absolute;top:4px;right:8px;border:none;background:none;font-size:16px;cursor:pointer;color:#666";
  closeBtn.addEventListener("click", function () {
    if (panel._wscardObserver) panel._wscardObserver.disconnect();
    panel.remove();
  });
  panel.appendChild(closeBtn);

  var info = document.createElement("div");
  info.style.cssText = "margin-bottom:6px;padding-right:16px;";
  info.textContent = "このページのカード一覧を自動で読み込みます。絞り込みやページ送りをしても自動で追従します。";
  panel.appendChild(info);

  var status = document.createElement("div");
  status.style.cssText = "margin-bottom:6px;color:#2f6fed;min-height:16px;";
  panel.appendChild(status);

  var textarea = document.createElement("textarea");
  textarea.rows = 8;
  textarea.style.cssText = "width:100%;font-size:12px;margin-bottom:8px;box-sizing:border-box;";
  panel.appendChild(textarea);

  var note = document.createElement("div");
  note.style.cssText = "font-size:11px;color:#666;margin-bottom:8px;";
  note.textContent = "※クライマックスは3列目(クライマックス種別)が空欄になります。袋/扉/風/本/ショット/宝/門/電源/枝/筒/チャンス/フォーカス/+2 のいずれかを手動で追記してください。";
  panel.appendChild(note);

  var rescanBtn = document.createElement("button");
  rescanBtn.textContent = "再読み込み";
  rescanBtn.style.cssText = "display:block;width:100%;padding:6px;cursor:pointer;margin-bottom:8px;";
  rescanBtn.addEventListener("click", function () { scan(); });
  panel.appendChild(rescanBtn);

  var copyBtn = document.createElement("button");
  copyBtn.textContent = "全てコピー";
  copyBtn.style.cssText = "display:inline-block;width:48%;margin-right:4%;padding:6px;cursor:pointer;";
  copyBtn.addEventListener("click", function () { copyText(textarea.value, copyBtn); });
  panel.appendChild(copyBtn);

  var clearBtn = document.createElement("button");
  clearBtn.textContent = "クリア";
  clearBtn.style.cssText = "display:inline-block;width:48%;padding:6px;cursor:pointer;";
  clearBtn.addEventListener("click", function () { textarea.value = ""; status.textContent = ""; knownNames = {}; });
  panel.appendChild(clearBtn);

  document.body.appendChild(panel);

  var knownNames = {};
  function scan() {
    var cards = extractAllCards();
    var added = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (knownNames[card.name]) continue;
      knownNames[card.name] = true;
      textarea.value = textarea.value ? textarea.value + "\n" + card.line : card.line;
      added++;
    }
    if (cards.length === 0) {
      status.textContent = "カード一覧が見つかりませんでした。カードリストのページで実行してください。";
    } else if (added > 0) {
      status.textContent = added + "件を追加しました(合計" + Object.keys(knownNames).length + "件)。";
    } else {
      status.textContent = "新しいカードはありませんでした。";
    }
  }

  scan();

  var scanTimer = null;
  function scheduleScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, SCAN_DEBOUNCE_MS);
  }

  var watchTarget = document.querySelector(".card__listsWrap") || document.body;
  var observer = new MutationObserver(scheduleScan);
  observer.observe(watchTarget, { childList: true, subtree: true });
  panel._wscardObserver = observer;
})();
