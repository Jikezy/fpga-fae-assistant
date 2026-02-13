# Repository Guidelines

## Language
- Default collaboration language for this repository is **Simplified Chinese (????)**.
- Please write new documentation, issue/PR descriptions, and review comments in Simplified Chinese unless an external integration explicitly requires English.

## Project Structure & Module Organization
- `app/`: Next.js App Router pages and API routes (for example `app/api/bom/*`, `app/admin/*`, `app/settings/*`).
- `components/`: Reusable React UI components (chat UI, lists, backgrounds, inputs).
- `lib/`: Core business logic and integrations (auth, BOM parsing, DB access, rate limiting, queue guards).
- `public/`: Static assets.
- Root configs: `next.config.js`, `tailwind.config.ts`, `.editorconfig`, `.prettierrc`, `.eslintrc.js`.

## Build, Test, and Development Commands
- `npm install`: Install dependencies.
- `npm run dev`: Start local development server (`http://localhost:3000`).
- `npm run build`: Create production build and type-check routes/pages.
- `npm run start`: Run production build locally.
- `npm run lint`: Run Next.js ESLint rules.
- Optional wrappers: `start.sh` (Linux/macOS) and `start.bat` (Windows).

## Coding Style & Naming Conventions
- Language: TypeScript (`.ts`/`.tsx`), 2-space indentation, UTF-8, LF line endings.
- Formatting: no semicolons, single quotes, trailing commas (`es5`), print width 80.
- Follow `.editorconfig` and `.prettierrc` exactly.
- React components use PascalCase filenames (for example `ChatInterface.tsx`).
- Utility modules in `lib/` use descriptive kebab-case (for example `bom-parser.ts`, `bom-request-guard.ts`).
- API handlers live in `app/api/**/route.ts` and should keep auth/role checks near the top.

## Testing Guidelines
- There is no dedicated unit-test suite yet.
- Required validation before merging: `npm run lint` and `npm run build`.
- For API changes, manually test success + failure paths (auth, rate-limit, fallback behavior).
- For UI changes, verify desktop and mobile flows and attach screenshots in PRs.

## Commit & Pull Request Guidelines
- Use Conventional Commit style seen in history: `feat:`, `fix:`, `perf:`, `refactor:`.
- Keep each commit scoped to one concern and include affected area in message.
- PRs should include: purpose, key file changes, risk notes, verification steps, and screenshots for UI changes.
- Mention any environment variable or migration impact explicitly.

## Security & Configuration Tips
- Copy `.env.example` to `.env`; never commit secrets.
- Do not log API keys or raw credentials.
- Admin routes must enforce role checks (`requireAdmin`) and destructive operations should be explicit and auditable.
