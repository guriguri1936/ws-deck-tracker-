# 開発引き継ぎメモ(Codex等の別AIエージェント向け)

このファイルは、Claude Codeでの開発をCodexなど別のツール/セッションに引き継ぐためのスナップショットです。

- **仕様(データスキーマ・指標定義・管理ツールの使い方)は [README.md](README.md) が正です。** 本書はそれを補完する「現状・設計判断・注意点・TODO」のメモで、READMEと内容が重複しないようにしています。
- **作業ルール(コミット規約・作業の進め方)は [CLAUDE.md](CLAUDE.md) を参照してください。** Claude Code以外のツールでは自動で読み込まれない可能性があるため、必ず先に目を通してから作業してください。特に「実装前に方針を提案し、承認を得てから着手する」「明示的なpush指示がない限りpushしない」は厳守。
- 読む順序の目安: `README.md`(仕様) → 本書(現状・注意点・TODO) → `CLAUDE.md`(作業ルール)

## 1. プロジェクト概要

ヴァイスシュバルツ(TCG)の大会結果を蓄積し、デッキ使用率・優勝率・カード採用率を可視化する静的サイト。ビルド不要・外部ライブラリ依存なしの素のHTML/CSS/JavaScript。`package.json`・テストフレームワーク・CI設定は存在しない。

```
/docs/    公開用サイト(GitHub Pagesで配信、閲覧専用)
/admin/   非公開のローカル専用ツール(大会結果・各種マスタの入力用、公開しない)
```

## 2. ファイル構成マップ

```
docs/
  index.html        メタゲームトップ(デッキタイル上位15件 + 「もっと見る」導線、右サイドバーに直近大会結果)
  metagame.html      全デッキ表示ページ(検索・並び替え・タイトル絞り込み付き)
  deck.html          デッキ詳細ページ(?title=&climax=...、カード採用率・入賞デッキリスト)
  tournament.html    大会1件分の結果一覧ページ(?event=...)
  cards.html         ★README未記載: 殿堂入りカードランキング(全デッキ横断のカード採用率ランキング、上位30件)
  js/
    common.js        共通ロジック(データ読込・フィルタ・集計・タイル描画・URL生成など、他の全ページから読み込まれる)
    main.js           index.html固有(TILE_DISPLAY_LIMIT=15の上位表示)
    metagame.js        metagame.html固有(検索/ソート/タイトル絞り込み)
    deck.js            deck.html固有
    tournament.js       tournament.html固有
    cards-ranking.js    cards.html固有(HALL_OF_FAME_LIMIT=30)
  css/style.css       公開サイト共通スタイル
  data/
    tournaments.json  大会結果本体(唯一の大元データ)
    cards.json        カードマスタ(種別・レベル・クライマックス種別・画像URL)
    deckImages.json   デッキ代表画像マスタ(タイトル+クライマックス構成キー)

admin/
  index.html         3タブ構成(大会結果入力/代表画像マスタ管理/カードマスタ管理)、file://で直接開いて動作
  js/
    admin.js           大会結果入力タブ(一括貼り付け解析・個別編集・削除・自動仮登録など、最大のファイル)
    deck-images.js      代表画像マスタタブ
    card-master.js      カードマスタタブ
  css/style.css       管理画面スタイル
  bookmarklet/
    cardlist-copy.js    公式カードリスト(ws-tcg.com)貼り付け用ブックマークレットの可読ソース
    decklog-copy.js     デッキログ(decklog.bushiroad.com)貼り付け用ブックマークレットの可読ソース
    install.html        ↑2つを手動minifyして埋め込んだ配布用ページ(実際に使うのはこちら)

_to_delete/          旧・クライマックスカード管理タブの名残(admin/data/climaxCards.json等)。cards.jsonへ統合済みで削除待ち。
start-server.bat      docs/を8080番でローカル配信するバッチ(Python必須)
```

## 3. 直近の実装状況(git log要約、新しい順)

