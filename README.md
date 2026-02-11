# Thunderbird MCP Server

MCP (Model Context Protocol) server that gives AI agents access to Thunderbird email, contacts, and calendars. Works with any MCP-compatible client — Claude, OpenClaw, or custom integrations.

## Architecture

```
MCP Client (stdio JSON-RPC 2.0)
    ↓
mcp-bridge.cjs (Node.js)
    ↓ HTTP POST localhost:8765
Thunderbird Extension
    ↓ Thunderbird APIs
Email / Contacts / Calendars
```

## Prerequisites

- **Thunderbird** 102+
- **Node.js** 18+
- **zip** command (for building the extension)

## Setup

### 1. Build the extension

```bash
./scripts/build.sh
```

Creates `dist/thunderbird-mcp.xpi`.

### 2. Install to Thunderbird

```bash
./scripts/install.sh
```

Auto-detects your Thunderbird profile and copies the extension. Restart Thunderbird after installing.

**Alternative (manual install):** Open Thunderbird → Tools → Add-ons and Themes → gear icon → Install Add-on From File → select `dist/thunderbird-mcp.xpi`.

### 3. Verify

Check the Thunderbird console (Tools → Developer Tools → Error Console) for:
```
Thunderbird MCP server listening on port 8765
```

### 4. Configure your MCP client

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "thunderbird": {
      "command": "node",
      "args": ["/path/to/thunderbird-mcp/mcp-bridge.cjs"]
    }
  }
}
```

### 5. Test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node mcp-bridge.cjs
```

Should return all 10 tools.

## Tools

### listAccounts
List all configured email accounts and their identities.
```json
{ "name": "listAccounts", "arguments": {} }
```

### searchMessages
Search message headers with filtering. Good for finding emails by sender, subject, date range.
```json
{
  "name": "searchMessages",
  "arguments": {
    "query": "invoice",
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "maxResults": 20,
    "sortOrder": "desc"
  }
}
```

### fullTextSearch
Full-text search across message bodies using Thunderbird's Gloda index. Faster for body content.
```json
{ "name": "fullTextSearch", "arguments": { "query": "project deadline" } }
```

### getMessage
Read full email content by ID and folder path (from search results).
```json
{
  "name": "getMessage",
  "arguments": {
    "messageId": "abc123@example.com",
    "folderPath": "mailbox://user@imap.example.com/INBOX"
  }
}
```

### sendMail
Send an email immediately (auto-send, no user confirmation).
```json
{
  "name": "sendMail",
  "arguments": {
    "to": "recipient@example.com",
    "subject": "Hello",
    "body": "Message body here",
    "cc": "cc@example.com",
    "bcc": "bcc@example.com"
  }
}
```

### composeMail
Open a compose window for user review before sending (safer).
```json
{
  "name": "composeMail",
  "arguments": {
    "to": "recipient@example.com",
    "subject": "Draft for review",
    "body": "Please review before sending"
  }
}
```

### replyToMessage
Reply to a message with quoted original and proper threading.
```json
{
  "name": "replyToMessage",
  "arguments": {
    "messageId": "abc123@example.com",
    "folderPath": "mailbox://user@imap.example.com/INBOX",
    "body": "Thanks for your message!",
    "replyAll": true
  }
}
```

### forwardMessage
Forward a message with original attachments preserved.
```json
{
  "name": "forwardMessage",
  "arguments": {
    "messageId": "abc123@example.com",
    "folderPath": "mailbox://user@imap.example.com/INBOX",
    "to": "forward-to@example.com",
    "body": "FYI - see below"
  }
}
```

### searchContacts
Search contacts by name or email across all address books.
```json
{ "name": "searchContacts", "arguments": { "query": "john" } }
```

### listCalendars
List all configured calendars.
```json
{ "name": "listCalendars", "arguments": {} }
```

## Known Limitations

- **IMAP folders may be stale**: Thunderbird doesn't always sync IMAP folders in the background. Click a folder in the UI to force sync, or the extension will attempt `updateFolder()` as a best-effort.
- **Compose window tools** (`composeMail`, `replyToMessage`, `forwardMessage`) open a window — user must click Send manually.
- **sendMail** sends immediately without confirmation. Use `composeMail` if you want human review.
- **Port 8765** is hardcoded. If another service uses this port, the extension won't start.
- **No authentication** on the HTTP server. Only listens on localhost, but any local process can access it.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection failed" from bridge | Thunderbird isn't running or extension isn't loaded |
| Extension doesn't appear | Check that experiment APIs are enabled in Thunderbird config |
| "Port 8765 in use" | Another service is using the port; stop it or modify `MCP_PORT` in `server/api.js` |
| Search returns no results | Gloda index may not be built yet — wait for Thunderbird to index your mail |
| Emoji/unicode garbled | Ensure Thunderbird and Node.js are both using UTF-8 |

## OpenClaw Integration

Using this with OpenClaw? Two guides available:

- **[OPENCLAW-SETUP.md](OPENCLAW-SETUP.md)** — Quick setup: install extension, configure MCPorter, wire it up
- **[OPENCLAW-AGENT-GUIDE.md](OPENCLAW-AGENT-GUIDE.md)** — Full agent build: workspace layout, AGENTS.md, SOUL.md, USER.md, openclaw.json config, example conversations, and troubleshooting

## Credits

Built by combining approaches from:
- [TKasperczyk/thunderbird-mcp](https://github.com/TKasperczyk/thunderbird-mcp) — rich tool implementations
- [bb1/thunderbird-mcp](https://github.com/bb1/thunderbird-mcp) — clean modular architecture + Gloda search

## License

MIT
