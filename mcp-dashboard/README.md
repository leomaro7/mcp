# MCP Data Dashboard

データセットを **ソート / フィルタ / 検索できる表 ＋ アニメーション付き棒グラフ** として描画する **MCP App** です。
`show-dataset` ツールと、その結果を表示する UI リソースを 1 つの MCP サーバーにまとめています。

![concept](https://img.shields.io/badge/MCP-App-2563eb) ![runtime](https://img.shields.io/badge/runtime-tsx%2Fnode-16a34a)

---

## MCP App とは

普通の MCP ツールは **テキスト / JSON を返すだけ** ですが、MCP App は **「ツール ＋ 触れる HTML UI」** をセットで返せます。
対応ホスト（Claude Desktop など）でツールが呼ばれると、ホストが UI を iframe で描画し、ユーザーがその場で操作できます。

```
ホストがツールを呼ぶ → ホストが UI リソースを描画 → サーバーが結果を返す → UI が ontoolresult で受信して描画
```

LLM に毎回 HTML を生成させる方式（Artifacts 等）との違いは「**UI が生きてサーバーと繋がっている**」点です。

| 観点 | LLM 生成 HTML | MCP App の UI |
|---|---|---|
| サーバー接続 | 無い（焼き込み・一度きり） | UI から `callServerTool` で再呼び出し可能 |
| データ更新 | 作り直し（再生成） | `ontoolresult` でデータだけ差し替え |
| 再現性 / コスト | 毎回ゆらぐ・全体をトークン生成 | 固定資産を使い回し、流すのはデータのみ |

→ **「何度も触る・最新データを引く・操作がツール呼び出しに繋がる」UI** に向きます。逆に一度きりの静的表示なら普通のツールで十分です。

---

## 使い方（npx で起動）

このパッケージは GitHub リポジトリ [`leomaro7/mcp`](https://github.com/leomaro7/mcp) の **`mcp-dashboard/` サブディレクトリ**にあります。MCP ホスト（Claude Desktop など）からは stdio で起動します。

> npm/npx は Git の「サブディレクトリ」を直接は扱えません（pip/uv の `#subdirectory=` のような機能が無い）。そのため、Git から直接 `npx` したい場合は npm に公開するか、ローカルのソースを指して起動します。

### A. npm に公開して使う（uvx と同じ感覚・推奨）

```bash
cd mcp-dashboard
npm login                      # 初回のみ。スコープ @leomaro7 は npm アカウント名に合わせる
npm publish --access public
```

公開後はパッケージ名だけで起動できます。

```json
{
  "mcpServers": {
    "data-dashboard": {
      "command": "npx",
      "args": ["-y", "@leomaro7/mcp-dashboard@latest", "--stdio"]
    }
  }
}
```

### B. 手元のソースから（開発中・公開なしで今すぐ動かす）

`<クローン先>` は各自がリポジトリを置いたパスに置き換えてください（例: `~/dev/mcp/mcp-dashboard`）。

```json
{
  "mcpServers": {
    "data-dashboard": {
      "command": "npx",
      "args": ["tsx", "<クローン先>/mcp-dashboard/main.ts", "--stdio"]
    }
  }
}
```

環境変数展開に対応するホスト（Claude Code の `.mcp.json` など）では `${HOME}` を使って書けます。

```json
{
  "mcpServers": {
    "data-dashboard": {
      "command": "npx",
      "args": ["tsx", "${HOME}/mcp/mcp-dashboard/main.ts", "--stdio"]
    }
  }
}
```

> 注意: Claude Desktop の設定ファイルは一般に変数展開に対応しないため、その場合は `<クローン先>` を実際の絶対パスに書き換えてください。
>
> いずれの方法でも、画面付きで使うには MCP Apps の UI 描画に対応したホストが必要です。設定変更後はホストの再起動を忘れずに。

---

## 機能

- 値に比例して伸びる横棒グラフ（アニメーション付き）
- カテゴリ別の自動色分け＋チップで表示 ON/OFF 切替
- ラベル検索 / 値・ラベルでのソート
- 件数・合計・平均・最大の集計カード
- 保存形式（**JSON / CSV / HTML**）をプルダウンで選び、ボタンひとつでローカルに保存（`callServerTool` 経由）
- ホストのテーマ（ライト/ダーク）・フォント・セーフエリアに追従
- UI 非対応ホスト向けの **テキストフォールバック**を同梱

---

## プロジェクト構成

| ファイル | 役割 |
|----------|------|
| `server.ts` | `show-dataset` ツールと UI リソース（`ui://show-dataset/mcp-app.html`）を登録 |
| `main.ts` | HTTP（`/mcp`）/ stdio トランスポートのエントリポイント |
| `mcp-app.html` | ダッシュボード UI の骨格 |
| `src/mcp-app.ts` | データ受信・ソート/フィルタ/検索・描画ロジック |
| `src/dashboard.css` | 棒グラフ・チップ・統計カードのスタイル |
| `src/global.css` | ホストのスタイル変数へのフォールバック |
| `vite.config.ts` | `vite-plugin-singlefile` で UI を単一 HTML にバンドル |

---

## ツール仕様: `show-dataset`

| 引数 | 型 | 説明 |
|------|----|------|
| `title` | `string?` | 見出し |
| `unit` | `string?` | 値の単位（例: `人`, `$`, `ms`） |
| `rows` | `{ label: string, value: number, category?: string }[]?` | 可視化するデータ点。省略時はサンプルを表示 |

**戻り値**: `structuredContent`（UI が描画に使用）＋ `content`（テキストフォールバック）。

UI の保存プルダウンで形式を選び「保存」ボタンを押すと、形式に応じて以下の UI 無しツールが `callServerTool` で呼ばれます。チャット内の UI 操作をサーバー側の実処理（ファイル書き込み）に繋ぐ MCP Apps の往復例です。いずれも戻り値は `{ savedPath, bytes, savedAt }`。

### ツール仕様: `save-dataset`（JSON）

データセットをそのまま JSON で保存します。

| 引数 | 型 | 説明 |
|------|----|------|
| `path` | `string` | 保存先。相対パスは `./saved` 配下に解決。`.json` 拡張子は自動付与 |
| `title` / `unit` / `rows` | — | 保存するデータセット |

### ツール仕様: `save-csv`（CSV）

`rows` を `label,value,category` の CSV に変換して保存します（カンマ・引用符・改行を含む値はクォート）。

| 引数 | 型 | 説明 |
|------|----|------|
| `path` | `string` | 保存先。相対パスは `./saved` 配下に解決。`.csv` 拡張子は自動付与 |
| `rows` | — | 保存するデータ点 |

### ツール仕様: `save-html`（HTML）

UI が描画済みの DOM を自己完結 HTML 文字列にして送り、サーバーはそれをそのままファイルに書きます（ブラウザで開ける静的エクスポート）。

| 引数 | 型 | 説明 |
|------|----|------|
| `path` | `string` | 保存先。相対パスは `./saved` 配下に解決。`.html` 拡張子は自動付与 |
| `html` | `string` | UI が生成した自己完結 HTML ドキュメント |

入力例:

```json
{
  "title": "言語別人気度",
  "unit": "pt",
  "rows": [
    { "label": "Rust",   "value": 90,  "category": "systems" },
    { "label": "Go",     "value": 75,  "category": "systems" },
    { "label": "Python", "value": 120, "category": "scripting" }
  ]
}
```

---

## セットアップ（初回のみ）

```bash
cd /Users/naata/mcp/mcp-dashboard
npm install
```

要件: Node.js v20+。`bun` は不要（すべて `tsx` で動作）。

---

## 開発コマンド

```bash
npm run dev          # UI を watch ビルドしつつ HTTP サーバーを起動
npm run build        # UI を dist/mcp-app.html に単一ファイルでバンドル
npm run serve        # HTTP サーバー起動（PORT 既定 3001、エンドポイント /mcp）
npm run serve:stdio  # stdio トランスポートで起動
npm run start        # build → serve をまとめて実行
npm run typecheck    # tsc --noEmit
```

> サーバーは `dist/mcp-app.html` を読み込むため、`serve` の前に必ず `build` が必要です（`npm run start` は両方を実行）。
> ポートを変えるには `PORT=3000 npm run serve` のように指定します。

---

## 動かし方 A: ローカルの確認用ホスト（basic-host）で試す

MCP App は単体では画面が出ません。まず動きを見るなら、MCP SDK 付属の `basic-host`（確認用の最小ホスト）が手軽です。

**ターミナル 1 — このサーバー**

```bash
cd /Users/naata/mcp/mcp-dashboard
npm run start          # http://localhost:3001/mcp
```

**ターミナル 2 — basic-host**

```bash
# 初回だけ: SDK サンプルを取得
git clone --branch "v$(npm view @modelcontextprotocol/ext-apps version)" --depth 1 \
  https://github.com/modelcontextprotocol/ext-apps.git /tmp/mcp-ext-apps

# 依存はリポジトリのルートでまとめて入れる（postinstall の husky は無視）
cd /tmp/mcp-ext-apps && npm install --ignore-scripts

# UI をビルド（index.html / sandbox.html）
cd examples/basic-host
NODE_ENV=development INPUT=index.html  npx vite build
NODE_ENV=development INPUT=sandbox.html npx vite build

# ホスト起動（serve.ts は tsx で動く。bun 不要）
SERVERS='["http://localhost:3001/mcp"]' npx tsx serve.ts
```

**ブラウザ**

1. http://localhost:8080 を開く
2. ツール `show-dataset` を選ぶ
3. パラメータ空のまま実行 → サンプル（都市別ユーザー数）が表＋棒グラフで表示
4. 上記「入力例」を入れると差し替わる
5. 表示後、UI 上で検索・ソート・カテゴリ切替が動く

**終了**: 各ターミナルで `Ctrl + C`。残った場合は下記トラブルシュート参照。

---

## 動かし方 B: Claude Desktop など MCP ホストに登録して使う

設定ファイル（macOS の Claude Desktop なら `~/Library/Application Support/Claude/claude_desktop_config.json`）に、冒頭の[使い方（npx で起動）](#使い方npx-で起動)の A / B いずれかの `mcpServers` 設定を貼り、ホストを再起動します。

チャットで「都市別データをダッシュボードで見せて」のように頼むと `show-dataset` が呼ばれ、表＋棒グラフの UI が会話内に表示されます。手元のソースから動かす B の場合は、事前に一度 `npm run build` を実行してください（`dist/mcp-app.html` が必要なため）。

---

## 疎通確認（HTTP）

HTTP モードは **`127.0.0.1`（ループバック）限定でバインド**し、SDK の DNS リバインディング保護を有効にしています（保存系ツールがローカルディスクに書き込むため、LAN や任意の Web オリジンには公開しません）。

サーバー起動後、`curl` で直接ツールを叩けます（レスポンスは SSE 形式）。

```bash
# ツール一覧
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# ツール呼び出し（引数なし = サンプル）
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"show-dataset","arguments":{}}}'
```

---

## ポート早見表

| ポート | 役割 |
|--------|------|
| 3001 | このダッシュボード MCP サーバー（HTTP, `/mcp`） |
| 8080 | basic-host（確認用ホスト） |
| 8081 | basic-host のサンドボックス（UI 隔離用） |

---

## トラブルシュート

| 症状 | 対処 |
|------|------|
| `EADDRINUSE`（ポート使用中） | `lsof -nP -iTCP:3001 -sTCP:LISTEN` で確認し `kill $(lsof -nP -tiTCP:3001 -sTCP:LISTEN)` |
| basic-host の `npm install` が husky で失敗 | monorepo のルートで `npm install --ignore-scripts` |
| `bun: command not found` | 本プロジェクトと basic-host はどちらも `npx tsx` で起動可能。bun は不要 |
| UI が表示されずテキストだけ出る | ホストが MCP App 非対応。`basic-host` か Claude Desktop で確認 |
| サーバーは起動するが UI が出ない | `dist/mcp-app.html` 未ビルド。`npm run build` を実行 |

---

## ライセンス

MIT
