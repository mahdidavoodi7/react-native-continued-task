import { useCallback, useRef, useState } from 'react';
import {
  ContinuedTasks,
  getSubmitErrorCode,
  type ContinuedTask,
} from 'react-native-continued-task';
import { ensureNotificationPermission } from './ensureNotificationPermission';
import { EXPORT_PREFIX } from './runAutomaticChecks';

const TOTAL_CLIPS = 40;
const STEP_MS = 1200;

/**
 * The demo run used for the README preview recording.
 *
 * Deliberately slow and ordinary-looking: a long upload with a real title and
 * a subtitle that counts, so the system UI has something to show while the app
 * is backgrounded.
 */
export function usePreviewRun() {
  const [status, setStatus] = useState('idle');
  const [running, setRunning] = useState(false);
  const task = useRef<ContinuedTask | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const stop = useCallback(() => {
    if (timer.current !== undefined) {
      clearInterval(timer.current);
      timer.current = undefined;
    }
    try {
      task.current?.cancel();
    } catch {
      // already finished
    }
    task.current = undefined;
    setRunning(false);
    setStatus('cancelled');
  }, []);

  const start = useCallback(async () => {
    setStatus('submitting…');
    try {
      // Without this the work still runs on Android 13+, but its notification
      // is suppressed and the preview looks like nothing happened.
      if (!(await ensureNotificationPermission())) {
        setStatus(
          'notifications denied — the upload will run but stay invisible'
        );
      }
      const started = await ContinuedTasks.submit({
        identifierPrefix: EXPORT_PREFIX,
        title: 'Uploading new animations',
        subtitle: `0 of ${TOTAL_CLIPS} clips`,
        totalUnitCount: TOTAL_CLIPS,
        android: {
          notificationChannelName: 'Uploads',
          notificationIcon: 'ic_notification',
        },
      });
      task.current = started;
      setRunning(true);
      setStatus('running — background the app to see the system UI');

      started.addOnStopListener((event) => {
        if (timer.current !== undefined) {
          clearInterval(timer.current);
          timer.current = undefined;
        }
        task.current = undefined;
        setRunning(false);
        setStatus(`stopped: ${event.reason}`);
      });

      let clip = 0;
      timer.current = setInterval(() => {
        clip += 1;
        if (started.state !== 'running' && started.state !== 'pending') {
          return;
        }
        started.setProgress(clip, TOTAL_CLIPS);
        started.updateTitle(
          'Uploading new animations',
          `${clip} of ${TOTAL_CLIPS} clips`
        );
        setStatus(`uploading ${clip} of ${TOTAL_CLIPS}`);

        if (clip >= TOTAL_CLIPS) {
          if (timer.current !== undefined) {
            clearInterval(timer.current);
            timer.current = undefined;
          }
          started.complete(true);
          task.current = undefined;
          setRunning(false);
          setStatus('finished');
        }
      }, STEP_MS);
    } catch (error) {
      setRunning(false);
      setStatus(`rejected: ${getSubmitErrorCode(error)}`);
    }
  }, []);

  return { status, running, start, stop };
}
