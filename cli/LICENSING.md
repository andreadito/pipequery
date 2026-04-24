# Licensing — `@vaultgradient/pipequery-cli`

From version 0.4.0, the pipequery CLI is distributed under the **Business Source License 1.1** (BSL 1.1). The engine library (`@vaultgradient/pipequery-lang`, under `src/`) remains **MIT**.

Legal authority is the [`LICENSE`](./LICENSE) file. This document is a plain-English summary — if the two disagree, the LICENSE file wins.

## What you can do, freely

- **Run the CLI in production** inside your own company or project, including behind internal APIs, internal dashboards, and internal MCP endpoints served to your own engineers.
- **Embed the CLI** in your own product, if that product isn't itself a hosted pipequery offering. Shipping an app that uses `pq mcp serve` internally is fine.
- **Modify and redistribute** the CLI under the same BSL 1.1 terms, as long as your redistribution isn't a competing hosted service.
- **Fork it** for evaluation, experimentation, contributing back, or any non-production purpose.

## What you can't do without a commercial license

- Offer pipequery to third parties as a **hosted or managed service** (for example, running it on behalf of customers and selling access), when that service competes with Vault Gradient's paid offerings.
- Offer it as a **data-query-as-a-service** or an **MCP-as-a-service** that meaningfully substitutes for our commercial product.

If you're unsure whether your intended use needs a commercial license, open a [commercial license inquiry](https://github.com/andreadito/pipequery/issues/new?template=commercial-license.yml) and we'll confirm in writing.

## Change Date — it converts to MIT

Each released version of the CLI converts from BSL 1.1 to **MIT** four years after its publication date. Version 0.4.0, shipped in 2026, becomes MIT in 2030. Version 0.5.0 (whenever it ships) has its own four-year clock. So any given release will always be MIT eventually — BSL 1.1 is a rolling window, not a permanent state.

## Why BSL and not MIT

We want pipequery to be widely usable (including in production, including commercially) without becoming free infrastructure for a competitor who offers "managed pipequery" without contributing back. BSL 1.1 is the minimal license that enables that — it's the same trade-off used by MariaDB, HashiCorp (Terraform, Vault, Consul, Vagrant), and many other OSS-commercial projects.

The engine library stays MIT because we want it embedded everywhere — in dashboards, in OSS tools, in analytics pipelines, wherever people query data. Only the CLI — which is what a potential hosted competitor would repackage — has the restriction.

## FAQ

**Q: I run an agency and want to install pipequery CLI for a client. OK?**
A: Yes. You're not offering pipequery-as-a-service; you're deploying it for their internal use.

**Q: I have an internal MCP server at my company using pipequery. OK?**
A: Yes. Internal use is fully permitted.

**Q: I want to ship an AI IDE that lists pipequery MCP as a built-in integration. OK?**
A: Fine, as long as you aren't hosting the pipequery server itself for users.

**Q: I want to build a SaaS that lets customers paste a `pipequery.yaml` and get a hosted MCP URL. OK?**
A: No — that's the use case the BSL blocks. [Open a commercial license inquiry](https://github.com/andreadito/pipequery/issues/new?template=commercial-license.yml).

**Q: Is my SBOM / compliance tooling going to flag BSL 1.1?**
A: Possibly. BSL 1.1 is a well-known source-available license used by Fortune 500 infrastructure (HashiCorp Terraform, Vault, Consul, Nomad, Boundary; MariaDB; Sentry historically). SPDX identifier: `BUSL-1.1`. Most scanners recognize it; if yours doesn't, treat the CLI the same way you treat Terraform CE.

**Q: What if I need a self-hosted build with an SLA and indemnification?**
A: That's exactly what the commercial license covers. [Open a commercial license inquiry](https://github.com/andreadito/pipequery/issues/new?template=commercial-license.yml).
