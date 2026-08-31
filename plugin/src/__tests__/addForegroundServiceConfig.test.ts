import path from 'path';
import { AndroidConfig, XML } from '@expo/config-plugins';
import type { AndroidManifest } from '@expo/config-plugins/build/android/Manifest';
import { addForegroundServiceConfig } from '../addForegroundServiceConfig';
import { WORK_MANAGER_SERVICE } from '../ContinuedTaskPluginOptions';

const FIXTURE = path.join(__dirname, 'fixtures', 'AndroidManifest.xml');

async function readFixture(): Promise<AndroidManifest> {
  return AndroidConfig.Manifest.readAndroidManifestAsync(FIXTURE);
}

function permissionNames(manifest: AndroidManifest): string[] {
  return (manifest.manifest['uses-permission'] ?? []).map(
    (permission) => permission.$['android:name']
  );
}

function workManagerService(manifest: AndroidManifest) {
  const services = manifest.manifest.application?.[0]?.service ?? [];
  return services.find(
    (service) => service.$?.['android:name'] === WORK_MANAGER_SERVICE
  );
}

describe('addForegroundServiceConfig', () => {
  it('declares the SystemForegroundService entry with tools:node=merge', async () => {
    const result = addForegroundServiceConfig(await readFixture(), [
      'dataSync',
    ]);
    const service = workManagerService(result);

    // WorkManager declares this service but not a foregroundServiceType, and
    // Android will not start a typed foreground service without one. Merging
    // is what layers the attribute on instead of colliding.
    expect(service?.$['tools:node']).toBe('merge');
    expect(service?.$['android:foregroundServiceType']).toBe('dataSync');
  });

  it('declares the tools namespace the merge attribute needs', async () => {
    const result = addForegroundServiceConfig(await readFixture(), [
      'dataSync',
    ]);
    expect(result.manifest.$['xmlns:tools']).toBe(
      'http://schemas.android.com/tools'
    );
  });

  it('adds the base and per-type foreground service permissions', async () => {
    const result = addForegroundServiceConfig(await readFixture(), [
      'dataSync',
    ]);
    expect(permissionNames(result)).toEqual(
      expect.arrayContaining([
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
        'android.permission.POST_NOTIFICATIONS',
      ])
    );
  });

  it('maps every service type to its own runtime permission', async () => {
    const result = addForegroundServiceConfig(await readFixture(), [
      'mediaProcessing',
      'specialUse',
    ]);
    expect(permissionNames(result)).toEqual(
      expect.arrayContaining([
        'android.permission.FOREGROUND_SERVICE_MEDIA_PROCESSING',
        'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
      ])
    );
    expect(permissionNames(result)).not.toContain(
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC'
    );
  });

  it('joins multiple service types the way the manifest attribute expects', async () => {
    const result = addForegroundServiceConfig(await readFixture(), [
      'dataSync',
      'mediaProcessing',
    ]);
    expect(workManagerService(result)?.$['android:foregroundServiceType']).toBe(
      'dataSync|mediaProcessing'
    );
  });

  it('preserves permissions and components the app already declared', async () => {
    const result = addForegroundServiceConfig(await readFixture(), [
      'dataSync',
    ]);
    expect(permissionNames(result)).toContain('android.permission.INTERNET');
    expect(result.manifest.application?.[0]?.activity).toHaveLength(1);
  });

  it('is idempotent across repeated prebuilds', async () => {
    const once = addForegroundServiceConfig(await readFixture(), ['dataSync']);
    const twice = addForegroundServiceConfig(once, ['dataSync']);
    const services = (twice.manifest.application?.[0]?.service ?? []).filter(
      (service) => service.$?.['android:name'] === WORK_MANAGER_SERVICE
    );
    expect(services).toHaveLength(1);
    expect(
      permissionNames(twice).filter(
        (name) => name === 'android.permission.FOREGROUND_SERVICE'
      )
    ).toHaveLength(1);
  });

  it('replaces a stale service type rather than leaving both', async () => {
    const first = addForegroundServiceConfig(await readFixture(), ['dataSync']);
    const second = addForegroundServiceConfig(first, ['mediaProcessing']);
    expect(workManagerService(second)?.$['android:foregroundServiceType']).toBe(
      'mediaProcessing'
    );
  });

  it('serializes to XML carrying the merge attribute', async () => {
    const result = addForegroundServiceConfig(await readFixture(), [
      'dataSync',
    ]);
    const xml = XML.format(result);
    expect(xml).toContain('tools:node="merge"');
    expect(xml).toContain(WORK_MANAGER_SERVICE);
  });
});
