# @po/api

NestJS API. Configuration is validated at startup (`src/config/`); an invalid or non-test environment
stops the process before anything else runs.

| Command                     | What                        |
| --------------------------- | --------------------------- |
| `pnpm dev`                  | Watch mode (SWC)            |
| `pnpm build` / `pnpm start` | Compile to `dist/` and run  |
| `pnpm test`                 | Unit and e2e tests (Vitest) |
| `pnpm typecheck`            | `tsc --noEmit`              |
