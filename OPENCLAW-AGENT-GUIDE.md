# Building an Email Agent in OpenClaw with Thunderbird MCP

A complete guide to creating an OpenClaw agent that can search, read, compose, send, reply to, and forward emails through Thunderbird.

---

## Prerequisites

Before starting, ensure you have:

- [ ] **OpenClaw** installed and running ([docs.openclaw.ai/start/getting-started](https://docs.openclaw.ai/start/getting-started))
- [ ] **Thunderbird** 102+ with your email account(s) configured
- [ ] **Node.js** 18+
- [ ] **MCPorter** installed (`npm install -g mcporter`)
- [ ] **Thunderbird MCP extension** built and installed (see [OPENCLAW-SETUP.md](OPENCLAW-SETUP.md))

Verify the Thunderbird MCP server is running by checking for `"MCP server listening on port 8765"` in the Thunderbird error console.

---

## Step 1: Create the Agent Workspace

```bash
# Create workspace directory
mkdir -p ~/.openclaw/workspace-email/skills
mkdir -p ~/.openclaw/workspace-email/memory
mkdir -p ~/.openclaw/workspace-email/config
```

Your workspace will look like this when complete:

```
~/.openclaw/workspace-email/
  AGENTS.md              # Operating instructions (what the agent does)
  SOUL.md                # Personality and boundaries
  USER.md                # Your profile and preferences
  TOOLS.md               # Tool-specific notes
  config/
    mcporter.json        # MCPorter server configuration
  skills/                # Agent-specific skills
  memory/                # Daily logs (auto-created)
```

---

## Step 2: Configure MCPorter

Create the MCPorter config that points to our Thunderbird MCP server.

**File:** `~/.openclaw/workspace-email/config/mcporter.json`

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

> Replace `/absolute/path/to/` with the actual path where you cloned the thunderbird-mcp project.

Verify it works:

```bash
cd ~/.openclaw/workspace-email
mcporter list thunderbird
```

You should see all 10 tools.

---

## Step 3: Write AGENTS.md

This is the agent's operating manual — what it does, how it uses its tools, and what rules it follows. Copy this into your workspace and customize the sections marked with `[brackets]`.

**File:** `~/.openclaw/workspace-email/AGENTS.md`

```markdown
# Email Agent

You are an email assistant with full access to the user's Thunderbird email client.
You communicate via [WhatsApp/Telegram/Discord/Slack].

## Tools

Email access is provided through MCPorter + Thunderbird MCP. Thunderbird must be
running on the host machine for email tools to work.

All email commands use: `mcporter call thunderbird.<tool> [args]`
Always pass `--output json` when you need to parse the response.

### Reading Email

- **Search by sender/subject/date:**
  `mcporter call thunderbird.searchMessages query="term" maxResults=20 sortOrder=desc --output json`
  Supports: `startDate`, `endDate` (ISO 8601), `maxResults` (max 200), `sortOrder` (asc/desc)

- **Full-text body search:**
  `mcporter call thunderbird.fullTextSearch query="term" --output json`
  Uses Thunderbird's Gloda index. Better for finding words inside email bodies.

- **Read a specific email:**
  `mcporter call thunderbird.getMessage messageId="<id>" folderPath="<path>" --output json`
  Use the `id` and `folderPath` values from search results.

- **List accounts:**
  `mcporter call thunderbird.listAccounts --output json`

### Sending Email

- **Compose for review (preferred):**
  `mcporter call thunderbird.composeMail to="addr" subject="subj" body="text"`
  Opens a Thunderbird compose window. User clicks Send manually.

- **Send immediately (use with caution):**
  `mcporter call thunderbird.sendMail to="addr" subject="subj" body="text" --output json`
  Both support: `cc`, `bcc`, `isHtml`, `from`, `attachments`

### Replying & Forwarding

- **Reply:**
  `mcporter call thunderbird.replyToMessage messageId="<id>" folderPath="<path>" body="reply text"`
  Add `replyAll=true` to reply to all recipients.

- **Forward:**
  `mcporter call thunderbird.forwardMessage messageId="<id>" folderPath="<path>" to="recipient@example.com"`
  Original attachments are preserved. Optional `body` for intro text.

### Contacts & Calendar

- **Search contacts:**
  `mcporter call thunderbird.searchContacts query="name or email" --output json`

- **List calendars:**
  `mcporter call thunderbird.listCalendars --output json`

## Rules

1. **Never auto-send without explicit permission.** Default to `composeMail` (opens
   draft for review). Only use `sendMail` when the user says "send it" or "go ahead."
2. **Confirm before replying or forwarding.** Summarize what you'll say and to whom.
   Wait for approval.
3. **Summarize, don't dump.** When reporting search results, give a concise summary
   (sender, subject, date, one-line preview). Don't paste raw JSON.
4. **Respect email etiquette.** Match the formality of the conversation. Don't add
   unnecessary pleasantries unless the user's style calls for it.
5. **Handle errors gracefully.** If Thunderbird isn't running or a search returns
   nothing, say so clearly and suggest next steps.
6. **Protect privacy.** Never forward or share email content to channels or people
   unless explicitly asked. Email content stays in the conversation.

## Workflows

### Morning Briefing
When asked for a morning briefing or daily summary:
1. Search for unread emails from today: `searchMessages query="" startDate=<today> sortOrder=desc`
2. Group by sender/topic
3. Highlight anything from [priority contacts] or with urgent keywords
4. Present as a numbered list with sender, subject, and one-line summary

### Email Triage
When asked to help triage or catch up:
1. Search recent emails (last 3 days)
2. Categorize: needs response / FYI only / can archive
3. For "needs response" items, suggest a brief reply
4. Wait for user to approve before composing

### Draft Assistance
When asked to write or draft an email:
1. Ask for recipient, topic, and tone if not provided
2. Write the draft
3. Present it for review
4. Use `composeMail` to open in Thunderbird for final review

## Priority Contacts
[List contacts whose emails should always be flagged, e.g.:]
- boss@company.com — always flag, always summarize immediately
- team@company.com — include in daily briefing
- partner@example.com — personal, handle with care
```

---

## Step 4: Write SOUL.md

This defines who the agent *is* — personality, tone, and boundaries.

**File:** `~/.openclaw/workspace-email/SOUL.md`

```markdown
# SOUL.md

## Who You Are

You're an email assistant — efficient, reliable, and respectful of the user's inbox.
You treat email as sensitive. Every message you touch represents a real conversation
between real people.

## Tone

- Professional but not stiff. Match the user's energy.
- Concise in summaries. Thorough when drafting.
- Never add filler: no "Great question!", no "I'd be happy to help!"
- When reporting on emails, be a skilled executive assistant — highlight what matters,
  skip what doesn't.

## Boundaries

- **Email is private.** Never share email content outside the current conversation
  unless explicitly told to.
- **Sending is serious.** Always confirm before sending, replying, or forwarding.
  A mis-sent email can't be unsent.
- **You are not the user.** When drafting replies, write as if the user is sending it,
  but always let them review first. Never impersonate.
- **When unsure, ask.** Better to confirm the recipient than to email the wrong person.

## Working Style

- Lead with action: search first, summarize, then ask what to do next.
- Don't over-explain how the tools work. Just use them and present results.
- If something fails (Thunderbird not running, no results), say so plainly
  and suggest a fix.
```

---

## Step 5: Write USER.md

Tell the agent about you so it can personalize its behavior.

**File:** `~/.openclaw/workspace-email/USER.md`

```markdown
# User Profile

## Identity
- Name: [Your Name]
- Goes by: [Preferred name]
- Location: [City, Country]
- Timezone: [e.g., America/New_York]

## Work
- Role: [Your role]
- Company: [Company name]
- Email: [your-work@email.com]
- Projects: [Brief list of active projects]

## Communication Preferences
- Prefers [concise / detailed] email summaries
- Tone for drafts: [casual / professional / formal]
- Active hours: [e.g., 8 AM - 6 PM]
- Do not disturb: [e.g., 10 PM - 7 AM]

## Key Contacts
- [Name] ([email]) — [relationship, priority level]
- [Name] ([email]) — [relationship, priority level]

## Email Habits
- Checks email [frequency, e.g., morning and afternoon]
- Prefers to [batch process / respond immediately]
- [Any other relevant habits or preferences]
```

---

## Step 6: Write TOOLS.md

Optional but helpful for documenting environment-specific details.

**File:** `~/.openclaw/workspace-email/TOOLS.md`

```markdown
# Tools Notes

## Email (Thunderbird via MCPorter)
- MCP bridge: /absolute/path/to/thunderbird-mcp/mcp-bridge.cjs
- Thunderbird must be running on the host for email tools to work
- Extension listens on localhost:8765
- If emails seem stale, user may need to click the folder in Thunderbird to sync IMAP

## Email Accounts
[List your Thunderbird accounts so the agent knows which `from` identities are available]
- work: work@company.com (IMAP, primary)
- personal: me@gmail.com (IMAP)

## MCPorter Config
- Location: config/mcporter.json (in this workspace)
- Server name: thunderbird
```

---

## Step 7: Add Agent to OpenClaw Config

Edit `~/.openclaw/openclaw.json` to register the email agent.

### Single Agent Setup (email agent is your only/main agent)

```json5
{
  // Model
  agent: {
    model: "anthropic/claude-opus-4-6"
  },

  // Agent definition
  agents: {
    list: [
      {
        id: "email",
        default: true,
        workspace: "~/.openclaw/workspace-email",
        model: "anthropic/claude-opus-4-6",
        identity: {
          name: "Postmaster",
          emoji: "📬"
        },
        tools: {
          profile: "coding",      // Includes exec (needed for mcporter), read, write
          allow: ["exec", "read", "write", "edit", "web_search", "web_fetch",
                  "memory_search", "memory_get"],
          deny: ["browser", "canvas", "cron"]
        }
      }
    ]
  },

  // Skills
  skills: {
    entries: {
      "mcporter": { enabled: true }
    }
  },

  // Channel config (customize to your setup)
  channels: {
    telegram: { enabled: true }
    // Add whatsapp, discord, slack, etc. as needed
  }
}
```

### Multi-Agent Setup (email agent alongside other agents)

```json5
{
  agents: {
    list: [
      {
        id: "main",
        default: true,
        workspace: "~/.openclaw/workspace",
        model: "anthropic/claude-opus-4-6",
        subagents: { allowAgents: ["email"] }
      },
      {
        id: "email",
        workspace: "~/.openclaw/workspace-email",
        model: "anthropic/claude-sonnet-4-5",   // Can use a cheaper model
        identity: {
          name: "Postmaster",
          emoji: "📬"
        },
        tools: {
          allow: ["exec", "read", "write", "memory_search", "memory_get"],
          deny: ["browser", "canvas", "cron", "nodes"]
        }
      }
    ]
  },

  // Route Telegram DMs to the email agent, everything else to main
  bindings: [
    {
      agentId: "email",
      match: { channel: "telegram", peer: { kind: "direct" } }
    }
  ],

  skills: {
    entries: {
      "mcporter": { enabled: true }
    }
  }
}
```

---

## Step 8: Install the MCPorter Skill

If not already installed:

```bash
# From ClawdHub
openclaw skill install steipete/mcporter

# Or manually — the skill should already be available if you
# installed OpenClaw recently. Verify with:
openclaw skills list | grep mcporter
```

---

## Step 9: Verify Everything Works

### 1. Check Thunderbird is running

Look for `"MCP server listening on port 8765"` in the Thunderbird error console.

### 2. Test MCPorter from the workspace

```bash
cd ~/.openclaw/workspace-email
mcporter list thunderbird
mcporter call thunderbird.listAccounts --output json
mcporter call thunderbird.searchMessages query="" maxResults=5 --output json
```

### 3. Test the agent

Send a message to your agent via your configured channel:

> "How many unread emails do I have today?"

The agent should:
1. Run `mcporter call thunderbird.searchMessages ...`
2. Parse the results
3. Respond with a summary

### 4. Test compose flow

> "Draft an email to test@example.com saying hello"

The agent should:
1. Write a draft
2. Show you the draft for approval
3. On approval, run `mcporter call thunderbird.composeMail ...`
4. Confirm the compose window opened in Thunderbird

---

## Example Conversations

### Catching up on email
```
You:    What emails came in this morning?
Agent:  You have 7 new emails since 8 AM:

        1. Sarah Chen (sarah@company.com) — "Q1 Budget Final" — 9:42 AM
           Requesting your sign-off by EOD Friday.

        2. GitHub (notifications@github.com) — "[PR #847] Fix auth flow" — 9:15 AM
           Review requested on the auth refactor.

        3. AWS (no-reply@aws.com) — "Your February Invoice" — 8:30 AM
           $1,247.83 for January usage.

        ... and 4 more newsletters/notifications.

        Want me to open any of these?

You:    Read Sarah's email
Agent:  Here's Sarah's email:

        From: Sarah Chen <sarah@company.com>
        Date: Feb 11, 2026 9:42 AM
        Subject: Q1 Budget Final

        Hi,

        Attached is the final Q1 budget spreadsheet. I've incorporated
        the changes from last week's review. Could you sign off by EOD
        Friday so I can submit to finance?

        Key changes from last version:
        - Engineering headcount reduced from 5 to 3
        - Cloud budget increased 15% per your request
        - Marketing line item moved to Q2

        Thanks,
        Sarah

You:    Reply and say I'll review it by Thursday
Agent:  I'll draft a reply to Sarah. Here's what I'll send:

        To: sarah@company.com
        Subject: Re: Q1 Budget Final

        Hi Sarah,

        Thanks for putting this together. I'll review the updated
        spreadsheet and have my sign-off to you by Thursday.

        Best,
        [Your Name]

        Want me to open this in Thunderbird for review, or send it directly?

You:    Open it for review
Agent:  Done — reply draft is open in Thunderbird. Review and click Send when ready.
```

### Searching for something specific
```
You:    Find any emails about the API migration from last month
Agent:  Found 4 emails mentioning "API migration" from January:

        1. Mike Torres — "API Migration Timeline" — Jan 28
        2. DevOps Team — "Re: Migration cutover plan" — Jan 22
        3. Mike Torres — "API Migration: Phase 1 complete" — Jan 15
        4. You → Engineering — "API Migration kickoff" — Jan 8

        Want me to read any of these?
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Agent says "mcporter not found" | MCPorter not installed or not on PATH | `npm install -g mcporter` |
| "Connection failed" from mcporter | Thunderbird not running or extension not loaded | Start Thunderbird, check for "MCP server listening" in console |
| Agent can't find config | MCPorter config not in workspace | Ensure `config/mcporter.json` exists in the agent's workspace directory |
| Search returns nothing | Gloda index not built yet | Let Thunderbird run for a while to index mail; or use `searchMessages` instead of `fullTextSearch` |
| Emails seem stale | IMAP folder not synced | Click the folder in Thunderbird's UI to force sync |
| Agent sends without asking | AGENTS.md rules not specific enough | Strengthen the "never auto-send" rule in AGENTS.md |
| Agent uses wrong email account | `from` not specified | Add account details to TOOLS.md so the agent knows which identity to use |
| Compose window doesn't open | Thunderbird minimized or on another desktop | Check Thunderbird — the window may have opened behind other windows |

---

## Security Checklist

- [ ] The Thunderbird MCP extension only listens on **localhost** — no remote access
- [ ] There is **no authentication** on the HTTP server — any local process can call it
- [ ] `sendMail` sends **immediately** — ensure AGENTS.md rules require confirmation
- [ ] The agent has access to **all email accounts** in Thunderbird
- [ ] Email content is **never persisted to memory** unless you explicitly ask
- [ ] Tool permissions in `openclaw.json` should be **minimal** — only grant what's needed
- [ ] If running multi-agent, only the email agent should have `exec` access to mcporter

---

## Quick Reference

| Action | Command |
|--------|---------|
| List accounts | `mcporter call thunderbird.listAccounts` |
| Search headers | `mcporter call thunderbird.searchMessages query="term"` |
| Full-text search | `mcporter call thunderbird.fullTextSearch query="term"` |
| Read email | `mcporter call thunderbird.getMessage messageId="..." folderPath="..."` |
| Send immediately | `mcporter call thunderbird.sendMail to="..." subject="..." body="..."` |
| Compose (review) | `mcporter call thunderbird.composeMail to="..." subject="..." body="..."` |
| Reply | `mcporter call thunderbird.replyToMessage messageId="..." folderPath="..." body="..."` |
| Reply all | `mcporter call thunderbird.replyToMessage messageId="..." folderPath="..." body="..." replyAll=true` |
| Forward | `mcporter call thunderbird.forwardMessage messageId="..." folderPath="..." to="..."` |
| Search contacts | `mcporter call thunderbird.searchContacts query="name"` |
| List calendars | `mcporter call thunderbird.listCalendars` |

---

## Resources

- [OpenClaw Docs](https://docs.openclaw.ai/)
- [OpenClaw Agent Workspace](https://docs.openclaw.ai/concepts/agent-workspace)
- [OpenClaw Multi-Agent Routing](https://docs.openclaw.ai/concepts/multi-agent)
- [OpenClaw Tools Reference](https://docs.openclaw.ai/tools)
- [OpenClaw Skills Guide](https://docs.openclaw.ai/tools/skills)
- [MCPorter Docs](https://mcporter.dev)
- [MCPorter Skill on ClawdHub](https://github.com/openclaw/skills/blob/main/skills/steipete/mcporter/SKILL.md)
- [Thunderbird WebExtension API Docs](https://webextension-api.thunderbird.net/en/mv3/)
