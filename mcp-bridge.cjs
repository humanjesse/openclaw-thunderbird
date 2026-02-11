#!/usr/bin/env node
/**
 * MCP Bridge for Thunderbird
 *
 * Translates stdio MCP protocol (JSON-RPC 2.0) to HTTP requests
 * for the Thunderbird MCP extension running on localhost:8765.
 */

const http = require('http');
const readline = require('readline');
const fs = require('fs');
const os = require('os');
const path = require('path');

const THUNDERBIRD_PORT = 8765;
const REQUEST_TIMEOUT = 30000;

// Disable stdout buffering for MCP protocol
if (process.stdout._handle?.setBlocking) {
  process.stdout._handle.setBlocking(true);
}

let pendingRequests = 0;
let stdinClosed = false;

function checkExit() {
  if (stdinClosed && pendingRequests === 0) {
    process.exit(0);
  }
}

function writeOutput(data) {
  return new Promise((resolve) => {
    if (process.stdout.write(data)) {
      resolve();
    } else {
      process.stdout.once('drain', resolve);
    }
  });
}

/**
 * Fallback sanitizer for JSON responses containing invalid control characters.
 * The extension pre-encodes non-ASCII, but email bodies can still have raw
 * control chars that break JSON parsing.
 */
function sanitizeJson(data) {
  let sanitized = data.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  sanitized = sanitized.replace(/(?<!\\)\r/g, '\\r');
  sanitized = sanitized.replace(/(?<!\\)\n/g, '\\n');
  sanitized = sanitized.replace(/(?<!\\)\t/g, '\\t');
  return sanitized;
}

const TOKEN_PATH = path.join(os.homedir(), '.thunderbird-mcp-token');

function getAuthToken() {
  try {
    return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
  } catch (e) {
    throw new Error(`Cannot read auth token from ${TOKEN_PATH}: ${e.message}. Is Thunderbird running with the MCP extension?`);
  }
}

async function handleMessage(line) {
  const message = JSON.parse(line);

  switch (message.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'thunderbird-mcp', version: '1.0.0' }
        }
      };

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    case 'resources/list':
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: { resources: [] }
      };

    case 'prompts/list':
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: { prompts: [] }
      };

    default:
      return forwardToThunderbird(message);
  }
}

function forwardToThunderbird(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(message);
    const token = getAuthToken();

    const req = http.request({
      hostname: 'localhost',
      port: THUNDERBIRD_PORT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(JSON.parse(data));
        } catch {
          try {
            resolve(JSON.parse(sanitizeJson(data)));
          } catch (e) {
            reject(new Error(`Invalid JSON from Thunderbird: ${e.message}`));
          }
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Connection failed: ${e.message}. Is Thunderbird running with the MCP extension?`));
    });

    req.setTimeout(REQUEST_TIMEOUT, () => {
      req.destroy();
      reject(new Error('Request to Thunderbird timed out'));
    });

    req.write(postData);
    req.end();
  });
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  if (!line.trim()) return;

  let messageId = null;
  try {
    messageId = JSON.parse(line).id ?? null;
  } catch {
    // Leave as null
  }

  pendingRequests++;
  handleMessage(line)
    .then(async (response) => {
      if (response !== null) {
        await writeOutput(JSON.stringify(response) + '\n');
      }
    })
    .catch(async (err) => {
      await writeOutput(JSON.stringify({
        jsonrpc: '2.0',
        id: messageId,
        error: { code: -32700, message: `Bridge error: ${err.message}` }
      }) + '\n');
    })
    .finally(() => {
      pendingRequests--;
      checkExit();
    });
});

rl.on('close', () => {
  stdinClosed = true;
  checkExit();
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
