# Repository Guidelines

## Project Structure & Module Organization
- `src/main.ts` boots the Discord client, loads decorators, and reads `BOT_TOKEN`.
- `src/commands/` stores slash/simple command classes; keep each class focused on one feature set.
- `src/events/` provides listener classes; move common helpers into a shared module when needed.
- Compiled output lands in `build/`; workspace-level config sits at the root (`biome.jsonc`, `lefthook.yml`, Docker files).

## Build, Test, and Development Commands
- `npm install` (or `bun install`) restores dependencies.
- `npm run dev` runs the bot in dev mode via `tsx`.
- `npm run watch` wraps dev mode with Nodemon auto-reload.
- `npm run build` emits JS to `build/`; run before `npm run start`.
- `npm run start` executes the compiled bundle; prefer in production or Docker.
- `docker-compose up -d` launches the containerised bot; `docker-compose down` stops it.

## Coding Style & Naming Conventions
- TypeScript ES modules with decorators (`@Discord`, `@Slash`) define behaviour; name classes in PascalCase and exported helpers in camelCase.
- Biome (extending the Ultracite preset) handles formatting and linting; run `bun x ultracite fix` or rely on the Lefthook pre-commit job.
- Stick to two-space indentation, explicit return types, and colocate command constants with their handlers.

## Testing Guidelines
- A runner is not yet defined; prefer Vitest or Bun specs named `*.spec.ts` under `tests/` or beside the code they cover.
- Until automation exists, smoke-test commands in a Discord sandbox server and capture steps in the PR description.
- Target coverage for command execution paths and event side-effects before merging significant behaviour changes.

## Commit & Pull Request Guidelines
- Follow the existing short, imperative commit style (`add ultracite`, `fix`); group related changes and avoid multi-feature bundles.
- Before committing, run `bun x ultracite fix` and `npm run build` to catch lint and type issues early.
- PRs should summarise changes, list testing performed, note new env vars, and attach Discord logs or screenshots for interaction updates.
- Link GitHub issues or task refs in PR descriptions, and request review before deploying or tagging releases.

## Security & Configuration Tips
- Pass `BOT_TOKEN` (and related Discord secrets) via environment variables or a local `.env` ignored by Git.
- Rotate tokens immediately if exposed and update your hosting platform's secret store after merges.
