import { ContinuedTasks } from 'react-native-continued-task';
import { Platform } from 'react-native';

const EXPORT_PREFIX = 'continuedtask.example.export';

/**
 * Exercises a real task end to end where the platform allows it.
 *
 * Android runs this fully: WorkManager starts a real foreground service on the
 * emulator. iOS cannot — `BGTaskScheduler` reports `.unavailable` on the
 * simulator — so those cases assert the honest degradation instead and the
 * real behaviour is covered by the on-device checklist.
 */
describe('a submitted task', () => {
  const options = {
    identifierPrefix: EXPORT_PREFIX,
    title: 'Harness export',
    subtitle: '0 of 4',
    totalUnitCount: 4,
  };

  it('is unavailable on the iOS simulator, and says so', async () => {
    if (Platform.OS !== 'ios') return;
    const error = await ContinuedTasks.submit(options).catch(
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(Error);
  });

  it('starts, reports progress, and completes', async () => {
    if (Platform.OS !== 'android') return;

    const task = await ContinuedTasks.submit(options);
    expect(task.id.startsWith(`${EXPORT_PREFIX}.`)).toBe(true);
    expect(task.title).toBe('Harness export');
    expect(task.totalUnitCount).toBe(4);

    const started = new Promise<void>((resolve) => {
      task.addOnStartListener(() => resolve());
    });
    await started;
    expect(task.state).toBe('running');

    task.setProgress(2, 4);
    expect(task.completedUnitCount).toBe(2);

    task.updateTitle('Harness export', '2 of 4');
    expect(task.subtitle).toBe('2 of 4');

    task.complete(true);
    expect(task.state).toBe('finished');
  });

  it('clamps progress into range rather than trusting the caller', async () => {
    if (Platform.OS !== 'android') return;

    const task = await ContinuedTasks.submit(options);
    task.setProgress(99, 4);
    expect(task.completedUnitCount).toBe(4);

    task.setProgress(-5, 4);
    expect(task.completedUnitCount).toBe(0);

    task.complete(true);
  });

  it('reports app-cancelled when the app cancels it', async () => {
    if (Platform.OS !== 'android') return;

    const task = await ContinuedTasks.submit(options);
    const stopped = new Promise<string>((resolve) => {
      task.addOnStopListener((event) => resolve(event.reason));
    });

    task.cancel();
    expect(await stopped).toBe('app-cancelled');
    expect(task.state).toBe('stopped');
  });

  it('carries the raw platform detail alongside the mapped reason', async () => {
    if (Platform.OS !== 'android') return;

    const task = await ContinuedTasks.submit(options);
    const event = await new Promise<{
      taskId: string;
      reason: string;
      native: { domain: string; name: string; code?: number };
    }>((resolve) => {
      task.addOnStopListener(resolve);
      task.cancel();
    });

    expect(event.taskId).toBe(task.id);
    expect(event.native.domain).toBe('WorkManager');
    expect(event.native.name).toContain('STOP_REASON_');
  });

  it('treats a second complete as a no-op', async () => {
    if (Platform.OS !== 'android') return;

    const task = await ContinuedTasks.submit(options);
    task.complete(true);
    task.complete(false);
    expect(task.state).toBe('finished');
  });

  it('lets a removed stop listener stop receiving events', async () => {
    if (Platform.OS !== 'android') return;

    const task = await ContinuedTasks.submit(options);
    let calls = 0;
    const subscription = task.addOnStopListener(() => {
      calls += 1;
    });
    subscription.remove();
    task.cancel();

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(calls).toBe(0);
  });

  it('records the task so it can be reconciled later', async () => {
    if (Platform.OS !== 'android') return;

    const task = await ContinuedTasks.submit(options);
    task.complete(true);

    const known = await ContinuedTasks.getKnownTasks();
    const record = known.find((entry) => entry.id === task.id);
    expect(record).toBeDefined();
    expect(record?.identifierPrefix).toBe(EXPORT_PREFIX);

    await ContinuedTasks.forgetTasks([task.id]);
    const after = await ContinuedTasks.getKnownTasks();
    expect(after.find((entry) => entry.id === task.id)).toBeUndefined();
  });

  it('does not crash when two tasks are submitted back to back', async () => {
    if (Platform.OS !== 'android') return;

    const [first, second] = await Promise.all([
      ContinuedTasks.submit(options),
      ContinuedTasks.submit(options),
    ]);

    expect(first.id).not.toBe(second.id);
    first.complete(true);
    second.complete(true);
  });
});
