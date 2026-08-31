import { ContinuedTasks } from '../ContinuedTasks';
import { getSubmitErrorCode } from '../errors/getSubmitErrorCode';

/**
 * The web / non-native build. Metro resolves `ContinuedTasks.native.ts` ahead
 * of this on iOS and Android, so what is under test here is the fallback an
 * app gets on web and in plain Jest.
 */
describe('ContinuedTasks on an unsupported platform', () => {
  it('reports every capability as unavailable', () => {
    expect(ContinuedTasks.isSupported).toBe(false);
    expect(ContinuedTasks.supportsGPU).toBe(false);
    expect(ContinuedTasks.supportsReattach).toBe(false);
  });

  it('rejects submit with a parseable unsupported-platform code', async () => {
    const error = await ContinuedTasks.submit({
      identifierPrefix: 'com.foo.MyApp.export',
      title: 'Exporting',
      subtitle: '0 of 10',
      totalUnitCount: 10,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(getSubmitErrorCode(error)).toBe('unsupported-platform');
  });

  it('never silently succeeds — submit does not resolve', async () => {
    await expect(
      ContinuedTasks.submit({
        identifierPrefix: 'com.foo.MyApp.export',
        title: 'Exporting',
        subtitle: '0 of 10',
        totalUnitCount: 10,
      })
    ).rejects.toThrow();
  });

  it('has no tasks to reconcile', async () => {
    await expect(ContinuedTasks.getKnownTasks()).resolves.toEqual([]);
  });

  it('cannot re-attach to anything', async () => {
    await expect(
      ContinuedTasks.attachToTask('any-id')
    ).resolves.toBeUndefined();
  });

  it('accepts forgetTasks so reconciliation code stays platform-agnostic', async () => {
    await expect(
      ContinuedTasks.forgetTasks(['a', 'b'])
    ).resolves.toBeUndefined();
  });
});
