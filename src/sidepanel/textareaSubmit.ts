import { useCallback, useRef } from 'react';
import type React from 'react';
import type { FormInstance } from 'antd/es/form';

export function useTextareaSubmit() {
  const composingRef = useRef(false);

  const onCompositionStart = useCallback(() => { composingRef.current = true; }, []);
  const onCompositionEnd = useCallback(() => { composingRef.current = false; }, []);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>, form: FormInstance) => {
    if (composingRef.current || event.nativeEvent.isComposing || (event.nativeEvent as KeyboardEvent).keyCode === 229) {
      return;
    }

    // Ctrl/Cmd + Enter: allow default newline
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      return;
    }

    // Plain Enter: submit
    if (event.key === 'Enter') {
      event.preventDefault();
      form.submit();
    }
  }, []);

  return { onCompositionStart, onCompositionEnd, onKeyDown };
}
