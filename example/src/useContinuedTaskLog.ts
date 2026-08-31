import { useCallback, useState } from 'react';

export interface LogLine {
  id: number;
  at: string;
  text: string;
}

let nextLineId = 0;

/**
 * A running log the QA checklist reads from. Device QA is the only way to
 * verify most of this library, so the example keeps every event on screen
 * rather than in the console.
 */
export function useContinuedTaskLog() {
  const [lines, setLines] = useState<LogLine[]>([]);

  const log = useCallback((text: string) => {
    nextLineId += 1;
    setLines((current) =>
      [
        { id: nextLineId, at: new Date().toLocaleTimeString(), text },
        ...current,
      ].slice(0, 200)
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  return { lines, log, clear };
}
