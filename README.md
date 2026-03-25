# Google Search Console MCP Server (Unofficial)

[![npm version](https://img.shields.io/npm/v/gluska-seo-gsc-mcp.svg)](https://www.npmjs.com/package/gluska-seo-gsc-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![CI](https://github.com/justingluska/gluska-seo-gsc-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/justingluska/gluska-seo-gsc-mcp/actions/workflows/ci.yml)

An unofficial, open-source [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for [Google Search Console](https://search.google.com/search-console/). Connect your AI assistant to real SEO data — search analytics, URL inspection, sitemaps, indexing, and smart opportunity detection.

**5 steps, under 10 minutes to set up.** No coding experience required.

**Works with:** Claude Desktop, Cursor, VS Code, Windsurf, and any MCP-compatible client.

## Available Tools

| Tool | Description | Read-Only |
|------|-------------|-----------|
| `search_analytics` | Query search performance data with full filtering, all dimensions, and all search types | Yes |
| `compare_periods` | Compare two date ranges with automatic delta calculations | Yes |
| `find_opportunities` | Identify quick wins, declining pages, and emerging queries | Yes |
| `diagnose_traffic_drops` | Find pages that lost traffic and diagnose why (ranking loss, CTR collapse, or demand decline) | Yes |
| `cannibalization` | Detect keywords where multiple pages compete against each other | Yes |
| `content_decay` | Find pages with 3+ consecutive months of traffic decline | Yes |
| `ctr_benchmarks` | Compare your CTR against industry averages by position | Yes |
| `topic_clusters` | Analyze performance of all pages under a URL path prefix | Yes |
| `verify_claim` | Self-check a data claim before presenting it (anti-hallucination) | Yes |
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

### Diagnose Traffic Issues
- **Traffic drop diagnosis** — Find pages that lost traffic and learn *why*: ranking loss, CTR collapse, or demand decline
- **Keyword cannibalization** — Detect queries where multiple pages compete against each other
- **Content decay** — Surface pages with 3+ consecutive months of decline before they disappear from SERPs
- **CTR benchmarks** — Compare your click-through rates against industry averages by position
- **Topic cluster analysis** — See aggregate performance for all pages under a URL path (like `/blog/seo/`)

### Anti-Hallucination Safeguards
- **Data provenance** — Every response includes a `_meta` block confirming the data source, tool, and parameters used
- **Guardrail prompts** — Tool descriptions instruct the AI to report exact numbers and avoid speculation
- **Verify claim** — A dedicated tool lets the AI self-check any claim by re-querying the API before presenting it

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

### Traffic Diagnosis & Optimization
| What You Can Ask | Tool Used |
|------------------|-----------|
| "Which pages lost traffic recently and why?" | `diagnose_traffic_drops` |
| "Are any of my pages cannibalizing each other?" | `cannibalization` |
| "Which pages are slowly dying?" | `content_decay` |
| "How does my CTR compare to benchmarks?" | `ctr_benchmarks` |
| "Show me CTR benchmarks for my top queries" | `ctr_benchmarks` |
| "How is my /blog/ section performing?" | `topic_clusters` |
| "Show me the performance of all pages under /docs/" | `topic_clusters` |

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

Here's what the tool output actually looks like. Examples use [hiretalent.ph](https://hiretalent.ph) with sample data for illustration:

### search_analytics — "Show me my top queries"

```
Search Analytics for sc-domain:hiretalent.ph
Period: 2026-03-15 to 2026-03-22 | Search Type: web | Data: all
Total: 14.8K clicks, 412.5K impressions, 3.59% avg CTR, 5.2 avg position
Showing 10 rows

Query                                     | Clicks | Impressions | CTR    | Position
----------------------------------------- | ------ | ----------- | ------ | --------
hire talent philippines                   | 1.8K   | 5.2K        | 34.62% | 1.3
hire remote filipino workers              | 1.4K   | 8.1K        | 17.28% | 2.1
outsource to philippines                  | 1.2K   | 15.3K       | 7.84%  | 3.5
filipino virtual assistant                | 980    | 22.4K       | 4.37%  | 4.2
philippine staffing agency                | 870    | 6.8K        | 12.79% | 2.8
best hiring platform philippines          | 640    | 4.1K        | 15.61% | 1.9
remote workers philippines cost           | 520    | 18.7K       | 2.78%  | 5.6
hire developers philippines               | 410    | 9.3K        | 4.41%  | 3.7
hiretalent                                | 380    | 620         | 61.29% | 1.0
outsourcing vs hiring in-house            | 290    | 31.2K       | 0.93%  | 7.8
```

### search_analytics — "Break down traffic by device"

```
Search Analytics for sc-domain:hiretalent.ph
Period: 2026-03-15 to 2026-03-22 | Search Type: web | Data: all
Total: 14.8K clicks, 412.5K impressions, 3.59% avg CTR, 5.2 avg position
Showing 3 rows

Device  | Clicks | Impressions | CTR   | Position
------- | ------ | ----------- | ----- | --------
MOBILE  | 8.2K   | 265.8K      | 3.09% | 5.8
DESKTOP | 6.1K   | 134.2K      | 4.55% | 4.3
TABLET  | 510    | 12.5K       | 4.08% | 5.1
```

### find_opportunities — "Find quick win opportunities"

```
Opportunity Analysis for sc-domain:hiretalent.ph
Recent: 2026-03-15 to 2026-03-22 | Prior: 2026-02-15 to 2026-02-22

## Quick Wins
High-impression queries ranking 5-20 with low CTR. Optimizing titles/descriptions could boost clicks significantly.

Query                                | Page                                                    | Clicks | Impressions | CTR   | Position
------------------------------------ | ------------------------------------------------------- | ------ | ----------- | ----- | --------
outsourcing vs hiring in-house       | https://hiretalent.ph/blog/outsourcing-vs-inhouse/      | 290    | 31.2K       | 0.93% | 7.8
how much to pay filipino VA          | https://hiretalent.ph/blog/filipino-va-salary-guide/    | 145    | 24.6K       | 0.59% | 9.4
remote team management tips          | https://hiretalent.ph/blog/managing-remote-teams/       | 82     | 18.9K       | 0.43% | 11.2
philippines tech talent market       | https://hiretalent.ph/blog/ph-tech-talent-2026/         | 54     | 12.3K       | 0.44% | 8.6
best countries to outsource to       | https://hiretalent.ph/blog/top-outsourcing-countries/   | 38     | 9.7K        | 0.39% | 10.1
```

### compare_periods — "Compare this week to last week"

```
Period Comparison for sc-domain:hiretalent.ph
Period 1: 2026-03-08 to 2026-03-14
Period 2: 2026-03-15 to 2026-03-21

Overall: Clicks 12.1K → 14.8K (+22.3%)
         Impressions 358.9K → 412.5K (+14.9%)

Top changes (sorted by absolute click delta):

Query                            | P1 Clicks | P2 Clicks | Delta | Change  | P1 Pos | P2 Pos
-------------------------------- | --------- | --------- | ----- | ------- | ------ | ------
hire remote filipino workers     | 890       | 1.4K      | +510  | +57.3%  | 3.4    | 2.1
outsource to philippines         | 980       | 1.2K      | +220  | +22.4%  | 4.1    | 3.5
filipino virtual assistant       | 1.1K      | 980       | -120  | -10.9%  | 3.8    | 4.2
hire talent philippines          | 1.6K      | 1.8K      | +200  | +12.5%  | 1.5    | 1.3
remote workers philippines cost  | 620       | 520       | -100  | -16.1%  | 4.9    | 5.6
```

### inspect_url — "Is this page indexed?"

```
URL Inspection: https://hiretalent.ph/blog/outsourcing-vs-inhouse/

## Index Status
Verdict: PASS
Coverage: Submitted and indexed
Indexing: INDEXING_ALLOWED
Robots.txt: ALLOWED
Page fetch: SUCCESSFUL
Last crawl: 2026-03-20T14:32:00Z
Crawled as: DESKTOP
Google canonical: https://hiretalent.ph/blog/outsourcing-vs-inhouse/
User canonical: https://hiretalent.ph/blog/outsourcing-vs-inhouse/
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
  NEUTRAL | https://hiretalent.ph/blog/old-salary-data-2024/
    coverage=Crawled - currently not indexed, indexing=INDEXING_ALLOWED, crawled=2026-03-18
  FAIL | https://hiretalent.ph/staging/new-landing-page/
    coverage=Blocked by robots.txt, indexing=BLOCKED_BY_ROBOTS_TXT, crawled=never
```

### list_sitemaps — "Show me my sitemaps"

```
Sitemaps for sc-domain:hiretalent.ph
Total: 2 sitemap(s)

Sitemap URL                                | Type    | Status    | Last Submitted | Errors | Warnings
------------------------------------------ | ------- | --------- | -------------- | ------ | --------
https://hiretalent.ph/sitemap.xml          | Index   | Processed | 2026-03-01     | 0      | 0
https://hiretalent.ph/sitemap-blog.xml     | Sitemap | Processed | 2026-03-18     | 0      | 1

## Content Details

https://hiretalent.ph/sitemap.xml:
  web: 1450 submitted, 1380 indexed

https://hiretalent.ph/sitemap-blog.xml:
  web: 285 submitted, 264 indexed
```

### list_properties — "Which properties do I have access to?"

```
Search Console Properties
Total: 2 property/properties

Property                      | Type       | Permission
----------------------------- | ---------- | ----------
sc-domain:hiretalent.ph       | Domain     | siteOwner
https://blog.hiretalent.ph/   | URL Prefix | siteFullUser

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
    traffic-drops.ts          # diagnose_traffic_drops tool (NEW)
    cannibalization.ts    # cannibalization detection tool (NEW)
    content-decay.ts      # content_decay tool (NEW)
    ctr-benchmarks.ts     # ctr_benchmarks tool (NEW)
    topic-clusters.ts     # topic_clusters tool (NEW)
    verify-claim.ts       # verify_claim anti-hallucination tool (NEW)
    inspect-url.ts        # inspect_url + batch_inspect_urls tools
    sitemaps.ts           # list/submit/delete sitemap tools
    properties.ts         # list_properties tool
    indexing.ts           # notify_url_update + get_indexing_status tools
  utils/
    rate-limiter.ts   # Token bucket rate limiter + daily quota tracker
    dates.ts          # Date utilities
    formatting.ts     # Response formatting (tables, numbers, CTR)
    meta.ts           # Data provenance metadata (NEW)
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

## Acknowledgments

The anti-hallucination features in this project — data provenance (`_meta` blocks), guardrail prompts, and the `verify_claim` tool — were inspired by [Suganthan Mohanadasan](https://suganthan.com/)'s work on his [GSC MCP server](https://github.com/Suganthan-Mohanadasan/Suganthans-GSC-MCP) and his [blog post](https://suganthan.com/blog/google-search-console-mcp-server/) about building trust into AI-powered SEO tools. The ideas for dedicated cannibalization detection, content decay tracking, CTR benchmarks, traffic drop diagnosis, and topic cluster analysis were also informed by his write-up. Thanks Suganthan for sharing your work with the community.

## Disclaimer

This is an unofficial, community-built tool and is not affiliated with, endorsed by, or sponsored by Google. Google Search Console is a trademark of Google LLC. This project uses the Google Search Console API under Google's [Terms of Service](https://developers.google.com/terms).

## License

[MIT](LICENSE)
