# Thunderbird Email for OpenClaw Agents — Setup Guide

This guide walks you through giving your OpenClaw agent full email capabilities via Thunderbird. Your agent will be able to search, read, compose, send, reply to, and forward emails.

## Architecture

```
OpenClaw Agent
    ↓  exec tool (shell command)
mcporter CLI
    ↓  stdio (MCP JSON-RPC)
mcp-bridge.cjs (Node.js)
    ↓  HTTP POST localhost:8765
Thunderbird Extension
    ↓  Thunderbird APIs
Your Email
```

OpenClaw doesn't speak MCP natively — MCPorter bridges the gap. The agent calls `mcporter` via shell, MCPorter talks MCP to our bridge, and the bridge talks HTTP to the Thunderbird extension.

---

## Prerequisites

- **Thunderbird** 102+ installed and configured with your email account(s)
- **Node.js** 18+
- **MCPorter** — `npm install -g mcporter` (or use `npx mcporter`)
- **OpenClaw** with the MCPorter skill installed
- **zip** command (for building the extension)

---

## Step 1: Install the Thunderbird MCP Extension

```bash
# Clone and build
git clone <this-repo> thunderbird-mcp
cd thunderbird-mcp
./scripts/build.sh
```

This creates `dist/thunderbird-mcp.xpi`.

### Install to Thunderbird (choose one):

**Option A — Automatic:**
```bash
./scripts/install.sh
# Restart Thunderbird
```

**Option B — Manual:**
1. Open Thunderbird
2. Go to Tools → Add-ons and Themes
3. Click the gear icon → Install Add-on From File
4. Select `dist/thunderbird-mcp.xpi`
5. Restart Thunderbird

### Verify

Open Thunderbird's error console (Tools → Developer Tools → Error Console) and look for:
```
Thunderbird MCP server listening on port 8765
```

---

## Step 2: Configure MCPorter

Create or edit your MCPorter config at `config/mcporter.json` in your OpenClaw agent's workspace (or `~/.mcporter/mcporter.json` for global access):

```json
{
  "servers": {
    "thunderbird": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/thunderbird-mcp/mcp-bridge.cjs"]
    }
  }
}
```

> **Important:** Use the absolute path to `mcp-bridge.cjs`.

### Verify MCPorter can see the tools

Make sure Thunderbird is running, then:

```bash
mcporter list thunderbird
```

You should see all 10 tools listed:
```
thunderbird.listAccounts()
thunderbird.searchMessages(query, startDate?, endDate?, maxResults?, sortOrder?)
thunderbird.fullTextSearch(query)
thunderbird.getMessage(messageId, folderPath)
thunderbird.sendMail(to, subject, body, cc?, bcc?, isHtml?, from?, attachments?)
thunderbird.composeMail(to, subject, body, cc?, bcc?, isHtml?, from?, attachments?)
thunderbird.replyToMessage(messageId, folderPath, body, replyAll?, ...)
thunderbird.forwardMessage(messageId, folderPath, to, body?, ...)
thunderbird.searchContacts(query)
thunderbird.listCalendars()
```

### Test a tool call

```bash
mcporter call thunderbird.listAccounts
```

Should return your configured email accounts.

---

## Step 3: Install the MCPorter Skill in OpenClaw

If you don't already have the MCPorter skill, install it from ClawdHub:

```bash
# From your OpenClaw agent workspace
openclaw skill install steipete/mcporter
```

Or manually create `skills/mcporter/SKILL.md` in your agent's workspace. The skill teaches your agent how to invoke `mcporter` commands.

---

## Step 4: Add Email Instructions to Your Agent

Add the following to your agent's `AGENTS.md` (or `SOUL.md`) so it knows how to use email:

