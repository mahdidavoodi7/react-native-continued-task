import {
  ContinuedTasks,
  getSubmitErrorCode,
} from 'react-native-continued-task';
import { Platform } from 'react-native';

/**
 * Runs inside the real example app against the real HybridObject.
 *
 * What this can prove is the boundary: that the Nitro bridge round-trips
 * every type in the spec, that validation rejects before touching the
 * platform, and that failures arrive as parseable codes rather than crashes.
 * What it cannot prove is `BGContinuedProcessingTask` behaviour — the iOS
 * simulator has no background task scheduler at all.
 */
describe('ContinuedTasks HybridObject', () => {
  it('resolves the autolinked HybridObject', () => {
    expect(ContinuedTasks).toBeDefined();
    expect(typeof ContinuedTasks.submit).toBe('function');
  });

  it('exposes capability flags as booleans across the bridge', () => {
    expect(typeof ContinuedTasks.isSupported).toBe('boolean');
    expect(typeof ContinuedTasks.supportsGPU).toBe('boolean');
    expect(typeof ContinuedTasks.supportsReattach).toBe('boolean');
  });

  it('reports reattach support the way each platform actually behaves', () => {
    // A WorkManager worker outlives the app process; an iOS continued
    // processing task does not.
    expect(ContinuedTasks.supportsReattach).toBe(Platform.OS === 'android');
  });

  it('never reports GPU support on Android', () => {
    if (Platform.OS !== 'android') return;
    expect(ContinuedTasks.supportsGPU).toBe(false);
  });

  it('returns an array from getKnownTasks', async () => {
    const known = await ContinuedTasks.getKnownTasks();
    expect(Array.isArray(known)).toBe(true);
  });

  it('accepts forgetTasks for ids it does not know', async () => {
    await ContinuedTasks.forgetTasks(['not-a-real-task-id']);
  });

  it('resolves attachToTask to undefined for an unknown id', async () => {
    const attached = await ContinuedTasks.attachToTask('not-a-real-task-id');
    expect(attached).toBeUndefined();
  });

  describe('validation', () => {
    const base = {
      title: 'Exporting',
      subtitle: '0 of 10',
      totalUnitCount: 10,
    };

    it('rejects an empty identifier prefix with a parseable code', async () => {
      const error = await ContinuedTasks.submit({
        ...base,
        identifierPrefix: '',
      }).catch((caught: unknown) => caught);

      expect(getSubmitErrorCode(error)).toBe('invalid-identifier');
    });

    it('rejects a prefix that still carries its wildcard suffix', async () => {
      const error = await ContinuedTasks.submit({
        ...base,
        identifierPrefix: 'continuedtask.example.export.*',
      }).catch((caught: unknown) => caught);

      expect(getSubmitErrorCode(error)).toBe('invalid-identifier');
    });

    it('rejects a zero totalUnitCount, because progress is mandatory', async () => {
      const error = await ContinuedTasks.submit({
        ...base,
        identifierPrefix: 'continuedtask.example.export',
        totalUnitCount: 0,
      }).catch((caught: unknown) => caught);

      expect(getSubmitErrorCode(error)).toBe('invalid-options');
    });

    it('rejects an identifier the app never declared', async () => {
      if (Platform.OS !== 'ios') return;
      const error = await ContinuedTasks.submit({
        ...base,
        identifierPrefix: 'continuedtask.example.undeclared',
      }).catch((caught: unknown) => caught);

      // Either the plist check or BGTaskScheduler itself refuses it, and both
      // report the same code.
      expect(getSubmitErrorCode(error)).toBe('not-permitted');
    });

    it('surfaces a rejection as an Error, never a crash', async () => {
      const error = await ContinuedTasks.submit({
        ...base,
        identifierPrefix: '',
      }).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(String((error as Error).message)).toContain('continued-task/');
    });
  });
});
