import { Platform } from 'react-native';
import { ContinuedTasks } from 'react-native-continued-task';
import { CHECKS } from './checks';
import type { QaState } from './QaResultsStore';

/**
 * Renders the run as markdown so a tester can paste it into an issue or a PR.
 *
 * The capability line matters as much as the results: a run on a device where
 * `supportsGPU` is false says nothing about the GPU path.
 */
export function buildReport(state: QaState): string {
  const lines: string[] = [
    '# react-native-continued-task — device QA',
    '',
    `- platform: ${Platform.OS} ${String(Platform.Version)}`,
    `- isSupported: ${String(ContinuedTasks.isSupported)}`,
    `- supportsGPU: ${String(ContinuedTasks.supportsGPU)}`,
    `- supportsReattach: ${String(ContinuedTasks.supportsReattach)}`,
    `- run started: ${state.startedAt}`,
    '',
  ];

  const icon: Record<string, string> = {
    passed: '✅',
    failed: '❌',
    armed: '⏳',
    skipped: '⏭️',
    pending: '⬜',
  };

  let passed = 0;
  let failed = 0;
  for (const check of CHECKS) {
    const result = state.results[check.id];
    const status = result?.status ?? 'pending';
    if (status === 'passed') passed += 1;
    if (status === 'failed') failed += 1;
    lines.push(
      `${icon[status] ?? '⬜'} **${check.title}** (\`${check.id}\`, ${check.kind})`
    );
    if (result?.detail !== undefined) {
      lines.push(`   - ${result.detail}`);
    }
  }

  lines.splice(
    7,
    0,
    `**${passed} passed, ${failed} failed, ${CHECKS.length - passed - failed} not run**`,
    ''
  );
  return lines.join('\n');
}
