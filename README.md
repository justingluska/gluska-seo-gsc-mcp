# Google Search Console MCP Server (Unofficial)

[![npm version](https://img.shields.io/npm/v/gluska-seo-gsc-mcp.svg)](https://www.npmjs.com/package/gluska-seo-gsc-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![CI](https://github.com/justingluska/gluska-seo-gsc-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/justingluska/gluska-seo-gsc-mcp/actions/workflows/ci.yml)

An unofficial, open-source [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for [Google Search Console](https://search.google.com/search-console/). Connect your AI assistant to real SEO data — search analytics, URL inspection, sitemaps, indexing, and smart opportunity detection.

**Works with:** Claude Desktop, Cursor, VS Code, Windsurf, and any MCP-compatible client.

## Available Tools

| Tool | Description | Read-Only |
|------|-------------|-----------|
| `search_analytics` | Query search performance data with full filtering, all dimensions, and all search types | Yes |
| `compare_periods` | Compare two date ranges with automatic delta calculations | Yes |
| `find_opportunities` | Identify quick wins, declining pages, and emerging queries | Yes |
| `inspect_url` | Inspect a single URL's index status, mobile usability, rich results, and AMP | Yes |
| `batch_inspect_urls` | Inspect multiple URLs at once (max 100, rate-limited to 2K/day) | Yes |
| `list_sitemaps` | List all sitemaps with status, error counts, and content details | Yes |
| `submit_sitemap` | Submit a new sitemap to Search Console | No |
| `delete_sitemap` | Remove a sitemap from Search Console tracking | No |
| `list_properties` | List all accessible Search Console properties with permission levels | Yes |
| `notify_url_update` | Send a URL update or deletion notification via the Indexing API | No |
| `get_indexing_status` | Check Indexing API notification status for a URL | Yes |

## What Can You Do With This?

### Search Performance Analysis
- Pull your top queries, pages, countries, and devices with full filtering
- Use regex filters to segment branded vs. non-branded traffic
- Access all search types: Web, Discover, Google News, Image, Video
- Get hourly traffic data (via the April 2025 GSC API update)
- Retrieve up to 25,000 rows per request

### Track Changes Over Time
- Compare any two date ranges side-by-side
- See click, impression, CTR, and position deltas at a glance
- Detect the impact of algorithm updates, deployments, or SEO changes

### Find SEO Opportunities Automatically
- **Quick wins** — Queries ranking 5-20 with high impressions but low CTR (optimize titles/descriptions)
- **Declining content** — Pages losing traffic compared to the prior period
- **Emerging queries** — New or rapidly growing queries you should capitalize on

### Monitor Technical SEO
- Inspect any URL's index status, mobile usability, rich results, and AMP
- Batch inspect up to 100 URLs at once with built-in rate limiting
- Check canonical status and detect mismatches
- List, submit, and delete sitemaps
- Send URL update/deletion notifications via the Indexing API

## Quick Start

```bash
npx gluska-seo-gsc-mcp
```

## Setup

### Prerequisites

1. A [Google Cloud Project](https://console.cloud.google.com/) with the **Search Console API** enabled
2. OAuth 2.0 credentials (Desktop app) or a Service Account
3. Node.js >= 18

### Step 1: Enable the Search Console API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Go to **APIs & Services** > **Library**
4. Search for "Google Search Console API" and click **Enable**
5. If you plan to use the Indexing API tools, also enable the **Web Search Indexing API**

### Step 2: Create Credentials

#### Option A: Service Account (Recommended)

Best for automation, CI/CD, and MCP servers — no browser interaction needed.

1. In Google Cloud Console, go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **Service Account**
3. Give it a name (e.g., "gsc-mcp") and click **Create**
4. Skip the optional permissions steps and click **Done**
5. Click on the newly created service account
6. Go to the **Keys** tab > **Add Key** > **Create new key** > **JSON**
7. Save the downloaded JSON file somewhere safe

Then add the service account to Search Console:
1. Go to [Google Search Console](https://search.google.com/search-console/)
2. Select your property
3. Go to **Settings** > **Users and permissions** > **Add user**
4. Paste the `client_email` from the JSON file (looks like `name@project.iam.gserviceaccount.com`)
5. Set permission to **Full** and click **Add**

Set the environment variable:

```bash
export GSC_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
```

#### Option B: OAuth 2.0 (Interactive)

Best for personal use when you want to authenticate as yourself.

1. In Google Cloud Console, go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Desktop app** as the application type
4. Download the credentials JSON file

Set the environment variable:

```bash
export GSC_OAUTH_CREDENTIALS_PATH=/path/to/credentials.json
```

On first run, a browser window opens for authentication. Tokens are cached automatically for subsequent use.

### Step 3: Configure Your MCP Client

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-search-console": {
      "command": "npx",
      "args": ["-y", "gluska-seo-gsc-mcp"],
      "env": {
        "GSC_SERVICE_ACCOUNT_PATH": "/path/to/service-account.json"
      }
    }
  }
}
```

Config file location:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "google-search-console": {
      "command": "npx",
      "args": ["-y", "gluska-seo-gsc-mcp"],
      "env": {
        "GSC_SERVICE_ACCOUNT_PATH": "/path/to/service-account.json"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code</strong></summary>

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "google-search-console": {
      "command": "npx",
      "args": ["-y", "gluska-seo-gsc-mcp"],
      "env": {
        "GSC_SERVICE_ACCOUNT_PATH": "/path/to/service-account.json"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to your `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "google-search-console": {
      "command": "npx",
      "args": ["-y", "gluska-seo-gsc-mcp"],
      "env": {
        "GSC_SERVICE_ACCOUNT_PATH": "/path/to/service-account.json"
      }
    }
  }
}
```

</details>

## Example Prompts

Here are some things you can ask your AI assistant once the MCP is connected:

### Search Performance
| What You Can Ask | Tool Used |
|------------------|-----------|
| "Show me my top 20 queries by clicks for the last 7 days" | `search_analytics` |
| "What are my top performing pages?" | `search_analytics` |
| "Break down my traffic by device type" | `search_analytics` |
| "Which countries drive the most impressions?" | `search_analytics` |
| "Show me all queries containing 'tutorial' with regex" | `search_analytics` |
| "What's my Discover traffic look like?" | `search_analytics` |
| "Show me hourly traffic data for the past 3 days" | `search_analytics` |
| "Filter my queries to only non-branded terms" | `search_analytics` |

### Comparisons
| What You Can Ask | Tool Used |
|------------------|-----------|
| "Compare this week's performance to last week" | `compare_periods` |
| "How did March compare to February?" | `compare_periods` |
| "Show me which queries gained or lost the most clicks week over week" | `compare_periods` |

### Opportunities
| What You Can Ask | Tool Used |
|------------------|-----------|
| "Find quick win opportunities — high impressions but low CTR" | `find_opportunities` |
| "What content is declining in traffic?" | `find_opportunities` |
| "Are there any new emerging queries I should know about?" | `find_opportunities` |
| "Give me a full SEO opportunity analysis" | `find_opportunities` |

### Technical SEO
| What You Can Ask | Tool Used |
|------------------|-----------|
| "Is https://example.com/my-page indexed?" | `inspect_url` |
| "Check these 10 URLs and tell me which have indexing issues" | `batch_inspect_urls` |
| "List all my sitemaps and their status" | `list_sitemaps` |
| "Submit my new sitemap at https://example.com/sitemap-blog.xml" | `submit_sitemap` |
| "Which Search Console properties do I have access to?" | `list_properties` |
| "Notify Google that I updated https://example.com/page" | `notify_url_update` |

### Multi-Tool Combinations
| What You Can Ask | Tools Used |
|------------------|------------|
| "List my properties, then show top queries for each one" | `list_properties` + `search_analytics` |
| "Find quick wins and then inspect the top opportunity pages" | `find_opportunities` + `batch_inspect_urls` |
| "Compare this week to last week, then find what's declining" | `compare_periods` + `find_opportunities` |
| "Check my sitemaps, then inspect URLs from any with errors" | `list_sitemaps` + `batch_inspect_urls` |

## Example Outputs

Here's what you'll actually see when using the tools. These examples use real tool output formats from [hiretalent.ph](https://hiretalent.ph) (with modified numbers for illustration):

### search_analytics — "Show me my top queries"

```
Search Analytics for sc-domain:hiretalent.ph
Period: 2026-03-15 to 2026-03-22 | Search Type: web | Data: all
Total: 1.8K clicks, 85.2K impressions, 2.11% avg CTR, 4.7 avg position
Showing 10 rows

Query                                     | Clicks | Impressions | CTR    | Position
----------------------------------------- | ------ | ----------- | ------ | --------
hiretalent ph                             | 245    | 310         | 79.03% | 1.1
hire talent                               | 132    | 480         | 27.50% | 12.8
est to philippine time                    | 98     | 8.4K        | 1.17%  | 3.2
eastern time to philippine time           | 87     | 2.1K        | 4.14%  | 2.0
us time to philippine time                | 64     | 520         | 12.31% | 1.8
hiretalent                                | 58     | 95          | 61.05% | 3.4
hire talent ph                            | 52     | 78          | 66.67% | 1.2
pst to philippine time                    | 45     | 1.9K        | 2.37%  | 5.6
central time to philippine time           | 38     | 1.1K        | 3.45%  | 4.3
new zealand time to philippine time       | 31     | 480         | 6.46%  | 1.9
```

### search_analytics — "Break down traffic by device"

```
Search Analytics for sc-domain:hiretalent.ph
Period: 2026-03-15 to 2026-03-22 | Search Type: web | Data: all
Total: 1.8K clicks, 85.2K impressions, 2.11% avg CTR, 4.7 avg position
Showing 3 rows

Device  | Clicks | Impressions | CTR   | Position
------- | ------ | ----------- | ----- | --------
MOBILE  | 1.1K   | 58.3K       | 1.89% | 5.2
DESKTOP | 680    | 24.7K       | 2.75% | 3.8
TABLET  | 42     | 2.2K        | 1.91% | 6.1
```

### find_opportunities — "Find quick win opportunities"

```
Opportunity Analysis for sc-domain:hiretalent.ph
Recent: 2026-03-15 to 2026-03-22 | Prior: 2026-02-15 to 2026-02-22

## Quick Wins
High-impression queries ranking 5-20 with low CTR. Optimizing titles/descriptions could boost clicks significantly.

Query                                | Page                                                         | Clicks | Impressions | CTR   | Position
------------------------------------ | ------------------------------------------------------------ | ------ | ----------- | ----- | --------
est time now                         | https://hiretalent.ph/eastern-time-to-philippine-time-conver | 22     | 20.1K       | 0.11% | 7.8
eastern time now                     | https://hiretalent.ph/eastern-time-to-philippine-time-conver | 6      | 4.5K        | 0.13% | 8.1
new zealand time                     | https://hiretalent.ph/new-zealand-to-philippines-time-zone-c | 3      | 3.1K        | 0.10% | 7.2
pst to philippine time               | https://hiretalent.ph/conversion-guide-to-pacific-time-to-ph | 8      | 2.3K        | 0.35% | 5.9
pacific time                         | https://hiretalent.ph/conversion-guide-to-pacific-time-to-ph | 4      | 1.2K        | 0.33% | 9.4
```

### compare_periods — "Compare this week to last week"

```
Period Comparison for sc-domain:hiretalent.ph
Period 1: 2026-03-08 to 2026-03-14
Period 2: 2026-03-15 to 2026-03-21

Overall: Clicks 1.6K → 1.8K (+12.5%)
         Impressions 78.4K → 85.2K (+8.7%)

Top changes (sorted by absolute click delta):

Query                            | P1 Clicks | P2 Clicks | Delta | Change  | P1 Pos | P2 Pos
-------------------------------- | --------- | --------- | ----- | ------- | ------ | ------
hiretalent ph                    | 195       | 245       | +50   | +25.6%  | 1.2    | 1.1
est to philippine time           | 120       | 98        | -22   | -18.3%  | 2.8    | 3.2
hire talent                      | 112       | 132       | +20   | +17.9%  | 13.5   | 12.8
us time to philippine time       | 48        | 64        | +16   | +33.3%  | 2.1    | 1.8
eastern time to philippine time  | 95        | 87        | -8    | -8.4%   | 1.8    | 2.0
```

### inspect_url — "Is this page indexed?"

```
URL Inspection: https://hiretalent.ph/eastern-time-to-philippine-time-converter/

## Index Status
Verdict: PASS
Coverage: Submitted and indexed
Indexing: INDEXING_ALLOWED
Robots.txt: ALLOWED
Page fetch: SUCCESSFUL
Last crawl: 2026-03-20T14:32:00Z
Crawled as: DESKTOP
Google canonical: https://hiretalent.ph/eastern-time-to-philippine-time-converter/
User canonical: https://hiretalent.ph/eastern-time-to-philippine-time-converter/
Sitemaps: https://hiretalent.ph/sitemap.xml

## Mobile Usability
Verdict: PASS

View in Search Console: https://search.google.com/search-console/inspect?...
```

### batch_inspect_urls — "Check these URLs for indexing issues"

```
Batch URL Inspection for sc-domain:hiretalent.ph
Inspected: 5/5 | Errors: 0
Quota remaining: 1995/day

## Summary
  PASS: 3
  NEUTRAL: 1
  FAIL: 1

## URLs With Issues
  NEUTRAL | https://hiretalent.ph/old-timezone-page/
    coverage=Crawled - currently not indexed, indexing=INDEXING_ALLOWED, crawled=2026-03-18
  FAIL | https://hiretalent.ph/test-draft/
    coverage=Blocked by robots.txt, indexing=BLOCKED_BY_ROBOTS_TXT, crawled=never
```

### list_sitemaps — "Show me my sitemaps"

```
Sitemaps for sc-domain:hiretalent.ph
Total: 1 sitemap(s)

Sitemap URL                           | Type    | Status    | Last Submitted | Errors | Warnings
------------------------------------- | ------- | --------- | -------------- | ------ | --------
https://hiretalent.ph/sitemap.xml     | Sitemap | Processed | 2026-03-01     | 0      | 0

## Content Details

https://hiretalent.ph/sitemap.xml:
  web: 1114 submitted, 980 indexed
```

### list_properties — "Which properties do I have access to?"

```
Search Console Properties
Total: 1 property/properties

Property                      | Type       | Permission
----------------------------- | ---------- | ----------
sc-domain:hiretalent.ph       | Domain     | siteFullUser

Use any of these site URLs with other tools (e.g., search_analytics, inspect_url).
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GSC_SERVICE_ACCOUNT_PATH` | Path to service account JSON | One of these |
| `GSC_OAUTH_CREDENTIALS_PATH` | Path to OAuth credentials JSON | is required |
| `GSC_OAUTH_TOKEN_PATH` | Path to store OAuth tokens (default: `~/.gsc-mcp-token.json`) | No |
| `GSC_DATA_STATE` | Default data freshness: `final`, `all`, or `hourly_all` (default: `all`) | No |
| `GSC_DEFAULT_SITE_URL` | Default site URL to use when not specified | No |
| `GSC_DEBUG` | Set to `true` for verbose debug logging | No |

## API Rate Limits

This server has built-in rate limiting to respect Google's API quotas:

| API | Rate Limit | Daily Limit |
|-----|-----------|-------------|
| Search Analytics | 1,200 requests/min | — |
| URL Inspection | 600 requests/min | 2,000/day |
| Indexing API (publish) | 200 requests/min | 200/day |
| Indexing API (metadata) | 600 requests/min | 600/day |
| All other endpoints | 200 requests/min | — |

You don't need to worry about hitting these — the server manages them automatically. If a quota is reached, you'll get a clear error message explaining what happened and when to retry.

## Troubleshooting

### "User does not have sufficient permission for site"
- Make sure you added the service account email (or your OAuth user) to the property in Search Console
- Go to **Settings** > **Users and permissions** in Search Console and verify the email is listed
- For domain properties, use the format `sc-domain:example.com`
- For URL-prefix properties, include the protocol and trailing slash: `https://example.com/`

### "No data found" for a query
- GSC data has a 2-3 day delay for finalized data. Try setting `dataState` to `"all"` for fresher (but potentially partial) data
- Verify the date range — data is available for the last 16 months
- Check that the site actually has search traffic for the specified search type

### "Service account file not found"
- Double-check the path in `GSC_SERVICE_ACCOUNT_PATH` — it must be an absolute path or relative to where the server runs
- Make sure the JSON file was downloaded correctly from Google Cloud Console

### OAuth browser window doesn't open
- This is a known limitation with stdio-based MCP servers. The server tries to open your default browser, but some MCP clients block this
- **Workaround:** Use a Service Account instead (recommended for MCP use)
- Or run the server manually once (`npx gluska-seo-gsc-mcp`) in a terminal to complete the OAuth flow, then use the cached token in your MCP client

### "spawn npx ENOENT" on macOS
- Claude Desktop and other MCP clients may not inherit your shell's PATH
- Fix: Use the full path to npx in your config. Find it with `which npx` in your terminal
- Example: Replace `"command": "npx"` with `"command": "/usr/local/bin/npx"` (use your actual path)

### Indexing API returns 403
- The Indexing API requires separate enablement — make sure you enabled "Web Search Indexing API" in Google Cloud Console
- Note: The Indexing API is officially supported only for pages with `JobPosting` or `BroadcastEvent` structured data

## Development

```bash
git clone https://github.com/justingluska/gluska-seo-gsc-mcp.git
cd gluska-seo-gsc-mcp
npm install
npm run build
npm test
```

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### Project Structure

```
src/
  cli.ts              # Entry point (stdio transport)
  server.ts           # MCP server with all tool registrations
  auth/
    client.ts         # OAuth 2.0 + Service Account authentication
  api/
    search-console.ts # Google Search Console API wrapper
    indexing.ts        # Google Indexing API wrapper
  tools/
    search-analytics.ts   # search_analytics tool
    compare-periods.ts    # compare_periods tool
    find-opportunities.ts # find_opportunities tool
    inspect-url.ts        # inspect_url + batch_inspect_urls tools
    sitemaps.ts           # list/submit/delete sitemap tools
    properties.ts         # list_properties tool
    indexing.ts           # notify_url_update + get_indexing_status tools
  utils/
    rate-limiter.ts   # Token bucket rate limiter + daily quota tracker
    dates.ts          # Date utilities
    formatting.ts     # Response formatting (tables, numbers, CTR)
    logger.ts         # stderr-only logger
tests/
  tools/              # Tool-level tests with mocked APIs
  utils/              # Utility function tests
```

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes
6. Push to the branch and open a Pull Request

## Disclaimer

This is an unofficial, community-built tool and is not affiliated with, endorsed by, or sponsored by Google. Google Search Console is a trademark of Google LLC. This project uses the Google Search Console API under Google's [Terms of Service](https://developers.google.com/terms).

## License

[MIT](LICENSE)
