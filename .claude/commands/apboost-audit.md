---
name: apboost-audit
description: Conduct a comprehensive Playwright-driven audit of apBoost UI against acceptance criteria
---

You need to invoke the apboost-audit agent to conduct a comprehensive live audit of apBoost features against the acceptance criteria.

First, ensure the development server is running on http://localhost:5173, then use the apboost-audit agent to systematically verify all criteria following the phases outlined in /.claude/agents/apboost-audit-agent.md.

The agent will:
1. Prepare by reading criteria audit files and understanding what to verify
2. Test interaction and user flows in the live application
3. Verify responsiveness across viewports (1440px, 768px, 375px)
4. Assess visual polish, design token usage, and consistency
5. Check accessibility compliance (WCAG 2.1 AA)
6. Verify each acceptance criterion with evidence (screenshots, DOM snapshots)
7. Test robustness and edge cases
8. Check content and console for issues

Use the Agent tool to invoke the apboost-audit agent with the following prompt:

"Audit apBoost sections [specify sections, e.g., 1.1 to 1.4] against the acceptance criteria. The development server is running on http://localhost:5173. Read the criteria audit file at src/apBoost/criteria_audit/section_[range]_criteria_audit.md first, then conduct a comprehensive live audit following all phases in your methodology. Cross-reference against src/apBoost/AP_BOOST_TRACKER.md for known status of each item. Provide a structured report with criteria results and findings categorized as Blockers, High-Priority, Medium-Priority, and Nitpicks. Save the report to src/apBoost/criteria_audit/playwright_reports/."

The final output should be a markdown report following the structure defined in the agent configuration.
