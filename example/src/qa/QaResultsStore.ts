import { Directory, File, Paths } from 'expo-file-system';
import type { CheckStatus } from './checks';

export interface CheckResult {
  status: CheckStatus;
  /** What was actually observed, so a failure is readable a day later. */
  detail?: string;
  /** ISO timestamp of the last change. */
  at?: string;
  /** The task this check is waiting on, for checks armed across a kill. */
  armedTaskId?: string;
}

export interface QaState {
  startedAt: string;
  results: Record<string, CheckResult>;
}

const DIRECTORY = 'continued-task-qa';
const FILE_NAME = 'results.json';

/**
 * Persists QA results to disk.
 *
 * Three of the checks require the app to be backgrounded or swiped away, so
 * results kept only in React state would be destroyed by the very thing being
 * tested. This uses `expo-file-system`, which `expo` already depends on, so
 * running QA needs no extra native module.
 */
export const QaResultsStore = {
  read(): QaState {
    try {
      const file = new File(Paths.document, DIRECTORY, FILE_NAME);
      if (!file.exists) {
        return { startedAt: new Date().toISOString(), results: {} };
      }
      return JSON.parse(file.textSync()) as QaState;
    } catch {
      return { startedAt: new Date().toISOString(), results: {} };
    }
  },

  write(state: QaState): void {
    try {
      const directory = new Directory(Paths.document, DIRECTORY);
      if (!directory.exists) {
        directory.create({ intermediates: true, idempotent: true });
      }
      const file = new File(Paths.document, DIRECTORY, FILE_NAME);
      if (!file.exists) {
        file.create({ overwrite: true });
      }
      file.write(JSON.stringify(state, null, 2));
    } catch {
      // A QA run is still useful in memory if the disk write fails; losing
      // results is better than crashing the app under test.
    }
  },

  clear(): void {
    QaResultsStore.write({ startedAt: new Date().toISOString(), results: {} });
  },
};