```markdown
## Email Access (Thunderbird via MCPorter)

You have access to the user's email through Thunderbird. Use `mcporter` to interact with it.
Thunderbird must be running for email tools to work.

### Available Commands

**List email accounts:**
mcporter call thunderbird.listAccounts

**Search emails by header (sender, subject, recipients):**
mcporter call thunderbird.searchMessages query="search term" maxResults=20 sortOrder=desc
mcporter call thunderbird.searchMessages query="" startDate=2025-01-01 endDate=2025-12-31

**Full-text search across email bodies:**
mcporter call thunderbird.fullTextSearch query="project deadline"

**Read a specific email (use id and folderPath from search results):**
mcporter call thunderbird.getMessage messageId="msg-id@example.com" folderPath="mailbox://..."

**Send an email immediately (no confirmation):**
mcporter call thunderbird.sendMail to="recipient@example.com" subject="Hello" body="Message here"

**Open compose window for user review before sending:**
mcporter call thunderbird.composeMail to="recipient@example.com" subject="Draft" body="Please review"

**Reply to an email:**
mcporter call thunderbird.replyToMessage messageId="msg-id@example.com" folderPath="mailbox://..." body="Thanks!"

**Reply all:**
mcporter call thunderbird.replyToMessage messageId="msg-id@example.com" folderPath="mailbox://..." body="Thanks!" replyAll=true

**Forward an email:**
mcporter call thunderbird.forwardMessage messageId="msg-id@example.com" folderPath="mailbox://..." to="someone@example.com"

**Search contacts:**
mcporter call thunderbird.searchContacts query="john"

**List calendars:**
mcporter call thunderbird.listCalendars

### Guidelines

- Always use `composeMail` (opens window for review) unless the user explicitly asks you to send immediately
- When sending on behalf of the user, confirm the recipient and content before calling `sendMail`
- Use `searchMessages` for filtering by date/sender/subject; use `fullTextSearch` for searching email body content
- To read an email, first search for it, then use `getMessage` with the id and folderPath from the search results
- Always use `--output json` flag when you need to parse the response programmatically
```

---

## Step 5: Grant Tool Permissions

In your OpenClaw agent config, make sure the agent has `exec` tool access (needed to run `mcporter`):

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "allow": ["exec", "read", "write"]
        }
      }
    ]
  }
}
```

---

## Usage Examples

Once everything is set up, your agent can handle requests like:

> **User:** "Check if I got any emails from Sarah this week"
>
> **Agent runs:** `mcporter call thunderbird.searchMessages query="sarah" startDate=2026-02-05 sortOrder=desc`
>
> **Agent:** "You have 3 emails from Sarah this week. The most recent is 'Q1 Budget Review' from yesterday. Want me to open it?"

> **User:** "Yes, read it"
>
> **Agent runs:** `mcporter call thunderbird.getMessage messageId="abc123@example.com" folderPath="mailbox://user@imap.example.com/INBOX"`
>
> **Agent:** "Here's Sarah's email: She's asking for your feedback on the Q1 budget by Friday..."

> **User:** "Reply and tell her I'll review it by Thursday"
>
> **Agent runs:** `mcporter call thunderbird.composeMail to="sarah@example.com" subject="Re: Q1 Budget Review" body="Hi Sarah, I'll have my feedback ready by Thursday. Thanks!"`
>
> **Agent:** "I've opened a reply draft in Thunderbird for your review. Click Send when ready."

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `mcporter list thunderbird` shows nothing | Is Thunderbird running? Check the error console for "MCP server listening on port 8765" |
| "Connection failed" errors | The bridge can't reach Thunderbird. Verify the extension is loaded and port 8765 is free |
| Agent says it can't find mcporter | Install MCPorter globally (`npm i -g mcporter`) or ensure `npx mcporter` works |
| Search returns no results | Thunderbird's Gloda index may not be built yet. Let Thunderbird run for a while to index your mail |
| Emails are stale / missing recent | IMAP folders may need a manual sync. Click the folder in Thunderbird to refresh |
| sendMail fails | Check that the `compose.send` permission is granted and the email account is properly configured |
| Unicode/emoji garbled in emails | This is handled automatically, but ensure both Node.js and Thunderbird use UTF-8 |

---

## Security Notes

- The Thunderbird extension listens **only on localhost** (127.0.0.1). No remote access is possible.
- There is **no authentication** on the HTTP server. Any local process can call it while Thunderbird is running.
- `sendMail` sends **immediately without confirmation**. Instruct your agent to prefer `composeMail` for safety.
- The agent has access to **all email accounts** configured in Thunderbird. Use OpenClaw's tool permission system to restrict access if needed.

---

## Quick Reference Card

| What | Command |
|------|---------|
| List accounts | `mcporter call thunderbird.listAccounts` |
| Search headers | `mcporter call thunderbird.searchMessages query="term"` |
| Full-text search | `mcporter call thunderbird.fullTextSearch query="term"` |
| Read email | `mcporter call thunderbird.getMessage messageId="..." folderPath="..."` |
| Send immediately | `mcporter call thunderbird.sendMail to="..." subject="..." body="..."` |
| Compose (review) | `mcporter call thunderbird.composeMail to="..." subject="..." body="..."` |
| Reply | `mcporter call thunderbird.replyToMessage messageId="..." folderPath="..." body="..."` |
| Forward | `mcporter call thunderbird.forwardMessage messageId="..." folderPath="..." to="..."` |
| Search contacts | `mcporter call thunderbird.searchContacts query="name"` |
| List calendars | `mcporter call thunderbird.listCalendars` |
