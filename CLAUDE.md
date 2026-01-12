# VocaBoost Project Instructions

## General Rules
1. Always log code changes to `change_action_log.md` using the table format: `| Date | File | Change |`
2. Always consider industry convention / best practice when coming up with solutions or plans
3. Always return the relevant/recent part of the plan in chat so user can see it easily

## Tech Stack
- React 19 + Vite 7 + React Router v7
- Firebase (Auth + Firestore) backend
- Tailwind CSS v4
- Cloud Functions for AI grading (OpenAI)

## File Organization
- Pages: `/src/pages/`
- Components: `/src/components/` (UI library in `/src/components/ui/`)
- Services: `/src/services/`
- Contexts: `/src/contexts/`
- Utilities: `/src/utils/`
- Hooks: `/src/hooks/`

## Code Conventions
- Use existing UI components from `/src/components/ui/` before creating new ones
- Follow existing Firestore patterns in `db.js` (includes retry logic)
- Use AuthContext and ThemeContext for global state

## Design Tokens (IMPORTANT)
- ALWAYS use design tokens from `/src/index.css` instead of raw Tailwind values or custom CSS
- Background colors: `bg-base`, `bg-surface`, `bg-muted`, `bg-inset`
- Text colors: `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-faint`
- Borders: `border-border-default`, `border-border-strong`, `border-border-muted`
- Radius: `rounded-[--radius-card]`, `rounded-[--radius-button]`, `rounded-[--radius-input]`
- Semantic states: `bg-success`, `bg-error`, `bg-warning`, `bg-info` (and their variants)
- Brand colors: `bg-brand-primary`, `bg-brand-accent`, `text-brand-text`
- Shadows: `shadow-theme-sm`, `shadow-theme-md`, `shadow-theme-lg`
- DO NOT use raw values like `bg-slate-100`, `text-gray-700`, `rounded-lg` - use tokens instead

## apBoost Development Rules
- Log apBoost changes to `change_action_log_ap.md` (not the main log)
- ALL apBoost code must live in `/src/apBoost/` folder
- ALL apBoost assets must live in `/public/apBoost/` folder
- NEVER modify existing vocaBoost files (except the single route import in App.jsx)
- Import existing components/services from parent directories, don't copy them
- All AP routes must be under the `/ap/*` path
- Use `ap_` prefix for Firestore collections (e.g., `ap_classes`, `ap_lists`)

## Safety
- Never commit `.env` files or Firebase credentials
