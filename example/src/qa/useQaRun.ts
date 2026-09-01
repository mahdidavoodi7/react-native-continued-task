import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  ContinuedTasks,
  getSubmitErrorCode,
  type ContinuedTask,
} from 'react-native-continued-task';
import { CHECKS } from './checks';
import { ensureNotificationPermission } from './ensureNotificationPermission';
import {
  QaResultsStore,
  type CheckResult,
  type QaState,
} from './QaResultsStore';
import { AUTOMATIC_CHECKS, EXPORT_PREFIX } from './runAutomaticChecks';

/** What each kill-surviving check expects to find in the task's record. */
const EXPECTED_STOP_REASON: Record<string, string> = {
  'live-activity-cancel': 'expired',
  'stalled-expires': 'expired',
  'app-terminated': 'app-terminated',
};

export function useQaRun() {
  const [state, setState] = useState<QaState>(() => QaResultsStore.read());
  const [busy, setBusy] = useState<string | undefined>(undefined);
  const armedTask = useRef<ContinuedTask | undefined>(undefined);

  const save = useCallback((next: QaState) => {
    QaResultsStore.write(next);
    setState(next);
  }, []);

  const setResult = useCallback((id: string, result: CheckResult) => {
    setState((current) => {
      const next = {
        ...current,
        results: { ...current.results, [id]: result },
      };
      QaResultsStore.write(next);
      return next;
    });
  }, []);

  /**
   * Resolves checks that were armed before the app was backgrounded or killed.
   *
   * The persisted records are the source of truth here — a stop listener
   * cannot be relied on, which is the whole point of these three checks.
   */
  const verifyArmed = useCallback(async () => {
    const current = QaResultsStore.read();
    const armed = Object.entries(current.results).filter(
      ([, result]) =>
        result.status === 'armed' && result.armedTaskId !== undefined
    );
    if (armed.length === 0) return;

    const known = await ContinuedTasks.getKnownTasks();
    for (const [id, result] of armed) {
      const record = known.find((entry) => entry.id === result.armedTaskId);
      if (record === undefined) {
        setResult(id, {
          status: 'failed',
          detail: 'no record found for the armed task',
          at: new Date().toISOString(),
        });
        continue;
      }
      if (record.stopReason === undefined) {
        continue; // still running; check again next time the app is foregrounded
      }
      const expected = EXPECTED_STOP_REASON[id];
      setResult(id, {
        status: record.stopReason === expected ? 'passed' : 'failed',
        detail:
          `stop reason "${record.stopReason}" (expected "${expected}"), ` +
          `progress ${record.completedUnitCount}/${record.totalUnitCount}`,
        at: new Date().toISOString(),
      });
      await ContinuedTasks.forgetTasks([record.id]);
    }
  }, [setResult]);

  useEffect(() => {
    verifyArmed().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        verifyArmed().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [verifyArmed]);

  const runAutomatic = useCallback(async () => {
    for (const check of CHECKS.filter((c) => c.kind === 'automatic')) {
      const run = AUTOMATIC_CHECKS[check.id];
      if (run === undefined) continue;
      setBusy(check.id);
      try {
        setResult(check.id, await run());
      } catch (error) {
        setResult(check.id, {
          status: 'failed',
          detail: `threw: ${String(error)}`,
          at: new Date().toISOString(),
        });
      }
    }
    setBusy(undefined);
  }, [setResult]);

  /** Submits the task a kill-surviving check will be judged on. */
  const arm = useCallback(
    async (checkId: string) => {
      setBusy(checkId);
      try {
        await ensureNotificationPermission();
        const task = await ContinuedTasks.submit({
          identifierPrefix: EXPORT_PREFIX,
          title: 'QA export',
          subtitle: 'starting',
          totalUnitCount: 60,
          android: {
            notificationChannelName: 'QA tasks',
            notificationIcon: 'ic_notification',
          },
        });
        armedTask.current = task;
        setResult(checkId, {
          status: 'armed',
          armedTaskId: task.id,
          detail: 'waiting — follow the instructions above, then come back',
          at: new Date().toISOString(),
        });

        // The stalled check must report nothing; the others report progress so
        // they are not expired for looking stalled before the tester acts.
        if (checkId !== 'stalled-expires') {
          let step = 0;
          const timer = setInterval(() => {
            step += 1;
            if (step > 60 || task.state !== 'running') {
              clearInterval(timer);
              return;
            }
            task.setProgress(step, 60);
            task.updateTitle('QA export', `${step} of 60`);
          }, 1000);
        }
      } catch (error) {
        setResult(checkId, {
          status: 'failed',
          detail: `submit rejected: ${getSubmitErrorCode(error)}`,
          at: new Date().toISOString(),
        });
      }
      setBusy(undefined);
    },
    [setResult]
  );

  const mark = useCallback(
    (
      checkId: string,
      status: 'passed' | 'failed' | 'skipped',
      detail: string
    ) => {
      setResult(checkId, { status, detail, at: new Date().toISOString() });
    },
    [setResult]
  );

  const reset = useCallback(() => {
    armedTask.current = undefined;
    save({ startedAt: new Date().toISOString(), results: {} });
  }, [save]);

  return { state, busy, runAutomatic, arm, mark, reset, verifyArmed };
}
