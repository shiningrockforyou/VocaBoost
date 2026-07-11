/**
 * Deterministic fixture-identity digest — binds persona IDENTITY (not just case names) across
 * fixture → --pre → activity → anomalies → --post (Codex round-5). If the fixture is edited
 * after --pre, the digest changes and --post rejects the run.
 *
 * The digest hashes, per case (sorted): id, email, role, mode, joinTarget, class, classB.
 * (These are the identity-bearing fields the fixture builder writes; class IDs/list IDs are
 * resolved + additionally bound in --pre/--post, but the digest pins the source-of-truth file.)
 */
import { createHash } from 'crypto';

export function fixtureDigest(fix) {
  const cases = Object.entries(fix.cases || {})
    .map(([id, c]) => ({ id, email: c.email ?? null, role: c.role ?? null, mode: c.mode ?? null, joinTarget: c.joinTarget ?? null, class: c.class ?? null, classB: c.classB ?? null }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const canonical = JSON.stringify({ runId: fix.runId, buildId: fix.buildId, list: fix.list?.id ?? null, cases });
  return createHash('sha256').update(canonical).digest('hex'); // full 64-hex digest (Codex: no truncation)
}
