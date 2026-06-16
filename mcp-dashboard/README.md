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

## 機能

- 値に比例して伸びる横棒グラフ（アニメーション付き）
- カテゴリ別の自動色分け＋チップで表示 ON/OFF 切替
- ラベル検索 / 値・ラベルでのソート
- 件数・合計・平均・最大の集計カード
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

### ツール仕様: `save-dataset`

ダッシュボード UI の「ローカルへ保存」ボタンが `callServerTool` で呼ぶ、UI 無しのツール。
チャット内の UI 操作をサーバー側の実処理（ファイル書き込み）に繋ぐ MCP Apps の往復例。

| 引数 | 型 | 説明 |
|------|----|------|
| `path` | `string` | 保存先。相対パスは `./saved` 配下に解決。`.json` 拡張子は自動付与 |
| `title` / `unit` / `rows` | — | 保存するデータセット |

**戻り値**: `{ savedPath, bytes, savedAt }`。

### ツール仕様: `save-html`

「HTMLで保存」ボタンが呼ぶ、UI 無しのツール。UI が描画済みの DOM を自己完結 HTML 文字列にして送り、
サーバーはそれをそのままファイルに書く（ブラウザで開ける静的エクスポート）。

| 引数 | 型 | 説明 |
|------|----|------|
| `path` | `string` | 保存先。相対パスは `./saved` 配下に解決。`.html` 拡張子は自動付与 |
| `html` | `string` | UI が生成した自己完結 HTML ドキュメント |

**戻り値**: `{ savedPath, bytes, savedAt }`。

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
cd /Users/naata/qiita/mcp-dashboard
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
cd /Users/naata/qiita/mcp-dashboard
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

## 動かし方 B: Claude Desktop に登録して使う（本番）

Claude Desktop は stdio でローカルの MCP サーバーを起動できます。

**1. 事前に一度ビルド**

```bash
cd /Users/naata/qiita/mcp-dashboard && npm run build
```

**2. 設定ファイルを編集**

macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "data-dashboard": {
      "command": "npx",
      "args": ["tsx", "/Users/naata/qiita/mcp-dashboard/main.ts", "--stdio"]
    }
  }
}
```

**3. Claude Desktop を再起動**

チャットで「都市別データをダッシュボードで見せて」のように頼むと `show-dataset` が呼ばれ、表＋棒グラフの UI が会話内に表示されます。

---

## 疎通確認（HTTP）

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
