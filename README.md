# mcp

自作の MCP サーバーを置くリポジトリです。各サーバーはサブディレクトリにまとまっています。

## サーバー一覧

| ディレクトリ | 概要 |
|------|------|
| [`mcp-dashboard/`](./mcp-dashboard) | データを表＋棒グラフのダッシュボードとして表示し、JSON / CSV / HTML で保存できる **MCP App**（ツール＋UI） |

## 使い方

各サーバーの使い方（`npx` での起動方法・`mcpServers` 設定例）は、それぞれのディレクトリの README を参照してください。

> 補足: npm/npx は Git の「サブディレクトリ」を直接は扱えないため、Git から直接 `npx` する場合は [gitpkg](https://gitpkg.vercel.app) を介すか、npm に公開して使います。詳細は各 README に記載しています。
