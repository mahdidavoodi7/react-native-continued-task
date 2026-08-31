import { Platform } from 'react-native';
import {
  ContinuedTasks,
  getSubmitErrorCode,
  type ContinuedTask,
} from 'react-native-continued-task';
import type { CheckResult } from './QaResultsStore';

export const EXPORT_PREFIX = 'continuedtask.example.export';
export const RENDER_PREFIX = 'continuedtask.example.render';
const UNDECLARED_PREFIX = 'continuedtask.example.undeclared';

const skip = (detail: string): CheckResult => ({
  status: 'skipped',
  detail,
  at: new Date().toISOString(),
});

const pass = (detail: string): CheckResult => ({
  status: 'passed',
  detail,
  at: new Date().toISOString(),
});
const fail = (detail: string): CheckResult => ({
  status: 'failed',
  detail,
  at: new Date().toISOString(),
});

function baseOptions(title: string) {
  return {
    identifierPrefix: EXPORT_PREFIX,
    title,
    subtitle: 'QA',
    totalUnitCount: 10,
    android: { notificationChannelName: 'QA tasks' },
  };
}

/** Ends a task without letting a failure there mask the check's own result. */
function tidy(task: ContinuedTask | undefined): void {
  try {
    task?.complete(true);
  } catch {
    // ignored
  }
}

async function doubleSubmit(): Promise<CheckResult> {
  let first: ContinuedTask | undefined;
  let second: ContinuedTask | undefined;
  try {
    [first, second] = await Promise.all([
      ContinuedTasks.submit(baseOptions('QA double A')),
      ContinuedTasks.submit(baseOptions('QA double B')),
    ]);
    if (first.id === second.id) {
      return fail(`both submissions got the same id: ${first.id}`);
    }
    return pass(
      `two distinct tasks, app alive: …${first.id.slice(-8)}, …${second.id.slice(-8)}`
    );
  } catch (error) {
    return fail(
      `submit rejected: ${getSubmitErrorCode(error)} — ${String(error)}`
    );
  } finally {
    tidy(first);
    tidy(second);
  }
}

async function progressClamp(): Promise<CheckResult> {
  let task: ContinuedTask | undefined;
  try {
    task = await ContinuedTasks.submit(baseOptions('QA clamp'));
    task.setProgress(999, 10);
    const high = task.completedUnitCount;
    task.setProgress(-5, 10);
    const low = task.completedUnitCount;
    if (high !== 10 || low !== 0) {
      return fail(`expected 10 then 0, got ${high} then ${low}`);
    }
    return pass('999 clamped to 10, -5 clamped to 0');
  } catch (error) {
    return fail(String(error));
  } finally {
    tidy(task);
  }
}

async function completeIdempotent(): Promise<CheckResult> {
  let task: ContinuedTask | undefined;
  try {
    task = await ContinuedTasks.submit(baseOptions('QA complete twice'));
    task.complete(true);
    task.complete(false);
    if (task.state !== 'finished') {
      return fail(`state after two completes was "${task.state}"`);
    }
    return pass('state stayed "finished"');
  } catch (error) {
    return fail(String(error));
  }
}

async function appCancel(): Promise<CheckResult> {
  try {
    const task = await ContinuedTasks.submit(baseOptions('QA cancel'));
    const reason = await new Promise<string>((resolve) => {
      const timer = setTimeout(
        () => resolve('(no stop event within 20s)'),
        20000
      );
      task.addOnStopListener((event) => {
        clearTimeout(timer);
        resolve(event.reason);
      });
      task.cancel();
    });
    if (reason !== 'app-cancelled') {
      return fail(`stop reason "${reason}"; task state now "${task.state}"`);
    }
    return pass('stop reason "app-cancelled"');
  } catch (error) {
    return fail(String(error));
  }
}

async function unpermittedIdentifier(): Promise<CheckResult> {
  if (Platform.OS !== 'ios') {
    return skip(
      'iOS only — Android has no BGTaskSchedulerPermittedIdentifiers, so any prefix is accepted'
    );
  }
  try {
    const task = await ContinuedTasks.submit({
      ...baseOptions('QA undeclared'),
      identifierPrefix: UNDECLARED_PREFIX,
    });
    tidy(task);
    return fail('submit resolved for an identifier that was never declared');
  } catch (error) {
    const code = getSubmitErrorCode(error);
    return code === 'not-permitted'
      ? pass('rejected with "not-permitted"')
      : fail(`rejected with "${code}" instead of "not-permitted"`);
  }
}

async function invalidOptions(): Promise<CheckResult> {
  try {
    const task = await ContinuedTasks.submit({
      ...baseOptions('QA zero units'),
      totalUnitCount: 0,
    });
    tidy(task);
    return fail('submit resolved with totalUnitCount 0');
  } catch (error) {
    const code = getSubmitErrorCode(error);
    return code === 'invalid-options'
      ? pass('rejected with "invalid-options"')
      : fail(`code "${code}"; raw: ${String(error)}`);
  }
}

async function gpuGate(): Promise<CheckResult> {
  if (Platform.OS !== 'ios') {
    return skip(
      'iOS only — Android has no GPU resource request, so ios.requiresGPU is ignored by design'
    );
  }
  const supported = ContinuedTasks.supportsGPU;
  let task: ContinuedTask | undefined;
  try {
    task = await ContinuedTasks.submit({
      ...baseOptions('QA GPU'),
      identifierPrefix: RENDER_PREFIX,
      ios: { requiresGPU: true },
    });
    return supported
      ? pass('supportsGPU is true and a GPU task was accepted')
      : fail('supportsGPU is false but a GPU task was accepted anyway');
  } catch (error) {
    const code = getSubmitErrorCode(error);
    if (!supported && code === 'not-permitted') {
      return pass(
        'supportsGPU is false and the GPU task was refused with "not-permitted"'
      );
    }
    return supported
      ? fail(`supportsGPU is true but the GPU task was refused with "${code}"`)
      : fail(`refused with "${code}" instead of "not-permitted"`);
  } finally {
    tidy(task);
  }
}

async function records(): Promise<CheckResult> {
  let task: ContinuedTask | undefined;
  try {
    task = await ContinuedTasks.submit(baseOptions('QA records'));
    const id = task.id;
    task.complete(true);

    const known = await ContinuedTasks.getKnownTasks();
    if (known.find((entry) => entry.id === id) === undefined) {
      return fail('the submitted task was not recorded');
    }
    await ContinuedTasks.forgetTasks([id]);
    const after = await ContinuedTasks.getKnownTasks();
    if (after.find((entry) => entry.id === id) !== undefined) {
      return fail('forgetTasks did not drop the record');
    }
    return pass('recorded, then forgotten');
  } catch (error) {
    return fail(String(error));
  }
}

/** Every automatic check, keyed by the id used in `CHECKS`. */
export const AUTOMATIC_CHECKS: Record<string, () => Promise<CheckResult>> = {
  'double-submit': doubleSubmit,
  'progress-clamp': progressClamp,
  'complete-idempotent': completeIdempotent,
  'app-cancel': appCancel,
  'unpermitted-identifier': unpermittedIdentifier,
  'invalid-options': invalidOptions,
  'gpu-gate': gpuGate,
  records,
};
