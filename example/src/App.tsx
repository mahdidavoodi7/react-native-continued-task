import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ContinuedTasks,
  getSubmitErrorCode,
  type ContinuedTask,
} from 'react-native-continued-task';
import { runFakeWork } from './runFakeWork';
import { useContinuedTaskLog } from './useContinuedTaskLog';

const EXPORT_PREFIX = 'continuedtask.example.export';
const RENDER_PREFIX = 'continuedtask.example.render';

export default function App() {
  const { lines, log, clear } = useContinuedTaskLog();
  const [task, setTask] = useState<ContinuedTask | undefined>(undefined);

  // Step 4 of the checklist: work interrupted by process death shows up here
  // and nowhere else, because iOS reports it no other way.
  useEffect(() => {
    ContinuedTasks.getKnownTasks()
      .then(async (known) => {
        log(`reconcile: ${known.length} known task(s)`);
        const orphans = known.filter((t) => t.stopReason === 'app-terminated');
        for (const orphan of orphans) {
          log(
            `  orphan ${orphan.id.slice(-12)} at ${orphan.completedUnitCount}/${orphan.totalUnitCount}`
          );
        }
        if (orphans.length > 0) {
          await ContinuedTasks.forgetTasks(orphans.map((t) => t.id));
          log(`  forgot ${orphans.length} orphan(s)`);
        }
      })
      .catch((error: unknown) => log(`reconcile failed: ${String(error)}`));
  }, [log]);

  const start = useCallback(
    async (prefix: string, label: string, requiresGPU: boolean) => {
      try {
        const submitted = await ContinuedTasks.submit({
          identifierPrefix: prefix,
          title: label,
          subtitle: '0 of 20',
          totalUnitCount: 20,
          ios: { submissionStrategy: 'queue', requiresGPU },
          android: { notificationChannelName: 'Example tasks' },
        });
        setTask(submitted);
        log(`submitted ${submitted.id.slice(-12)} (${submitted.state})`);

        submitted.addOnStartListener(() => log('  -> running'));
        submitted.addOnStopListener((event) =>
          log(`  -> stopped: ${event.reason} [${event.native.name}]`)
        );

        await runFakeWork(submitted, 20, label, (step) => {
          if (step % 5 === 0) log(`  progress ${step}/20`);
        });
        if (submitted.state === 'running') {
          submitted.complete(true);
          log('  -> completed');
        }
      } catch (error) {
        log(`submit rejected: ${getSubmitErrorCode(error)}`);
        log(`  ${String(error)}`);
      }
    },
    [log]
  );

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Continued Task QA</Text>
      <Text style={styles.meta}>
        {Platform.OS} · supported {String(ContinuedTasks.isSupported)} · gpu{' '}
        {String(ContinuedTasks.supportsGPU)} · reattach{' '}
        {String(ContinuedTasks.supportsReattach)}
      </Text>

      <ScrollView contentContainerStyle={styles.buttons}>
        <Step
          n={1}
          title="Double submit"
          detail="Tap twice fast. Two tasks, no crash."
          onPress={() => {
            start(EXPORT_PREFIX, 'Export A', false);
            start(EXPORT_PREFIX, 'Export B', false);
          }}
        />
        <Step
          n={2}
          title="Submit without progress"
          detail="Background the app and wait. Expect reason 'expired'."
          onPress={async () => {
            try {
              const stalled = await ContinuedTasks.submit({
                identifierPrefix: EXPORT_PREFIX,
                title: 'Stalled export',
                subtitle: 'reports no progress',
                totalUnitCount: 100,
              });
              stalled.addOnStopListener((event) =>
                log(`stalled -> ${event.reason} [${event.native.name}]`)
              );
              log('stalled task submitted; background the app now');
            } catch (error) {
              log(`stalled submit rejected: ${getSubmitErrorCode(error)}`);
            }
          }}
        />
        <Step
          n={3}
          title="Run, then cancel from system UI"
          detail="Background, cancel in the Live Activity / notification. iOS reports 'expired'; Android 'user-cancelled'."
          onPress={() => start(EXPORT_PREFIX, 'Cancellable export', false)}
        />
        <Step
          n={4}
          title="Run, then swipe the app away"
          detail="Relaunch and read the reconcile lines above."
          onPress={() => start(EXPORT_PREFIX, 'Interruptible export', false)}
        />
        <Step
          n={5}
          title="GPU-gated work"
          detail={`supportsGPU is ${String(ContinuedTasks.supportsGPU)}.`}
          onPress={() => start(RENDER_PREFIX, 'GPU render', true)}
        />
        <Step
          n={6}
          title="Unpermitted identifier"
          detail="Expect 'not-permitted', not a crash."
          onPress={async () => {
            try {
              await ContinuedTasks.submit({
                identifierPrefix: 'continuedtask.example.notdeclared',
                title: 'Should fail',
                subtitle: '',
                totalUnitCount: 1,
              });
              log('UNEXPECTED: submit resolved');
            } catch (error) {
              log(`rejected with ${getSubmitErrorCode(error)}`);
            }
          }}
        />
        <Step
          n={7}
          title="Cancel from the app"
          detail="Expect reason 'app-cancelled'."
          onPress={() => {
            if (task === undefined) {
              log('no task to cancel');
              return;
            }
            task.cancel();
          }}
        />
      </ScrollView>

      <Pressable style={styles.clear} onPress={clear}>
        <Text style={styles.clearText}>Clear log</Text>
      </Pressable>
      <ScrollView style={styles.log}>
        {lines.map((line) => (
          <Text key={line.id} style={styles.logLine}>
            {line.at} {line.text}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

function Step({
  n,
  title,
  detail,
  onPress,
}: {
  n: number;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.step} onPress={onPress}>
      <Text style={styles.stepTitle}>
        {n}. {title}
      </Text>
      <Text style={styles.stepDetail}>{detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  heading: { fontSize: 22, fontWeight: '600' },
  meta: { fontSize: 12, color: '#666', marginBottom: 12 },
  buttons: { gap: 8, paddingBottom: 8 },
  step: { backgroundColor: '#f2f2f7', borderRadius: 10, padding: 12 },
  stepTitle: { fontSize: 15, fontWeight: '600' },
  stepDetail: { fontSize: 12, color: '#666', marginTop: 2 },
  clear: { paddingVertical: 8 },
  clearText: { fontSize: 12, color: '#007aff' },
  log: { flex: 1, backgroundColor: '#111', borderRadius: 10, padding: 10 },
  logLine: { color: '#0f0', fontFamily: 'Courier', fontSize: 11 },
});
