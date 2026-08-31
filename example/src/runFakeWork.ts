import type { ContinuedTask } from 'react-native-continued-task';

/**
 * Stands in for real long-running work: a fixed number of steps, each taking
 * about a second, reporting progress as it goes.
 *
 * Reporting is the point. iOS expires continued processing tasks that look
 * stalled, so a QA run that never called `setProgress` would be testing the
 * wrong thing.
 */
export async function runFakeWork(
  task: ContinuedTask,
  steps: number,
  label: string,
  onStep: (step: number) => void
): Promise<void> {
  for (let step = 1; step <= steps; step += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (task.state !== 'running' && task.state !== 'pending') {
      return;
    }
    task.setProgress(step, steps);
    task.updateTitle(label, `${step} of ${steps}`);
    onStep(step);
  }
}
