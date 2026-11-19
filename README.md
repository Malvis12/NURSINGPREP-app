# NursingPrep

NursingPrep is a modern web application designed for nursing exam preparation and study practice.

## Tech Stack

- **Framework:** React 19
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (with custom design tokens and system light/dark themes)
- **Typography:** Plus Jakarta Sans (self-hosted via `@fontsource/plus-jakarta-sans`)
- **Testing:** Vitest, React Testing Library, jsdom
- **Linting:** ESLint

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```

3. Available scripts:
   - `npm run dev` - Start development server
   - `npm run build` - Typecheck and build for production
   - `npm run lint` - Run ESLint checks
   - `npm run typecheck` - Run TypeScript compiler check
   - `npm run test` - Run tests with Vitest

## Engineering Rules

- **Never commit secrets**: Never commit API keys, credentials, `.env`, or sensitive environment variables to the repository. Use `.env.example` as a template for required local variables.
- **All changes go through a PR**: Do not push directly to `main`. All changes must be proposed via pull requests and pass automated CI checks (lint, typecheck, test, build).
