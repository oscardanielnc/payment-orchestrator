# 0003. One codebase, two processes: API and worker

- Status: Accepted
- Date: 2026-09-28

## Context
Webhook processing, chain watchers, outbox relay and schedulers must not slow down HTTP requests
or die with them.

## Options considered
- Everything in the HTTP process: simple, but a slow watcher affects API latency
- Separate microservices: operational overhead with no benefit at this size
- **Same NestJS app, two entrypoints**

## Decision
`main.ts` boots the HTTP API. `worker.ts` boots queue consumers, watchers, outbox relay and cron jobs.
Both share modules; each entrypoint imports only what it runs.

## Consequences
- Scale and restart them independently (two containers in Compose)
- A crash in a watcher does not take the API down