- カードマスタ・大会データの引用符化け(“ ”→'）を修正、恒久対策としてdecklog貼り付けツールに`fixMojibakeQuotes`を実装
- 大会結果入力画面の枠(優勝/準優勝/TOP4/チーム/プレイヤー枠)の境界線を視認性改善
- 大会結果一括貼り付けで数字始まりカード名(例:「365 Days 藤島 慈」)が誤解析される不具合を修正(`BULK_PATTERNS`の順序依存)
- メタゲーム(全デッキ)ページにタイトル絞り込み・検索・並び替えを追加
- メタゲームのデッキ表示を上位15件に絞り、全デッキ表示ページ(`metagame.html`)への導線を追加
- カードリスト貼り付けツールで全13種のクライマックス種別を自動判定できるように拡張(soul2つ→+2、bounce→風、shot/stock/discovery/chance追加)
- 大会結果入力タブに「結果の個別修正」「大会ごとの削除」機能を追加(README §管理ツールの使い方に記載済み)

## 4. アーキテクチャ上の重要な設計判断

- **単一データソース**: `docs/data/tournaments.json` が唯一の大元。`cards.json`・`deckImages.json`はそこから参照されるマスタで、正規化は「タイトル+クライマックス構成」の組み合わせキー。
- **ビルドなし・共有モジュールなし**: 各ページはscriptタグの並び(`common.js`→ページ固有js)だけで依存関係を表現している。import/exportやbundlerは無い。
- **`docs/`は書き込み手段を一切持たない**: フォームも保存APIも無い。データ更新は必ず`admin/`でJSONを作り直し、ファイルを手動で置き換える運用。
- **`CLIMAX_OPTIONS`(クライマックス13種の定義・並び順)が4ファイルに重複定義**: `docs/js/common.js` / `admin/js/admin.js` / `admin/js/deck-images.js` / `admin/js/card-master.js`。追加・変更時は4ファイル同時修正が必須(README既記載)。

## 5. 既知の注意点・落とし穴(README未記載分)

- **`admin/bookmarklet/install.html`は手動minify同期が必要**: 配布実体は`install.html`に埋め込まれた圧縮版JavaScriptで、可読ソース(`cardlist-copy.js`/`decklog-copy.js`)を直しても自動反映されない。**ブックマークレットを修正したら必ず`install.html`側も手動で圧縮して埋め込み直すこと。**
- **`admin/js/admin.js`の`BULK_PATTERNS`は配列の順序に意味がある**: 正規表現は上から順にマッチが試され、最初にマッチしたものが採用される。特に「タブ区切り名前→枚数」パターンより先に「数字始まり」パターンを置くと、数字で始まるカード名を誤って枚数として解釈するバグが再発する(過去に実際発生・修正済み)。パターンを追加する際は既存の並び順を崩さないよう注意。
- **`fixMojibakeQuotes`(decklog-copy.js)はヒューリスティック**: decklog.bushiroad.comのHTML側のバグ(カード名中の全角引用符“ ”が`alt`属性でシングルクオート'に化ける)を、「シングルクオートがちょうど2個ある場合のみ」補正で吸収している。「'24」のような単独アポストロフィ表記を誤爆させないための条件なので、条件を緩めると誤爆リスクが増える。
- **テスト・ビルド・CIは無い**: 動作確認は基本的にNode.jsでの関数抽出テスト(スクラッチ)や、Playwrightをその都度一時ディレクトリにインストールしてのブラウザ操作確認で行っている。リポジトリ自体には依存関係が無い。
- **ローカルプレビューはキャッシュに注意**: `start-server.bat`のPythonサーバーはキャッシュ制御ヘッダーを送らないため、更新後は強制リロードが必要(README既記載)。
- **`_to_delete/`は削除待ちの旧ファイル**: 中身(`admin/data/climaxCards.json`等)は`cards.json`に統合済みで、フォルダごと削除して問題ない見込みだが、まだ実行されていない。
- **プレイヤー名は扱わない方針**: 個人が特定される情報を載せない運用のため、新機能でプレイヤー名を追加する提案が出た場合は要確認。

## 6. TODO / 保留中の提案

2026-09-06に「メタゲームページをさらに良くする案5つ」として提案し、うち1件(検索・ソート・タイトル絞り込み)のみ採用済み。残り4件は未着手・未確定:

- デッキ使用率・優勝率の推移グラフ(週次/月次の時系列表示)
- カード個別ページ(カード単位での採用デッキ一覧・採用率集計)
- X(Twitter)投稿からの大会結果取り込みツール
- `docs/data/tournaments.json`の分割(データ量増加時にcards部分を`decks.json`へ分離、README §既知の制限にも記載あり)

このほかREADME §既知の制限・今後の拡張余地に記載の「タイトル名・カード名の表記ゆれ吸収(`aliases.json`案)」も未着手。

(Claude Code側では`~/.claude/projects/.../memory/`にも同内容を記録しているが、Codex等の他ツールからは参照できないため、正はこのセクション。着手・却下したら本セクションを更新すること。)

## 7. 動作確認・デプロイ

- ローカル確認: `start-server.bat`(docs/を8080番で配信) または `npx serve docs` / `python -m http.server --directory docs 8080`。`admin/`はfile://で直接開ける。
- デプロイ: GitHub Pages、`main`ブランチの`/docs`フォルダを配信元に設定(README §GitHub Pagesでの公開手順を参照)。`admin/`は配信対象外。
- コミット規約: Conventional Commits、本文は日本語。`Co-Authored-By`等の著者表記はツールごとの規約に従う。
