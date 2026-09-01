import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ContinuedTasks } from 'react-native-continued-task';
import { buildReport } from './buildReport';
import { CHECKS, type CheckDefinition, type CheckStatus } from './checks';
import { usePreviewRun } from './usePreviewRun';
import { useQaRun } from './useQaRun';

const STATUS_LABEL: Record<CheckStatus, string> = {
  pending: 'not run',
  armed: 'waiting',
  passed: 'passed',
  failed: 'FAILED',
  skipped: 'skipped',
};

const STATUS_COLOR: Record<CheckStatus, string> = {
  pending: '#8e8e93',
  armed: '#ff9500',
  passed: '#34c759',
  failed: '#ff3b30',
  skipped: '#8e8e93',
};

export function QaScreen() {
  const { state, busy, runAutomatic, arm, mark, reset } = useQaRun();
  const preview = usePreviewRun();

  const counts = CHECKS.reduce(
    (acc, check) => {
      const status = state.results[check.id]?.status ?? 'pending';
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Device QA</Text>
      <Text style={styles.meta}>
        {Platform.OS} {String(Platform.Version)} · supported{' '}
        {String(ContinuedTasks.isSupported)} · gpu{' '}
        {String(ContinuedTasks.supportsGPU)} · reattach{' '}
        {String(ContinuedTasks.supportsReattach)}
      </Text>

      {!ContinuedTasks.isSupported && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            isSupported is false. On iOS this means the OS is older than 26, or
            you are on the Simulator, which has no background task scheduler.
            Nothing below will pass.
          </Text>
        </View>
      )}

      <Text style={styles.summary}>
        {counts.passed ?? 0} passed · {counts.failed ?? 0} failed ·{' '}
        {counts.armed ?? 0} waiting · {counts.pending ?? 0} not run
      </Text>

      <View style={styles.toolbar}>
        <Pressable
          style={[styles.button, styles.primary]}
          onPress={() => {
            runAutomatic().catch(() => undefined);
          }}
        >
          <Text style={styles.primaryText}>
            {busy === undefined ? 'Run automatic checks' : `Running ${busy}…`}
          </Text>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={() => {
            Share.share({ message: buildReport(state) }).catch(() => undefined);
          }}
        >
          <Text style={styles.buttonText}>Share report</Text>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={() =>
            Alert.alert('Reset results?', 'Clears every recorded result.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: reset },
            ])
          }
        >
          <Text style={styles.buttonText}>Reset</Text>
        </Pressable>
      </View>

      {CHECKS.map((check, index) => (
        <CheckCard
          key={check.id}
          index={index + 1}
          check={check}
          status={state.results[check.id]?.status ?? 'pending'}
          detail={state.results[check.id]?.detail}
          onArm={() => {
            arm(check.id).catch(() => undefined);
          }}
          onMark={(status) =>
            mark(
              check.id,
              status,
              status === 'passed' ? 'confirmed by tester' : 'rejected by tester'
            )
          }
        />
      ))}

      <View style={styles.preview}>
        <Text style={styles.previewTitle}>Preview</Text>
        <Text style={styles.previewBody}>
          Starts a realistic upload — &ldquo;Uploading new animations&rdquo;, 40
          clips over about a minute. Tap start, then background the app and
          record the Live Activity or notification.
        </Text>
        <Text style={styles.previewStatus}>{preview.status}</Text>
        <Pressable
          style={[
            styles.button,
            preview.running ? styles.stop : styles.primary,
          ]}
          onPress={() => {
            if (preview.running) {
              preview.stop();
              return;
            }
            preview.start().catch(() => undefined);
          }}
        >
          <Text style={preview.running ? styles.stopText : styles.primaryText}>
            {preview.running ? 'Cancel preview' : 'Start preview'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function CheckCard({
  index,
  check,
  status,
  detail,
  onArm,
  onMark,
}: {
  index: number;
  check: CheckDefinition;
  status: CheckStatus;
  detail?: string;
  onArm: () => void;
  onMark: (status: 'passed' | 'failed') => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>
          {index}. {check.title}
        </Text>
        <Text style={[styles.badge, { color: STATUS_COLOR[status] }]}>
          {STATUS_LABEL[status]}
        </Text>
      </View>

      <Text style={styles.label}>Why</Text>
      <Text style={styles.body}>{check.why}</Text>
      <Text style={styles.label}>Do</Text>
      <Text style={styles.body}>{check.how}</Text>
      <Text style={styles.label}>Expect</Text>
      <Text style={styles.body}>{check.expect}</Text>

      {detail !== undefined && <Text style={styles.detail}>{detail}</Text>}

      {check.kind === 'survives-kill' && (
        <Pressable style={[styles.button, styles.cardButton]} onPress={onArm}>
          <Text style={styles.buttonText}>
            {status === 'armed' ? 'Re-arm' : 'Arm this check'}
          </Text>
        </Pressable>
      )}

      {check.kind === 'interactive' && (
        <View style={styles.markRow}>
          <Pressable
            style={[styles.button, styles.cardButton]}
            onPress={() => onMark('passed')}
          >
            <Text style={[styles.buttonText, { color: STATUS_COLOR.passed }]}>
              I saw it
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.cardButton]}
            onPress={() => onMark('failed')}
          >
            <Text style={[styles.buttonText, { color: STATUS_COLOR.failed }]}>
              It did not happen
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingTop: 64, gap: 10 },
  heading: { fontSize: 26, fontWeight: '700' },
  meta: { fontSize: 12, color: '#666' },
  summary: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  warning: { backgroundColor: '#fff3cd', borderRadius: 10, padding: 12 },
  warningText: { fontSize: 13, color: '#7a5b00' },
  toolbar: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  button: {
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f2f2f7',
  },
  buttonText: { fontSize: 13, fontWeight: '600', color: '#007aff' },
  primary: { backgroundColor: '#007aff' },
  primaryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  card: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f8f8fa',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e5',
    gap: 4,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  badge: { fontSize: 12, fontWeight: '700' },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8e8e93',
    marginTop: 6,
    letterSpacing: 0.6,
  },
  body: { fontSize: 13, lineHeight: 18, color: '#1c1c1e' },
  detail: {
    fontSize: 12,
    color: '#3a3a3c',
    backgroundColor: '#ececf0',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardButton: { alignSelf: 'flex-start', marginTop: 10 },
  preview: {
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
    marginBottom: 32,
    backgroundColor: '#000',
    gap: 6,
  },
  previewTitle: { fontSize: 17, fontWeight: '700', color: '#ffeb00' },
  previewBody: { fontSize: 13, lineHeight: 18, color: '#d8d8dc' },
  previewStatus: {
    fontSize: 12,
    color: '#8e8e93',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  stop: { backgroundColor: '#ff3b30' },
  stopText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  markRow: { flexDirection: 'row', gap: 8 },
});
