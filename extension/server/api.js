/* global ExtensionCommon, ChromeUtils, Services, Cc, Ci */
"use strict";

const resProto = Cc[
  "@mozilla.org/network/protocol;1?name=resource"
].getService(Ci.nsISubstitutingProtocolHandler);

const MCP_PORT = 8765;

// -- Tool definitions for all 10 tools --

const tools = [
  {
    name: "listAccounts",
    title: "List Accounts",
    description: "List all email accounts and their identities",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "searchMessages",
    title: "Search Messages (Headers)",
    description: "Search message headers with date/sort/limit filtering. Returns IDs and folder paths for use with getMessage.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to search in subject, author, or recipients (empty string matches all)" },
        startDate: { type: "string", description: "Filter messages on or after this ISO 8601 date" },
        endDate: { type: "string", description: "Filter messages on or before this ISO 8601 date" },
        maxResults: { type: "number", description: "Maximum results to return (default 50, max 200)" },
        sortOrder: { type: "string", description: "Date sort: 'asc' (oldest first) or 'desc' (newest first, default)" },
      },
      required: ["query"],
    },
  },
  {
    name: "fullTextSearch",
    title: "Full-Text Search",
    description: "Search message bodies and headers using Thunderbird's Gloda full-text index. Faster than searchMessages for body content.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to search for across message bodies and headers" },
      },
      required: ["query"],
    },
  },
  {
    name: "getMessage",
    title: "Get Message",
    description: "Read the full content of an email message by its ID and folder path",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "The message ID (from search results)" },
        folderPath: { type: "string", description: "The folder URI path (from search results)" },
      },
      required: ["messageId", "folderPath"],
    },
  },
  {
    name: "sendMail",
    title: "Send Mail",
    description: "Open a compose window with the given email for user review before sending",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address(es), comma-separated" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body text" },
        cc: { type: "string", description: "CC recipients (comma-separated)" },
        bcc: { type: "string", description: "BCC recipients (comma-separated)" },
        isHtml: { type: "boolean", description: "Set true if body contains HTML (default: false)" },
        from: { type: "string", description: "Sender identity (email or identity ID from listAccounts)" },
        attachments: { type: "array", items: { type: "string" }, description: "Array of file paths to attach" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "composeMail",
    title: "Compose Mail",
    description: "Open a compose window for user review before sending",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body text" },
        cc: { type: "string", description: "CC recipients (comma-separated)" },
        bcc: { type: "string", description: "BCC recipients (comma-separated)" },
        isHtml: { type: "boolean", description: "Set true if body contains HTML (default: false)" },
        from: { type: "string", description: "Sender identity (email or identity ID from listAccounts)" },
        attachments: { type: "array", items: { type: "string" }, description: "Array of file paths to attach" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "replyToMessage",
    title: "Reply to Message",
    description: "Open a reply compose window with quoted original and proper threading headers",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "The message ID to reply to" },
        folderPath: { type: "string", description: "The folder URI path" },
        body: { type: "string", description: "Reply body text" },
        replyAll: { type: "boolean", description: "Reply to all recipients (default: false)" },
        isHtml: { type: "boolean", description: "Set true if body contains HTML" },
        to: { type: "string", description: "Override recipient (default: original sender)" },
        cc: { type: "string", description: "CC recipients (comma-separated)" },
        bcc: { type: "string", description: "BCC recipients (comma-separated)" },
        from: { type: "string", description: "Sender identity" },
        attachments: { type: "array", items: { type: "string" }, description: "File paths to attach" },
      },
      required: ["messageId", "folderPath", "body"],
    },
  },
  {
    name: "forwardMessage",
    title: "Forward Message",
    description: "Open a forward compose window with original attachments preserved",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "The message ID to forward" },
        folderPath: { type: "string", description: "The folder URI path" },
        to: { type: "string", description: "Recipient email address" },
        body: { type: "string", description: "Additional text to prepend (optional)" },
        isHtml: { type: "boolean", description: "Set true if body contains HTML" },
        cc: { type: "string", description: "CC recipients (comma-separated)" },
        bcc: { type: "string", description: "BCC recipients (comma-separated)" },
        from: { type: "string", description: "Sender identity" },
        attachments: { type: "array", items: { type: "string" }, description: "Additional file paths to attach" },
      },
      required: ["messageId", "folderPath", "to"],
    },
  },
  {
    name: "searchContacts",
    title: "Search Contacts",
    description: "Find contacts by name or email across all address books",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name or email address to search for" },
      },
      required: ["query"],
    },
  },
  {
    name: "listCalendars",
    title: "List Calendars",
    description: "Return the user's calendars",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

// -- Extension API class --

var mcpServer = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    const extensionRoot = context.extension.rootURI;
    const resourceName = "thunderbird-mcp";

    resProto.setSubstitutionWithFlags(
      resourceName,
      extensionRoot,
      resProto.ALLOW_CONTENT_ACCESS
    );

    return {
      mcpServer: {
        start: async function () {
          try {
            const { HttpServer } = ChromeUtils.importESModule(
              "resource://thunderbird-mcp/httpd.sys.mjs?" + Date.now()
            );
            const { NetUtil } = ChromeUtils.importESModule(
              "resource://gre/modules/NetUtil.sys.mjs"
            );

            // Import domain APIs from other experiment modules
            const { MailServices } = ChromeUtils.importESModule(
              "resource:///modules/MailServices.sys.mjs"
            );

            let cal = null;
            try {
              const calModule = ChromeUtils.importESModule(
                "resource:///modules/calendar/calUtils.sys.mjs"
              );
              cal = calModule.cal;
            } catch {
              // Calendar not available
            }

            const { Gloda } = ChromeUtils.importESModule(
              "resource:///modules/gloda/GlodaPublic.sys.mjs"
            );

            const { MsgHdrToMimeMessage } = ChromeUtils.importESModule(
              "resource:///modules/gloda/MimeMessage.sys.mjs"
            );

            // -- Utility functions --

            /**
             * Read HTTP request body with proper UTF-8 charset.
             * NetUtil defaults to Latin-1, which corrupts emojis/special chars.
             */
            function readRequestBody(request) {
              const stream = request.bodyInputStream;
              return NetUtil.readInputStreamToString(stream, stream.available(), { charset: "UTF-8" });
            }

            /**
             * Pre-encode non-ASCII as UTF-8 bytes for Thunderbird's raw-byte HTTP writer.
             * Strips invalid control characters that break JSON.
             */
            function sanitizeForJson(text) {
              if (!text) return text;
              let sanitized = "";
              for (let i = 0; i < text.length; i++) {
                const code = text.charCodeAt(i);
                if ((code >= 0x00 && code <= 0x08) || code === 0x0b || code === 0x0c ||
                    (code >= 0x0e && code <= 0x1f) || code === 0x7f) {
                  continue;
                }
                if (code <= 0x7f) {
                  sanitized += text[i];
                  continue;
                }
                const codePoint = text.codePointAt(i);
                if (codePoint > 0xffff) {
                  sanitized += String.fromCharCode(
                    0xf0 | (codePoint >> 18),
                    0x80 | ((codePoint >> 12) & 0x3f),
                    0x80 | ((codePoint >> 6) & 0x3f),
                    0x80 | (codePoint & 0x3f)
                  );
                  i++;
                  continue;
                }
                if (codePoint <= 0x7ff) {
                  sanitized += String.fromCharCode(
                    0xc0 | (codePoint >> 6),
                    0x80 | (codePoint & 0x3f)
                  );
                  continue;
                }
                sanitized += String.fromCharCode(
                  0xe0 | (codePoint >> 12),
                  0x80 | ((codePoint >> 6) & 0x3f),
                  0x80 | (codePoint & 0x3f)
                );
              }
              return sanitized;
            }

            function escapeHtml(s) {
              return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            }

            function formatBodyHtml(body, isHtml) {
              if (isHtml) {
                let text = (body || "").replace(/\n/g, "");
                return [...text].map(c => c.codePointAt(0) > 127 ? `&#${c.codePointAt(0)};` : c).join("");
              }
              return escapeHtml(body || "").replace(/\n/g, "<br>");
            }

            function findIdentity(emailOrId) {
              if (!emailOrId) return null;
              const lower = emailOrId.toLowerCase();
              for (const account of MailServices.accounts.accounts) {
                for (const identity of account.identities) {
                  if (identity.key === emailOrId || (identity.email || "").toLowerCase() === lower) {
                    return identity;
                  }
                }
              }
              return null;
            }

            function setComposeIdentity(params, from, fallbackServer) {
              const identity = findIdentity(from);
              if (identity) {
                params.identity = identity;
                return "";
              }
              if (fallbackServer) {
                const account = MailServices.accounts.findAccountForServer(fallbackServer);
                if (account) params.identity = account.defaultIdentity;
              } else {
                const defaultAccount = MailServices.accounts.defaultAccount;
                if (defaultAccount) params.identity = defaultAccount.defaultIdentity;
              }
              return from ? `unknown identity: ${from}, using default` : "";
            }

            function addAttachments(composeFields, attachments) {
              const result = { added: 0, failed: [] };
              if (!attachments || !Array.isArray(attachments)) return result;
              for (const filePath of attachments) {
                try {
                  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                  file.initWithPath(filePath);
                  if (file.exists()) {
                    const attachment = Cc["@mozilla.org/messengercompose/attachment;1"]
                      .createInstance(Ci.nsIMsgAttachment);
                    attachment.url = Services.io.newFileURI(file).spec;
                    attachment.name = file.leafName;
                    composeFields.addAttachment(attachment);
                    result.added++;
                  } else {
                    result.failed.push(filePath);
                  }
                } catch {
                  result.failed.push(filePath);
                }
              }
              return result;
            }

            /**
             * Find a message header by messageId in a given folder.
             */
            function findMsgHdr(folderPath, messageId) {
              const folder = MailServices.folderLookup.getFolderForURL(folderPath);
              if (!folder) return { error: `Folder not found: ${folderPath}` };
              const db = folder.msgDatabase;
              if (!db) return { error: "Could not access folder database" };
              for (const hdr of db.enumerateMessages()) {
                if (hdr.messageId === messageId) {
                  return { msgHdr: hdr, folder };
                }
              }
              return { error: `Message not found: ${messageId}` };
            }

            // -- Tool implementations --

            function listAccounts() {
              const accounts = [];
              for (const account of MailServices.accounts.accounts) {
                const server = account.incomingServer;
                const identities = [];
                for (const identity of account.identities) {
                  identities.push({
                    id: identity.key,
                    email: identity.email,
                    name: identity.fullName,
                    isDefault: identity === account.defaultIdentity,
                  });
                }
                accounts.push({
                  id: account.key,
                  name: server.prettyName,
                  type: server.type,
                  identities,
                });
              }
              return accounts;
            }

            const DEFAULT_MAX_RESULTS = 50;
            const MAX_SEARCH_RESULTS_CAP = 200;
            const SEARCH_COLLECTION_CAP = 1000;

            function searchMessages(query, startDate, endDate, maxResults, sortOrder) {
              const results = [];
              const lowerQuery = (query || "").toLowerCase();
              const hasQuery = !!lowerQuery;
              const parsedStart = startDate ? new Date(startDate).getTime() : NaN;
              const parsedEnd = endDate ? new Date(endDate).getTime() : NaN;
              const startTs = Number.isFinite(parsedStart) ? parsedStart * 1000 : null;
              const endOffset = endDate && !endDate.includes("T") ? 86400000 : 0;
              const endTs = Number.isFinite(parsedEnd) ? (parsedEnd + endOffset) * 1000 : null;
              const limit = Math.min(
                Number.isFinite(Number(maxResults)) && Number(maxResults) > 0
                  ? Math.floor(Number(maxResults))
                  : DEFAULT_MAX_RESULTS,
                MAX_SEARCH_RESULTS_CAP
              );
              const order = sortOrder === "asc" ? "asc" : "desc";

              function searchFolder(folder) {
                if (results.length >= SEARCH_COLLECTION_CAP) return;
                try {
                  if (folder.server?.type === "imap") {
                    try { folder.updateFolder(null); } catch {}
                  }
                  const db = folder.msgDatabase;
                  if (!db) return;
                  for (const msgHdr of db.enumerateMessages()) {
                    if (results.length >= SEARCH_COLLECTION_CAP) break;
                    const subject = (msgHdr.mime2DecodedSubject || msgHdr.subject || "").toLowerCase();
                    const author = (msgHdr.mime2DecodedAuthor || msgHdr.author || "").toLowerCase();
                    const recipients = (msgHdr.mime2DecodedRecipients || msgHdr.recipients || "").toLowerCase();
                    const dateTs = msgHdr.date || 0;
                    if (startTs !== null && dateTs < startTs) continue;
                    if (endTs !== null && dateTs > endTs) continue;
                    if (!hasQuery || subject.includes(lowerQuery) || author.includes(lowerQuery) || recipients.includes(lowerQuery)) {
                      results.push({
                        id: msgHdr.messageId,
                        subject: msgHdr.mime2DecodedSubject || msgHdr.subject,
                        author: msgHdr.mime2DecodedAuthor || msgHdr.author,
                        recipients: msgHdr.mime2DecodedRecipients || msgHdr.recipients,
                        date: msgHdr.date ? new Date(msgHdr.date / 1000).toISOString() : null,
                        folder: folder.prettyName,
                        folderPath: folder.URI,
                        read: msgHdr.isRead,
                        flagged: msgHdr.isFlagged,
                        _dateTs: dateTs,
                      });
                    }
                  }
                } catch {}
                if (folder.hasSubFolders) {
                  for (const sub of folder.subFolders) {
                    if (results.length >= SEARCH_COLLECTION_CAP) break;
                    searchFolder(sub);
                  }
                }
              }

              for (const account of MailServices.accounts.accounts) {
                if (results.length >= SEARCH_COLLECTION_CAP) break;
                searchFolder(account.incomingServer.rootFolder);
              }
              results.sort((a, b) => order === "asc" ? a._dateTs - b._dateTs : b._dateTs - a._dateTs);
              return results.slice(0, limit).map(r => { delete r._dateTs; return r; });
            }

            function fullTextSearch(query) {
              return new Promise((resolve, reject) => {
                try {
                  const q = Gloda.newQuery(Gloda.NOUN_MESSAGE).text(query);
                  const collection = q.getCollection();
                  collection.becomeExplicit();
                  const listener = {
                    onItemsAdded() {},
                    onItemsModified() {},
                    onItemsRemoved() {},
                    onQueryCompleted(coll) {
                      resolve(coll.items.map(m => ({
                        id: m.headerMessageID,
                        subject: m.subject,
                        from: m.from ? m.from.value : null,
                        date: m.date ? m.date.toISOString() : null,
                        folder: m.folder ? m.folder.URI : null,
                      })));
                    },
                  };
                  collection.addListener(listener);
                } catch (e) {
                  reject(e);
                }
              });
            }

            function getMessage(messageId, folderPath) {
              return new Promise((resolve) => {
                const result = findMsgHdr(folderPath, messageId);
                if (result.error) { resolve({ error: result.error }); return; }
                const { msgHdr } = result;
                MsgHdrToMimeMessage(msgHdr, null, (aMsgHdr, aMimeMsg) => {
                  if (!aMimeMsg) { resolve({ error: "Could not parse message" }); return; }
                  let body = "";
                  try {
                    body = sanitizeForJson(aMimeMsg.coerceBodyToPlaintext());
                  } catch {
                    body = "(Could not extract body text)";
                  }
                  resolve({
                    id: msgHdr.messageId,
                    subject: msgHdr.subject,
                    author: msgHdr.author,
                    recipients: msgHdr.recipients,
                    ccList: msgHdr.ccList,
                    date: msgHdr.date ? new Date(msgHdr.date / 1000).toISOString() : null,
                    body,
                  });
                }, true, { examineEncryptedParts: true });
              });
            }

            function composeMail(to, subject, body, cc, bcc, isHtml, from, attachments) {
              try {
                const svc = Cc["@mozilla.org/messengercompose;1"].getService(Ci.nsIMsgComposeService);
                const params = Cc["@mozilla.org/messengercompose/composeparams;1"].createInstance(Ci.nsIMsgComposeParams);
                const fields = Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields);

                fields.to = to || "";
                fields.cc = cc || "";
                fields.bcc = bcc || "";
                fields.subject = subject || "";

                const formatted = formatBodyHtml(body, isHtml);
                fields.body = (isHtml && formatted.includes("<html"))
                  ? formatted
                  : `<html><head><meta charset="UTF-8"></head><body>${formatted}</body></html>`;

                const attResult = addAttachments(fields, attachments);
                params.type = Ci.nsIMsgCompType.New;
                params.format = Ci.nsIMsgCompFormat.HTML;
                params.composeFields = fields;

                const identityWarn = setComposeIdentity(params, from, null);
                svc.OpenComposeWindowWithParams(null, params);

                let msg = "Compose window opened";
                if (identityWarn) msg += ` (${identityWarn})`;
                if (attResult.failed.length) msg += ` (failed to attach: ${attResult.failed.join(", ")})`;
                return { success: true, message: msg };
              } catch (e) {
                return { error: e.toString() };
              }
            }

            function sendMail(to, subject, body, cc, bcc, isHtml, from, attachments) {
              // Delegates to composeMail — always opens a compose window for user review
              return composeMail(to, subject, body, cc, bcc, isHtml, from, attachments);
            }

            function replyToMessage(messageId, folderPath, body, replyAll, isHtml, to, cc, bcc, from, attachments) {
              return new Promise((resolve) => {
                const result = findMsgHdr(folderPath, messageId);
                if (result.error) { resolve({ error: result.error }); return; }
                const { msgHdr, folder } = result;

                MsgHdrToMimeMessage(msgHdr, null, (aMsgHdr, aMimeMsg) => {
                  try {
                    let originalBody = "";
                    if (aMimeMsg) {
                      try { originalBody = aMimeMsg.coerceBodyToPlaintext() || ""; } catch {}
                    }

                    const svc = Cc["@mozilla.org/messengercompose;1"].getService(Ci.nsIMsgComposeService);
                    const params = Cc["@mozilla.org/messengercompose/composeparams;1"].createInstance(Ci.nsIMsgComposeParams);
                    const fields = Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields);

                    if (replyAll) {
                      fields.to = to || msgHdr.author;
                      const splitAddr = (s) => (s || "").match(/(?:[^,"]|"[^"]*")+/g) || [];
                      const extractEmail = (s) => (s.match(/<([^>]+)>/)?.[1] || s.trim()).toLowerCase();
                      const ownAccount = MailServices.accounts.findAccountForServer(folder.server);
                      const ownEmail = (ownAccount?.defaultIdentity?.email || "").toLowerCase();
                      const allRecipients = [
                        ...splitAddr(msgHdr.recipients),
                        ...splitAddr(msgHdr.ccList),
                      ].map(r => r.trim()).filter(r => r && (!ownEmail || extractEmail(r) !== ownEmail));
                      const seen = new Set();
                      const unique = allRecipients.filter(r => {
                        const e = extractEmail(r);
                        if (seen.has(e)) return false;
                        seen.add(e);
                        return true;
                      });
                      fields.cc = cc || (unique.length > 0 ? unique.join(", ") : "");
                    } else {
                      fields.to = to || msgHdr.author;
                      fields.cc = cc || "";
                    }

                    fields.bcc = bcc || "";
                    const origSubject = msgHdr.subject || "";
                    fields.subject = origSubject.startsWith("Re:") ? origSubject : `Re: ${origSubject}`;
                    fields.references = `<${messageId}>`;
                    fields.setHeader("In-Reply-To", `<${messageId}>`);

                    const dateStr = msgHdr.date ? new Date(msgHdr.date / 1000).toLocaleString() : "";
                    const author = msgHdr.mime2DecodedAuthor || msgHdr.author || "";
                    const quotedLines = originalBody.split("\n").map(line => `&gt; ${escapeHtml(line)}`).join("<br>");
                    const quoteBlock = `<br><br>On ${dateStr}, ${escapeHtml(author)} wrote:<br>${quotedLines}`;

                    fields.body = `<html><head><meta charset="UTF-8"></head><body>${formatBodyHtml(body, isHtml)}${quoteBlock}</body></html>`;

                    const attResult = addAttachments(fields, attachments);
                    params.type = Ci.nsIMsgCompType.New;
                    params.format = Ci.nsIMsgCompFormat.HTML;
                    params.composeFields = fields;

                    const identityWarn = setComposeIdentity(params, from, folder.server);
                    svc.OpenComposeWindowWithParams(null, params);

                    let msg = "Reply window opened";
                    if (identityWarn) msg += ` (${identityWarn})`;
                    if (attResult.failed.length) msg += ` (failed to attach: ${attResult.failed.join(", ")})`;
                    resolve({ success: true, message: msg });
                  } catch (e) {
                    resolve({ error: e.toString() });
                  }
                }, true, { examineEncryptedParts: true });
              });
            }

            function forwardMessage(messageId, folderPath, to, body, isHtml, cc, bcc, from, attachments) {
              return new Promise((resolve) => {
                const result = findMsgHdr(folderPath, messageId);
                if (result.error) { resolve({ error: result.error }); return; }
                const { msgHdr, folder } = result;

                MsgHdrToMimeMessage(msgHdr, null, (aMsgHdr, aMimeMsg) => {
                  try {
                    const svc = Cc["@mozilla.org/messengercompose;1"].getService(Ci.nsIMsgComposeService);
                    const params = Cc["@mozilla.org/messengercompose/composeparams;1"].createInstance(Ci.nsIMsgComposeParams);
                    const fields = Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields);

                    fields.to = to;
                    fields.cc = cc || "";
                    fields.bcc = bcc || "";

                    const origSubject = msgHdr.subject || "";
                    fields.subject = origSubject.startsWith("Fwd:") ? origSubject : `Fwd: ${origSubject}`;

                    let originalBody = "";
                    if (aMimeMsg) {
                      try { originalBody = aMimeMsg.coerceBodyToPlaintext() || ""; } catch {}
                    }

                    const dateStr = msgHdr.date ? new Date(msgHdr.date / 1000).toLocaleString() : "";
                    const fwdAuthor = msgHdr.mime2DecodedAuthor || msgHdr.author || "";
                    const fwdSubject = msgHdr.mime2DecodedSubject || msgHdr.subject || "";
                    const fwdRecipients = msgHdr.mime2DecodedRecipients || msgHdr.recipients || "";
                    const escapedBody = escapeHtml(originalBody).replace(/\n/g, "<br>");

                    const forwardBlock =
                      `-------- Forwarded Message --------<br>` +
                      `Subject: ${escapeHtml(fwdSubject)}<br>` +
                      `Date: ${dateStr}<br>` +
                      `From: ${escapeHtml(fwdAuthor)}<br>` +
                      `To: ${escapeHtml(fwdRecipients)}<br><br>` +
                      escapedBody;

                    const introHtml = body ? formatBodyHtml(body, isHtml) + "<br><br>" : "";
                    fields.body = `<html><head><meta charset="UTF-8"></head><body>${introHtml}${forwardBlock}</body></html>`;

                    // Copy original attachments
                    let origAttCount = 0;
                    if (aMimeMsg?.allUserAttachments) {
                      for (const att of aMimeMsg.allUserAttachments) {
                        try {
                          const attachment = Cc["@mozilla.org/messengercompose/attachment;1"]
                            .createInstance(Ci.nsIMsgAttachment);
                          attachment.url = att.url;
                          attachment.name = att.name;
                          attachment.contentType = att.contentType;
                          fields.addAttachment(attachment);
                          origAttCount++;
                        } catch {}
                      }
                    }

                    const attResult = addAttachments(fields, attachments);
                    params.type = Ci.nsIMsgCompType.New;
                    params.format = Ci.nsIMsgCompFormat.HTML;
                    params.composeFields = fields;

                    const identityWarn = setComposeIdentity(params, from, folder.server);
                    svc.OpenComposeWindowWithParams(null, params);

                    let msg = `Forward window opened with ${origAttCount + attResult.added} attachment(s)`;
                    if (identityWarn) msg += ` (${identityWarn})`;
                    if (attResult.failed.length) msg += ` (failed to attach: ${attResult.failed.join(", ")})`;
                    resolve({ success: true, message: msg });
                  } catch (e) {
                    resolve({ error: e.toString() });
                  }
                }, true, { examineEncryptedParts: true });
              });
            }

            function searchContacts(query) {
              const results = [];
              const lower = query.toLowerCase();
              const MAX = 50;
              for (const book of MailServices.ab.directories) {
                for (const card of book.childCards) {
                  if (card.isMailList) continue;
                  const email = (card.primaryEmail || "").toLowerCase();
                  const displayName = (card.displayName || "").toLowerCase();
                  const firstName = (card.firstName || "").toLowerCase();
                  const lastName = (card.lastName || "").toLowerCase();
                  if (email.includes(lower) || displayName.includes(lower) ||
                      firstName.includes(lower) || lastName.includes(lower)) {
                    results.push({
                      id: card.UID,
                      displayName: card.displayName,
                      email: card.primaryEmail,
                      firstName: card.firstName,
                      lastName: card.lastName,
                      addressBook: book.dirName,
                    });
                  }
                  if (results.length >= MAX) break;
                }
                if (results.length >= MAX) break;
              }
              return results;
            }

            function listCalendars() {
              if (!cal) return { error: "Calendar not available" };
              try {
                return cal.manager.getCalendars().map(c => ({
                  id: c.id,
                  name: c.name,
                  type: c.type,
                  readOnly: c.readOnly,
                }));
              } catch (e) {
                return { error: e.toString() };
              }
            }

            // -- Tool dispatcher --

            async function callTool(name, args) {
              switch (name) {
                case "listAccounts":
                  return listAccounts();
                case "searchMessages":
                  return searchMessages(args.query || "", args.startDate, args.endDate, args.maxResults, args.sortOrder);
                case "fullTextSearch":
                  return await fullTextSearch(args.query || "");
                case "getMessage":
                  return await getMessage(args.messageId, args.folderPath);
                case "sendMail":
                  return sendMail(args.to, args.subject, args.body, args.cc, args.bcc, args.isHtml, args.from, args.attachments);
                case "composeMail":
                  return composeMail(args.to, args.subject, args.body, args.cc, args.bcc, args.isHtml, args.from, args.attachments);
                case "replyToMessage":
                  return await replyToMessage(args.messageId, args.folderPath, args.body, args.replyAll, args.isHtml, args.to, args.cc, args.bcc, args.from, args.attachments);
                case "forwardMessage":
                  return await forwardMessage(args.messageId, args.folderPath, args.to, args.body, args.isHtml, args.cc, args.bcc, args.from, args.attachments);
                case "searchContacts":
                  return searchContacts(args.query || "");
                case "listCalendars":
                  return listCalendars();
                default:
                  throw new Error(`Unknown tool: ${name}`);
              }
            }

            // -- Auth token generation --

            const tokenBytes = new Uint8Array(32);
            crypto.getRandomValues(tokenBytes);
            const authToken = Array.from(tokenBytes, b => b.toString(16).padStart(2, "0")).join("");

            // Write token to ~/.thunderbird-mcp-token
            const tokenPath = Services.dirsvc.get("Home", Ci.nsIFile).path +
              (Services.appinfo.OS === "WINNT" ? "\\" : "/") + ".thunderbird-mcp-token";
            await IOUtils.writeUTF8(tokenPath, authToken, { mode: 0o600 });
            console.log("Thunderbird MCP auth token written to", tokenPath);

            // -- HTTP server --

            const server = new HttpServer();

            server.registerPathHandler("/", (req, res) => {
              res.processAsync();

              // DNS rebinding protection: validate Host header
              const hostHeader = req.hasHeader("Host") ? req.getHeader("Host") : "";
              // Strip port from host (handles both IPv4 "localhost:8765" and IPv6 "[::1]:8765")
              const hostname = hostHeader.startsWith("[")
                ? (hostHeader.match(/^(\[.*?\])/)?.[1] || hostHeader)
                : hostHeader.replace(/:\d+$/, "");
              const allowedHosts = ["localhost", "127.0.0.1", "[::1]"];
              if (!allowedHosts.includes(hostname.toLowerCase())) {
                res.setStatusLine("1.1", 403, "Forbidden");
                res.write("Forbidden: invalid Host header");
                res.finish();
                return;
              }

              // Bearer token authentication
              const authHeader = req.hasHeader("Authorization") ? req.getHeader("Authorization") : "";
              if (authHeader !== `Bearer ${authToken}`) {
                res.setStatusLine("1.1", 401, "Unauthorized");
                res.write("Unauthorized: invalid or missing Bearer token");
                res.finish();
                return;
              }

              if (req.method !== "POST") {
                res.setStatusLine("1.1", 405, "Method Not Allowed");
                res.write("POST only");
                res.finish();
                return;
              }

              let message;
              try {
                message = JSON.parse(readRequestBody(req));
              } catch {
                res.setStatusLine("1.1", 400, "Bad Request");
                res.write("Invalid JSON");
                res.finish();
                return;
              }

              const { id, method, params } = message;

              (async () => {
                try {
                  let result;
                  switch (method) {
                    case "tools/list":
                      result = { tools };
                      break;
                    case "tools/call":
                      if (!params?.name) throw new Error("Missing tool name");
                      result = {
                        content: [{
                          type: "text",
                          text: JSON.stringify(await callTool(params.name, params.arguments || {}), null, 2),
                        }],
                      };
                      break;
                    default:
                      res.setStatusLine("1.1", 404, "Not Found");
                      res.write(`Unknown method: ${method}`);
                      res.finish();
                      return;
                  }
                  res.setStatusLine("1.1", 200, "OK");
                  res.setHeader("Content-Type", "application/json; charset=utf-8", false);
                  res.write(JSON.stringify({ jsonrpc: "2.0", id, result }));
                } catch (e) {
                  res.setStatusLine("1.1", 200, "OK");
                  res.setHeader("Content-Type", "application/json; charset=utf-8", false);
                  res.write(JSON.stringify({
                    jsonrpc: "2.0",
                    id,
                    error: { code: -32000, message: e.toString() },
                  }));
                }
                res.finish();
              })();
            });

            server.start(MCP_PORT);
            console.log(`Thunderbird MCP server listening on port ${MCP_PORT}`);
            return { success: true, port: MCP_PORT };
          } catch (e) {
            console.error("Failed to start MCP server:", e);
            return { success: false, error: e.toString() };
          }
        },
      },
    };
  }

  onShutdown(isAppShutdown) {
    if (isAppShutdown) return;
    resProto.setSubstitution("thunderbird-mcp", null);
    Services.obs.notifyObservers(null, "startupcache-invalidate");
  }
};
