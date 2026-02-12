---
name: thunderbird-email
description: Search, read, compose, reply, and forward emails via Thunderbird.
metadata: {"clawbot":{"emoji":"📬"},"requires":{"bins":["mcporter"]},"install":[{"id":"node","kind":"node","package":"mcporter","bins":["mcporter"],"label":"Install mcporter (node)"}]}
---

# Thunderbird Email

Use the `exec` tool to run `mcporter` shell commands. Every command below is a shell command you run via `exec`.

Example: to list accounts, run `exec("mcporter call thunderbird.listAccounts")`

## Reading

- `mcporter call thunderbird.listAccounts` — list email accounts and identities
- `mcporter call thunderbird.searchMessages query="term" maxResults=20 sortOrder=desc` — search by sender/subject/recipients. Supports `startDate`, `endDate` (ISO 8601). Use `query=""` to match all.
- `mcporter call thunderbird.fullTextSearch query="term"` — search email bodies (Gloda index)
- `mcporter call thunderbird.getMessage messageId="<id>" folderPath="<path>"` — read full email (use id/folderPath from search results)

## Composing

- `mcporter call thunderbird.sendMail to="addr" subject="subj" body="text"` — opens compose window for review
- `mcporter call thunderbird.composeMail to="addr" subject="subj" body="text"` — same as sendMail
- Both support: `cc`, `bcc`, `isHtml=true`, `from="identity"`, `attachments`

## Reply & Forward

- `mcporter call thunderbird.replyToMessage messageId="<id>" folderPath="<path>" body="text"` — add `replyAll=true` for reply-all
- `mcporter call thunderbird.forwardMessage messageId="<id>" folderPath="<path>" to="addr"` — optional `body` for intro text

## Contacts & Calendar

- `mcporter call thunderbird.searchContacts query="name"` — search address books
- `mcporter call thunderbird.listCalendars` — list calendars

## Rules

- All compose tools open a window — the user clicks Send. Nothing auto-sends.
- Confirm recipients and content before composing.
- Summarize search results concisely, don't dump raw JSON.
