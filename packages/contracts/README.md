# @po/contracts

Zod schemas and types of the public API. The single source of truth for request and
response shapes: the API validates with them and the dashboard will import the same types.

`pnpm --filter @po/contracts build` compiles to `dist/` (Turborepo builds it before its dependents).
