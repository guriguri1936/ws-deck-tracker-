/*
 * 公式カードリスト(ws-tcg.com/cardlist/)のカード詳細モーダルで実行するブックマークレット。
 * モーダルに表示されているカードの「カード名・種別・レベル・画像URL」を、カードマスタ管理タブの
 * 一括登録欄にそのまま貼り付けられる形式(カンマ区切り)でクリップボードにコピーする。
 *
 * このサイトはカードをクリックするたびに同じモーダル要素の中身が書き換わる作りなので、
 * ページ遷移せずに複数枚を連続でクリックしていくと、その都度リストに自動で追記されていく。
 *
 * このファイルは可読ソース。実際に配布するブックマークレットは
 * admin/bookmarklet/install.html にこの内容を1行に圧縮して埋め込んである。
 * このファイルを編集した場合は install.html 側も手動で同期すること。
 */
(function () {
  var PANEL_ID = "wscard-bookmarklet-panel";
  var POLL_MS = 500;

  var existing = document.getElementById(PANEL_ID);
  if (existing) {
    if (existing._wscardInterval) clearInterval(existing._wscardInterval);
    existing.remove();
  }

  /* モーダルの現在の表示内容を抽出する。クライマックスは公式ページに「クライマックス種別
     (袋/扉/風など)」の情報がないため、3列目(レベル相当の欄)は空欄で出力する。 */
  function extractCurrentCard() {
    var nameEl = document.getElementById("mdl-card_name");
    var kindEl = document.getElementById("mdl-kind");
    var levelEl = document.getElementById("mdl-level");
    var imgEl = document.getElementById("mdl-picture");
    if (!nameEl || !kindEl || !imgEl) return null;

    var name = nameEl.textContent.trim();
    var kind = kindEl.textContent.trim();
    if (!name || !kind) return null;

    var level = levelEl ? levelEl.textContent.trim() : "";
    var third = kind === "クライマックス" ? "" : level;
    var imageUrl = imgEl.getAttribute("src") || "";

    return { key: name + "|" + kind + "|" + level, line: [name, kind, third, imageUrl].join(",") };
  }

  function textareaHasName(textarea, name) {
    var lines = textarea.value.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var comma = line.indexOf(",");
      var existingName = (comma === -1 ? line : line.slice(0, comma)).trim();
      if (existingName === name) return true;
    }
    return false;
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
    clearInterval(panel._wscardInterval);
    panel.remove();
  });
  panel.appendChild(closeBtn);

  var info = document.createElement("div");
  info.style.cssText = "margin-bottom:6px;padding-right:16px;";
  info.textContent = "カードをクリックするたびに自動で下のリストに追加されます。";
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

  var copyBtn = document.createElement("button");
  copyBtn.textContent = "全てコピー";
  copyBtn.style.cssText = "display:inline-block;width:48%;margin-right:4%;padding:6px;cursor:pointer;";
  copyBtn.addEventListener("click", function () { copyText(textarea.value, copyBtn); });
  panel.appendChild(copyBtn);

  var clearBtn = document.createElement("button");
  clearBtn.textContent = "クリア";
  clearBtn.style.cssText = "display:inline-block;width:48%;padding:6px;cursor:pointer;";
  clearBtn.addEventListener("click", function () { textarea.value = ""; status.textContent = ""; });
  panel.appendChild(clearBtn);

  document.body.appendChild(panel);

  var lastKey = "";
  panel._wscardInterval = setInterval(function () {
    var card = extractCurrentCard();
    if (!card || card.key === lastKey) return;
    lastKey = card.key;

    var cardName = card.line.split(",")[0];
    if (textareaHasName(textarea, cardName)) {
      status.textContent = "「" + cardName + "」は追加済みです";
      return;
    }
    textarea.value = textarea.value ? textarea.value + "\n" + card.line : card.line;
    status.textContent = "「" + cardName + "」を追加しました";
  }, POLL_MS);
})();
