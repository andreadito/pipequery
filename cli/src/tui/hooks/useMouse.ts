import { useEffect, useRef } from 'react';

interface MouseEvent {
  x: number;
  y: number;
  button: 'left' | 'right' | 'middle' | 'scroll-up' | 'scroll-down';
  type: 'press' | 'release' | 'move';
}

type MouseHandler = (event: MouseEvent) => void;

// Regex to detect SGR mouse sequences
const SGR_MOUSE_RE = /\x1B\[<(\d+);(\d+);(\d+)([Mm])/g;

/**
 * Enable mouse click tracking in the terminal.
 * Only captures button press/release — does NOT capture mouse movement
 * to avoid interfering with normal terminal scrolling.
 */
export function useMouse(handler: MouseHandler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    // Enable button event tracking only (not movement)
    // 1000 = basic click tracking, 1006 = SGR extended coordinates
    process.stdout.write('\x1B[?1000h');
    process.stdout.write('\x1B[?1006h');

    // Use a keypress listener instead of raw data to avoid blocking Ink
    const onKeypress = (_ch: string | undefined, key: any) => {
      // Ink passes raw sequences through; we need to check raw stdin
    };

    // Intercept raw data, parse mouse events, and re-emit non-mouse data
    const originalEmit = process.stdin.emit.bind(process.stdin);
    const wrappedEmit = function (event: string, ...args: any[]): boolean {
      if (event === 'data' && args[0]) {
        const buf = args[0] as Buffer;
        const str = buf.toString();

        // Check if this data contains mouse sequences
        if (str.includes('\x1B[<')) {
          let match: RegExpExecArray | null;
          SGR_MOUSE_RE.lastIndex = 0;

          while ((match = SGR_MOUSE_RE.exec(str)) !== null) {
            const buttonCode = parseInt(match[1], 10);
            const x = parseInt(match[2], 10);
            const y = parseInt(match[3], 10);
            const isRelease = match[4] === 'm';

            let button: MouseEvent['button'] = 'left';
            if ((buttonCode & 3) === 1) button = 'middle';
            else if ((buttonCode & 3) === 2) button = 'right';
            else if (buttonCode & 64) button = buttonCode & 1 ? 'scroll-down' : 'scroll-up';

            const type: MouseEvent['type'] = isRelease
              ? 'release'
              : (buttonCode & 32) ? 'move' : 'press';

            handlerRef.current({ x, y, button, type });
          }

          // Strip mouse sequences and pass remaining data through
          const remaining = str.replace(SGR_MOUSE_RE, '');
          if (remaining.length > 0) {
            return originalEmit(event, Buffer.from(remaining));
          }
          // Consumed entirely by mouse — still return true
          return true;
        }
      }

      return originalEmit(event, ...args);
    } as typeof process.stdin.emit;

    process.stdin.emit = wrappedEmit;

    return () => {
      process.stdin.emit = originalEmit;
      process.stdout.write('\x1B[?1006l');
      process.stdout.write('\x1B[?1000l');
    };
  }, []);
}
