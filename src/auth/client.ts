import { google } from 'googleapis';
import { OAuth2Client, GoogleAuth, JWT } from 'google-auth-library';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { log } from '../utils/logger.js';

export type AuthClient = OAuth2Client | JWT;

interface OAuthCredentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/indexing',
];

const DEFAULT_TOKEN_PATH = path.join(os.homedir(), '.gsc-mcp-token.json');

/**
 * Creates an authenticated Google API client.
 * Auto-detects whether to use Service Account or OAuth based on environment variables.
 */
export async function createAuthClient(): Promise<AuthClient> {
  const serviceAccountPath = process.env.GSC_SERVICE_ACCOUNT_PATH;
  const oauthCredentialsPath = process.env.GSC_OAUTH_CREDENTIALS_PATH;

  if (serviceAccountPath) {
    log.info('Authenticating with Service Account');
    return createServiceAccountClient(serviceAccountPath);
  }

  if (oauthCredentialsPath) {
    log.info('Authenticating with OAuth 2.0');
    return createOAuthClient(oauthCredentialsPath);
  }

  throw new Error(
    'No authentication configured. Set either GSC_SERVICE_ACCOUNT_PATH or GSC_OAUTH_CREDENTIALS_PATH environment variable.\n\n' +
      'Service Account (recommended for automation):\n' +
      '  export GSC_SERVICE_ACCOUNT_PATH=/path/to/service-account.json\n\n' +
      'OAuth 2.0 (interactive):\n' +
      '  export GSC_OAUTH_CREDENTIALS_PATH=/path/to/credentials.json',
  );
}

/**
 * Creates a JWT client from a service account credentials file.
 */
async function createServiceAccountClient(credentialsPath: string): Promise<JWT> {
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Service account file not found: ${credentialsPath}`);
  }

  const auth = new GoogleAuth({
    keyFile: credentialsPath,
    scopes: SCOPES,
  });

  const client = (await auth.getClient()) as JWT;

  // Verify credentials work
  try {
    await client.getAccessToken();
    log.info('Service account authenticated successfully');
  } catch (error) {
    throw new Error(
      `Service account authentication failed: ${error instanceof Error ? error.message : String(error)}.\n` +
        'Make sure the service account email has been added to Search Console (Settings > Users and permissions).',
    );
  }

  return client;
}

/**
 * Creates an OAuth2 client with token persistence and refresh.
 */
async function createOAuthClient(credentialsPath: string): Promise<OAuth2Client> {
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`OAuth credentials file not found: ${credentialsPath}`);
  }

  const credentialsRaw = fs.readFileSync(credentialsPath, 'utf-8');
  const credentials: OAuthCredentials = JSON.parse(credentialsRaw);
  const config = credentials.installed || credentials.web;

  if (!config) {
    throw new Error(
      'Invalid OAuth credentials file. Expected "installed" or "web" client configuration.',
    );
  }

  const oauth2Client = new OAuth2Client(
    config.client_id,
    config.client_secret,
    config.redirect_uris[0] || 'http://localhost:3000/oauth2callback',
  );

  const tokenPath = process.env.GSC_OAUTH_TOKEN_PATH || DEFAULT_TOKEN_PATH;

  // Try to load existing token
  if (fs.existsSync(tokenPath)) {
    try {
      const tokenRaw = fs.readFileSync(tokenPath, 'utf-8');
      const token: TokenData = JSON.parse(tokenRaw);
      oauth2Client.setCredentials(token);

      // Check if token needs refresh
      if (token.expiry_date && token.expiry_date < Date.now()) {
        log.info('Token expired, refreshing...');
        const { credentials: refreshed } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(refreshed);
        saveToken(tokenPath, refreshed as TokenData);
        log.info('Token refreshed successfully');
      } else {
        log.info('Loaded existing OAuth token');
      }

      return oauth2Client;
    } catch (error) {
      log.warn('Failed to load existing token, will re-authenticate', error);
    }
  }

  // Need to authenticate — generate auth URL and wait for code
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  // For stdio MCP servers, we can't easily do a browser redirect.
  // We'll use a simple local HTTP server to catch the callback.
  const code = await getAuthCodeViaLocalServer(authUrl, oauth2Client);

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  saveToken(tokenPath, tokens as TokenData);

  log.info('OAuth authentication completed successfully');
  return oauth2Client;
}

/**
 * Starts a temporary local HTTP server to handle the OAuth callback.
 */
async function getAuthCodeViaLocalServer(
  authUrl: string,
  _oauth2Client: OAuth2Client,
): Promise<string> {
  const { createServer } = await import('node:http');
  const { URL } = await import('node:url');

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || '', 'http://localhost:3000');
        const code = url.searchParams.get('code');

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(
            '<html><body><h1>Authentication successful!</h1><p>You can close this window and return to your AI assistant.</p></body></html>',
          );
          server.close();
          resolve(code);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Error: No authorization code received</h1></body></html>');
        }
      } catch (error) {
        reject(error);
      }
    });

    server.listen(3000, () => {
      log.info(`\nPlease open this URL in your browser to authenticate:\n\n${authUrl}\n`);

      // Try to open browser automatically
      const { exec } = require('node:child_process') as typeof import('node:child_process');
      const openCommand =
        process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
            ? 'start'
            : 'xdg-open';
      exec(`${openCommand} "${authUrl}"`, (error: Error | null) => {
        if (error) {
          log.debug('Could not auto-open browser', error);
        }
      });
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

function saveToken(tokenPath: string, token: TokenData) {
  try {
    const dir = path.dirname(tokenPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2), { mode: 0o600 });
    log.debug(`Token saved to ${tokenPath}`);
  } catch (error) {
    log.warn(`Failed to save token to ${tokenPath}`, error);
  }
}

/**
 * Sets up the global Google API auth for googleapis library calls.
 */
export function setGlobalAuth(client: AuthClient) {
  google.options({ auth: client });
}
