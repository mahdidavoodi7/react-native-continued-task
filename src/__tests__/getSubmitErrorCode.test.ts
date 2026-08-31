import { getSubmitErrorCode } from '../errors/getSubmitErrorCode';
import type { SubmitErrorCode } from '../types/SubmitErrorCode';

describe('getSubmitErrorCode', () => {
  const cases: [SubmitErrorCode, string][] = [
    ['not-permitted', 'continued-task/not-permitted: identifier missing'],
    [
      'too-many-pending-requests',
      'continued-task/too-many-pending-requests: back off',
    ],
    ['unavailable', 'continued-task/unavailable: simulator'],
    [
      'immediate-run-ineligible',
      'continued-task/immediate-run-ineligible: system busy',
    ],
    ['unsupported-platform', 'continued-task/unsupported-platform: iOS 25'],
    ['invalid-identifier', 'continued-task/invalid-identifier: empty'],
    ['invalid-options', 'continued-task/invalid-options: totalUnitCount'],
    [
      'foreground-service-unavailable',
      'continued-task/foreground-service-unavailable: denied',
    ],
  ];

  it.each(cases)('reads %s off a native error message', (code, message) => {
    expect(getSubmitErrorCode(new Error(message))).toBe(code);
  });

  it('keeps the four BGTaskScheduler codes distinct', () => {
    const schedulerCodes = cases
      .slice(0, 4)
      .map(([, message]) => getSubmitErrorCode(new Error(message)));
    expect(new Set(schedulerCodes).size).toBe(4);
  });

  it('falls back to unknown for an unprefixed error', () => {
    expect(getSubmitErrorCode(new Error('something else broke'))).toBe(
      'unknown'
    );
  });

  it('falls back to unknown for a code it does not know', () => {
    expect(
      getSubmitErrorCode(new Error('continued-task/teapot: brewing'))
    ).toBe('unknown');
  });

  it('finds the code when the platform wraps the message', () => {
    // Nitro on Android prefixes a thrown Kotlin exception with the method and
    // the exception class, so the marker is not at the front. Verified against
    // a real device run.
    const android = new Error(
      'ContinuedTaskManager.submit(...): com.margelo.nitro.continuedtask.SubmitException: ' +
        'continued-task/invalid-options: totalUnitCount must be greater than 0'
    );
    expect(getSubmitErrorCode(android)).toBe('invalid-options');
  });

  it('reads the code from an unwrapped Swift-style message', () => {
    expect(
      getSubmitErrorCode(new Error('continued-task/unavailable: simulator'))
    ).toBe('unavailable');
  });

  it.each([[undefined], [null], ['a string'], [{ message: 'not an Error' }]])(
    'returns unknown for the non-Error value %p',
    (value) => {
      expect(getSubmitErrorCode(value)).toBe('unknown');
    }
  );
});
