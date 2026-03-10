# Design Review Reference

> Sourced from: https://github.com/EricTechPro/match-me/commit/231e5fa52d32e9c0c4df9ea58d3d80fcbd118766

## Design Review Agent Methodology

### Core Philosophy
- **"Live Environment First"** — prioritize actual user experience over theoretical standards
- **S-Tier SaaS design standards** inspired by Stripe, Airbnb, and Linear

### Review Phases

**Phase 0: Preparation**
- Analyze PR and review code diff
- Configure Playwright for automated testing

**Phase 1: Interaction & User Flow Testing**
- Test all interactive elements in the live environment
- Verify user flows work as expected

**Phase 2: Responsiveness Testing**
- Desktop: 1440px
- Tablet: 768px
- Mobile: 375px

**Phase 3: Visual Polish Assessment**
- Alignment and spacing consistency
- Typography hierarchy and readability
- Visual hierarchy and information architecture

**Phase 4: Accessibility Compliance**
- WCAG 2.1 AA standards
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios

**Phase 5: Robustness Testing**
- Form validation edge cases
- Error state handling
- Loading and empty state behavior

**Phase 6: Code Health Review**
- Component reuse patterns
- Design token compliance
- CSS/styling consistency

**Phase 7: Content & Console Verification**
- Console error checking
- Content accuracy and completeness

---

## Communication Framework

### Principles
1. **Problems over prescriptions** — describe impact, not technical solutions
2. **Evidence-based feedback** — always include screenshots
3. **Positive acknowledgment before critiques**

### Triage Matrix
- **[Blocker]** — Prevents release, must fix
- **[High-Priority]** — Significant UX impact, fix before release
- **[Medium-Priority]** — Noticeable issue, can ship but should fix soon
- **[Nitpick]** — Minor polish, nice to have

### Report Structure
```markdown
### Design Review Summary
[Positive opening and overall assessment]

### Findings
#### Blockers
#### High-Priority
#### Medium-Priority / Suggestions
#### Nitpicks
```

---

## Playwright MCP Tools for Testing

```javascript
// Navigation & Screenshots
mcp__playwright__browser_navigate(url)
mcp__playwright__browser_take_screenshot()
mcp__playwright__browser_resize(width, height)

// Interaction Testing
mcp__playwright__browser_click(element)
mcp__playwright__browser_type(element, text)
mcp__playwright__browser_hover(element)
mcp__playwright__browser_select_option(element)

// Validation
mcp__playwright__browser_console_messages()
mcp__playwright__browser_snapshot()
mcp__playwright__browser_wait_for(text/element)
```

---

## Design Compliance Checklist

- [ ] **Visual Hierarchy**: Clear focus flow, appropriate spacing
- [ ] **Consistency**: Uses design tokens, follows established patterns
- [ ] **Responsiveness**: Works on mobile (375px), tablet (768px), desktop (1440px)
- [ ] **Accessibility**: Keyboard navigable, proper contrast, semantic HTML
- [ ] **Performance**: Fast load times, smooth animations (150-300ms)
- [ ] **Error Handling**: Clear error states, helpful messages
- [ ] **Polish**: Micro-interactions, loading states, empty states

---

## When to Use

### Quick Visual Check (every front-end change)
1. Identify what changed
2. Navigate to affected pages
3. Verify design compliance
4. Validate feature implementation
5. Check acceptance criteria
6. Capture evidence at 1440px
7. Check for console errors

### Comprehensive Review (major features, PRs, refactors)
- Full phase 0-7 walkthrough
- All three viewport sizes
- Complete accessibility audit
- Code health review
