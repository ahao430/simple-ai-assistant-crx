import { useCallback, useRef } from 'react';
import type React from 'react';
import type { FormInstance } from 'antd/es/form';
import type { SubmitShortcut } from '../shared/appSettings';

export function useTextareaSubmit(submitShortcut: SubmitShortcut) {
  const composingRef = useRef(false);

  const onCompositionStart = useCallback(() => { composingRef.current = true; }, []);
  const onCompositionEnd = useCallback(() => { composingRef.current = false; }, []);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>, form: FormInstance) => {
    if (composingRef.current || event.nativeEvent.isComposing || (event.nativeEvent as KeyboardEvent).keyCode === 229) {
      return;
    }

    if (event.key !== 'Enter') return;

    const isModEnter = event.ctrlKey || event.metaKey;
    const shouldSubmit = submitShortcut === 'enter' ? !isModEnter : isModEnter;

    if (shouldSubmit) {
      event.preventDefault();
      form.submit();
      return;
    }

    if (isModEnter) {
      event.preventDefault();
      const textarea = event.currentTarget;
      textarea.setRangeText('\n', textarea.selectionStart, textarea.selectionEnd, 'end');
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertLineBreak', data: '\n' }));
    }
  }, [submitShortcut]);

  return { onCompositionStart, onCompositionEnd, onKeyDown };
}
