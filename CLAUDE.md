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
- **Always read** `src/apBoost/ARCHITECTURE.md` before making apBoost changes (system design, data flow, hook composition, design decisions)
- **Read** `src/apBoost/AP_BOOST_TRACKER.md` when working on apBoost fixes/improvements (progress tracker, sprint plan, remaining work items)

## Visual Development & Testing

### Quick Visual Check
**IMMEDIATELY after implementing any front-end change:**
1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Verify design compliance** - Compare against design tokens in `/src/index.css`
4. **Validate feature implementation** - Ensure the change fulfills the user's specific request
5. **Check acceptance criteria** - Review any provided context files or requirements
6. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
7. **Check for errors** - Run `mcp__playwright__browser_console_messages`

This verification ensures changes meet design standards and user requirements.

### Comprehensive apBoost Audit
For acceptance criteria verification or before merging PRs with apBoost changes, use the audit agent:

```bash
# Option 1: Use the slash command
/apboost-audit

# Option 2: Invoke the agent directly
@agent-apboost-audit
```

The audit agent will:
- Test all interactive states and user flows against criteria audit files
- Verify responsiveness (desktop/tablet/mobile)
- Check accessibility (WCAG 2.1 AA compliance)
- Validate visual polish, design token usage, and consistency
- Test edge cases and error states
- Provide categorized feedback (Blockers/High/Medium/Nitpicks)
- Save reports to `src/apBoost/criteria_audit/playwright_reports/`

### Playwright MCP Integration

#### Essential Commands for UI Testing

```javascript
// Navigation & Screenshots
mcp__playwright__browser_navigate(url)          // Navigate to page
mcp__playwright__browser_take_screenshot()      // Capture visual evidence
mcp__playwright__browser_resize(width, height)  // Test responsiveness

// Interaction Testing
mcp__playwright__browser_click(element)         // Test clicks
mcp__playwright__browser_type(element, text)    // Test input
mcp__playwright__browser_hover(element)         // Test hover states
mcp__playwright__browser_select_option(element) // Test dropdowns

// Validation
mcp__playwright__browser_console_messages()     // Check for errors
mcp__playwright__browser_snapshot()             // DOM/accessibility check
mcp__playwright__browser_wait_for(text/element) // Ensure loading complete
```

### Design Compliance Checklist
When implementing UI features, verify:
- [ ] **Visual Hierarchy**: Clear focus flow, appropriate spacing
- [ ] **Consistency**: Uses design tokens, follows patterns
- [ ] **Responsiveness**: Works on mobile (375px), tablet (768px), desktop (1440px)
- [ ] **Accessibility**: Keyboard navigable, proper contrast, semantic HTML
- [ ] **Performance**: Fast load times, smooth animations (150-300ms)
- [ ] **Error Handling**: Clear error states, helpful messages
- [ ] **Polish**: Micro-interactions, loading states, empty states

### When to Use Automated Visual Testing

#### Use Quick Visual Check for:
- Every front-end change, no matter how small
- After implementing new components or features
- When modifying existing UI elements
- After fixing visual bugs

#### Use Comprehensive Audit for:
- Verifying acceptance criteria from `src/apBoost/criteria_audit/`
- Before creating pull requests with UI changes
- When refactoring component architecture
- After significant design system updates
- When accessibility compliance is critical

#### Skip Visual Testing for:
- Backend-only changes (services, Cloud Functions)
- Configuration file updates
- Documentation changes
- Test file modifications
- Non-visual utility functions

## Safety
- Never commit `.env` files or Firebase credentials
