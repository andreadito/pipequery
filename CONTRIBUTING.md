# Contributing to pipequery

Thanks for your interest in contributing. The short version:

1. **Open an issue first** for anything beyond a small fix — it saves everyone time.
2. **Fork → branch → PR.** Branch names are up to you; keep commits focused.
3. **Sign off your commits** (`git commit -s`) to certify you have the right to contribute the change — see the DCO below.
4. **Run tests + build locally** before submitting (`npm test` at the root, `npm run build` in `cli/` if you touched the CLI).

## Licensing

This repo ships two packages with different licenses:

- `@vaultgradient/pipequery-lang` (the engine, under `src/`) — **MIT**.
- `@vaultgradient/pipequery-cli` (under `cli/`) — **Business Source License 1.1**, converting to MIT after 4 years. See [`cli/LICENSING.md`](./cli/LICENSING.md) for the plain-English summary.

By contributing, you agree your contributions will be released under the license of whichever package your change lands in.

## Developer Certificate of Origin (DCO)

We require a **DCO sign-off**, not a CLA. Every commit must be signed off with:

```bash
git commit -s -m "Your message"
```

This adds a `Signed-off-by: Your Name <you@example.com>` trailer to the commit message, which certifies that you wrote the patch (or otherwise have the right to submit it) under the project's license. The full DCO text is at <https://developercertificate.org>.

If you forget to sign off, GitHub will ask you to amend. The quick fix for the most recent commit:

```bash
git commit --amend -s --no-edit
git push --force-with-lease
```

## Development

```bash
git clone https://github.com/andreadito/pipequery.git
cd pipequery
npm install
npm test                 # runs the engine test suite

# CLI development
cd cli
npm install
npm run build
./dist/index.js --help   # or `node dist/index.js ...`

# Docs site
cd docs
npm install
npm run dev
```

## What we're happy to merge

- Bug fixes with a regression test.
- New PipeQuery operations or aggregate functions (with tests).
- New MCP tools or transport improvements (with an end-to-end smoke test).
- Docs improvements, typo fixes, clarifications.
- New source adapters for the CLI (REST variants, file formats, etc.).

## What we want to discuss first

- Breaking changes to the query language or public API.
- New dependencies in the engine (we keep it zero-dependency for a reason).
- Large refactors.
- Anything touching licensing or release tooling.

Open a discussion issue before you start coding — saves time on both sides.

## Questions?

For OSS questions: open an issue.
For commercial / enterprise / hosted: use the relevant [issue templates](./.github/ISSUE_TEMPLATE/).
