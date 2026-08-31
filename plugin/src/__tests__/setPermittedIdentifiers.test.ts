import type { InfoPlist } from '@expo/config-plugins/build/ios/IosConfig.types';
import {
  PERMITTED_IDENTIFIERS_KEY,
  GPU_ENTITLEMENT_KEY,
} from '../ContinuedTaskPluginOptions';
import { setGpuEntitlement } from '../setGpuEntitlement';
import { setPermittedIdentifiers } from '../setPermittedIdentifiers';

describe('setPermittedIdentifiers', () => {
  it('expands each prefix to its wildcard form', () => {
    const result = setPermittedIdentifiers({} as InfoPlist, [
      'com.foo.MyApp.export',
    ]);
    expect(result[PERMITTED_IDENTIFIERS_KEY]).toEqual([
      'com.foo.MyApp.export.*',
    ]);
  });

  it('does not double up a prefix already written with .*', () => {
    const result = setPermittedIdentifiers({} as InfoPlist, [
      'com.foo.MyApp.export.*',
    ]);
    expect(result[PERMITTED_IDENTIFIERS_KEY]).toEqual([
      'com.foo.MyApp.export.*',
    ]);
  });

  it('preserves identifiers another plugin already added', () => {
    const existing = {
      [PERMITTED_IDENTIFIERS_KEY]: ['com.foo.MyApp.refresh'],
    } as unknown as InfoPlist;
    const result = setPermittedIdentifiers(existing, ['com.foo.MyApp.export']);
    expect(result[PERMITTED_IDENTIFIERS_KEY]).toEqual([
      'com.foo.MyApp.refresh',
      'com.foo.MyApp.export.*',
    ]);
  });

  it('is idempotent across repeated prebuilds', () => {
    const once = setPermittedIdentifiers({} as InfoPlist, [
      'com.foo.MyApp.export',
    ]);
    const twice = setPermittedIdentifiers(once, ['com.foo.MyApp.export']);
    expect(twice[PERMITTED_IDENTIFIERS_KEY]).toEqual([
      'com.foo.MyApp.export.*',
    ]);
  });

  it('writes no UIBackgroundModes value', () => {
    const result = setPermittedIdentifiers({} as InfoPlist, [
      'com.foo.MyApp.export',
    ]);
    expect(result.UIBackgroundModes).toBeUndefined();
  });

  it('leaves other Info.plist keys alone', () => {
    const existing = { CFBundleName: 'MyApp' } as unknown as InfoPlist;
    expect(
      setPermittedIdentifiers(existing, ['com.foo.MyApp.export'])
    ).toHaveProperty('CFBundleName', 'MyApp');
  });
});

describe('setGpuEntitlement', () => {
  it('writes the boolean true Xcode expects', () => {
    expect(setGpuEntitlement({}, true)).toEqual({
      [GPU_ENTITLEMENT_KEY]: true,
    });
  });

  it('removes the key rather than writing false', () => {
    const result = setGpuEntitlement({ [GPU_ENTITLEMENT_KEY]: true }, false);
    expect(result).not.toHaveProperty(GPU_ENTITLEMENT_KEY);
  });

  it('uses the exact entitlement key Xcode declares', () => {
    expect(GPU_ENTITLEMENT_KEY).toBe(
      'com.apple.developer.background-tasks.continued-processing.gpu'
    );
  });

  it('leaves unrelated entitlements alone', () => {
    const existing = { 'aps-environment': 'development' };
    expect(setGpuEntitlement(existing, true)).toHaveProperty(
      'aps-environment',
      'development'
    );
    expect(setGpuEntitlement(existing, false)).toEqual(existing);
  });
});
