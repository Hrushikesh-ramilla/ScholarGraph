# ScholarGraph MCP Server

Exposes ScholarGraph's open academic search capabilities as MCP tools, making them available in Claude Desktop, Cursor, and any other MCP-compatible client.

## Tools

| Tool | Description |
|---|---|
| `search_papers` | Keyword + filter search over federated open-access academic literature (OpenAlex + arXiv, 250M+ papers) |
| `get_paper` | Fetch full metadata for a paper by canonical ID |
| `forward_snowball` | Find papers that *cite* a given paper (recent follow-on work) |
| `backward_snowball` | Find papers *cited by* a given paper (foundational references) |

## Setup

### 1. Install dependencies

```bash
cd mcp
uv sync
```

### 2. Configuration

The server reads from `backend/.env` automatically. Academic search natively queries OpenAlex and arXiv with zero API keys required. An optional `S2_API_KEY` can be provided for fallback queries:

```bash
export S2_API_KEY=your_key_here
```

### 3. Connect to Claude Desktop

Add the following to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "scholargraph": {
      "command": "uv",
      "args": ["run", "python", "server.py"],
      "cwd": "/absolute/path/to/scholargraph/mcp",
      "env": {
        "S2_API_KEY": "your_key_here"
      }
    }
  }
}
```

Replace `/absolute/path/to/scholargraph/mcp` with the actual path on your machine.

### 4. Restart Claude Desktop

The ScholarGraph tools will appear in Claude Desktop's tool list. You can now ask Claude things like:

- *"Find recent papers on test-time compute scaling"*
- *"What papers cite 'Attention Is All You Need'?"*
- *"What are the foundational references in this paper: `<paper_id>`?"*

## Running manually

```bash
cd mcp
uv run python server.py
```

Or with the MCP CLI inspector for debugging:

```bash
uv run mcp dev server.py
```
