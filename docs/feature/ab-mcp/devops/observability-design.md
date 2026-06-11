# Observability Design -- ab-mcp (DEVOPS)

## Decision: Structured stderr logs only

**Confirmed by stakeholder.** ab-mcp is a local stdio MCP server with no
running service to "monitor" in the conventional sense (no dashboards,
metrics backend, or alerting infra -- continuous learning capabilities are
explicitly N/A, see `platform-architecture.md`). The observability need is
narrower: **make each tool call's behavior legible enough, during dogfood
sessions, to evaluate the outcome KPIs from `discuss/outcome-kpis.md`.**

## Why stderr (not stdout)

MCP over stdio uses **stdout** exclusively for the JSON-RPC protocol stream
to the host agent. Any diagnostic output on stdout would corrupt the protocol.
All ab-mcp logging therefore goes to **stderr**, one JSON object per line
(structured, machine-greppable), which the host (e.g., Claude Code) typically
surfaces in its own debug/log view without affecting the tool's responses.

## Log Schema

One JSON line per tool invocation, emitted by the imperative shell (Response
Formatter container) after building the response:

```json
{
  "ts": "2026-06-11T10:32:01.123Z",
  "tool": "query_context",
  "args": { "repo_name": "ab-mcp", "feature_id": "ab-mcp" },
  "outcome": "partial" ,
  "warnings": ["NO_CLAUDE_MD"],
  "error_code": null,
  "matched_files": ["docs/feature/ab-mcp/discuss/wave-decisions.md", "docs/product/architecture/brief.md"],
  "duration_ms": 4
}
```

Field notes:
- `outcome`: one of `full | partial | error` -- directly supports KPI-4 (error
  coverage) and KPI-5 (warning accuracy) by making it trivial to grep for
  `"outcome":"error"` or `"outcome":"partial"` and inspect `warnings`/`error_code`.
- `error_code`: one of the 4 structured error codes (`REPO_NOT_CONFIGURED`,
  `REPO_PATH_NOT_FOUND`, `FEATURE_NOT_FOUND`, `NO_NWAVE_STRUCTURE`) or `null`.
- `matched_files`: source-attributed list (traces to `source_file` shared
  artifact from `discuss/shared-artifacts-registry.md`) -- supports KPI-1
  (did the agent get real, attributed content?) and KPI-2 (staleness checks --
  re-running the same query and diffing `matched_files`/content).
- `duration_ms`: not a perf SLO (no perf NFR was set in DESIGN), included only
  as a free signal in case extraction-time outliers emerge during dogfooding.

No PII, no file contents, no full config -- only paths, codes, and counts.

## What is explicitly OUT of scope

- Metrics backends (Prometheus/Datadog/CloudWatch/etc.) -- no infrastructure
  to scrape from, no team to view dashboards.
- Distributed tracing -- single process, single hop (stdio), nothing to trace
  across.
- Alerting/SLOs -- no on-call, no production service.
- Log aggregation/shipping -- logs stay local (stderr -> host's own log
  capture, if any).

If ab-mcp later grows a hosted/multi-user mode, this section should be
revisited -- but that is out of scope per DISCOVER's `D-scope` decision.
