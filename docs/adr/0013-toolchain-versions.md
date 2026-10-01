# 0013. Toolchain versions follow ecosystem compatibility, not "latest"

- Status: Accepted
- Date: 2026-10-01

## Context

At scaffold time the newest majors were NestJS 12 and TypeScript 7. Their ecosystem had not caught up:
`typescript-eslint` supports TypeScript `<6.1` and `nestjs-zod` supports NestJS `<=11`.

## Options considered

- Latest majors everywhere: broken peer dependencies, lint without type information
- **Newest versions the whole toolchain supports together**

## Decision

NestJS 11 · TypeScript 6.0 · Zod 4 · Vitest 5 (with `unplugin-swc` for decorators) · ESLint 10 flat config
· Turborepo 2 · pnpm 12 · Node 24 LTS. Build and dev run through the Nest CLI with the SWC builder;
type checking is a separate `tsc --noEmit` task. Config is validated with our own Zod schema instead of
`@nestjs/config` (fewer moving parts, validation before the DI container exists).

## Consequences

- Upgrade to NestJS 12 / TypeScript 7 in one PR once `typescript-eslint` and `nestjs-zod` support them
- pnpm build scripts are opt-in (`allowBuilds` in `pnpm-workspace.yaml`); new native deps must be approved
