# MCP Servers Monorepo

自作 MCP サーバーの monorepo。

## Servers

| Server | Description |
|--------|-------------|
| [hello-mcp-server](src/hello-mcp-server/) | サンプル MCP サーバー（hello / add ツール） |

## Usage

### 前提条件

- [uv](https://docs.astral.sh/uv/) がインストール済み
- `gh auth login` + `gh auth setup-git` で GitHub 認証済み

### MCP クライアント設定例

**Windows** (`settings.json` / `.mcp.json`):
```json
{
  "mcpServers": {
    "hello-mcp-server": {
      "command": "uv",
      "args": [
        "tool", "run", "--from",
        "leomaro7.hello-mcp-server @ git+https://github.com/leomaro7/mcp.git@main#subdirectory=src/hello-mcp-server",
        "leomaro7.hello-mcp-server"
      ],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      }
    }
  }
}
```

**macOS** (`settings.json` / `.mcp.json`):
```json
{
  "mcpServers": {
    "hello-mcp-server": {
      "command": "uvx",
      "args": [
        "--from",
        "leomaro7.hello-mcp-server @ git+https://github.com/leomaro7/mcp.git@main#subdirectory=src/hello-mcp-server",
        "leomaro7.hello-mcp-server"
      ],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      }
    }
  }
}
```
