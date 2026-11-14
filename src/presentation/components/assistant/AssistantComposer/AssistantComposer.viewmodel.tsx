import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface AssistantComposerCommand {
  name: string;
  description: string;
}

export interface AssistantComposerProps {
  busy: boolean;
  placeholder: string;
  sendLabel: string;
  stopLabel: string;
  commands: AssistantComposerCommand[];
  onSend: (text: string) => void;
  onStop: () => void;
}

export interface AssistantComposerViewModel {
  text: string;
  /** Callback ref: o elemento fica num ref interno, lido só em efeito e em handler. */
  attachTextarea: (element: HTMLTextAreaElement | null) => void;
  suggestions: AssistantComposerCommand[];
  canSend: boolean;
  change: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  keyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  submit: () => void;
  pick: (name: string) => void;
}

/** A altura máxima do campo, em pixels: daí em diante ele rola em vez de empurrar a conversa. */
const MAX_HEIGHT = 200;

export const useAssistantComposerViewModel = (props: AssistantComposerProps): AssistantComposerViewModel => {
  const { busy, commands, onSend } = props;
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const attachTextarea = useCallback((element: HTMLTextAreaElement | null) => {
    textareaRef.current = element;
  }, []);

  // O campo cresce com o texto até o teto — medir é ler o DOM, então acontece em efeito.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  // As sugestões aparecem enquanto o texto é só uma barra seguida do começo de um nome.
  const suggestions = useMemo(() => {
    const match = /^\/([a-z-]*)$/i.exec(text);
    if (!match) return [];
    const prefix = match[1].toLowerCase();
    return commands.filter((command) => command.name.startsWith(prefix));
  }, [text, commands]);

  const canSend = !busy && text.trim().length > 0;

  const submit = useCallback(() => {
    const value = text.trim();
    if (!value || busy) return;
    onSend(value);
    setText('');
  }, [text, busy, onSend]);

  const pick = useCallback((name: string) => {
    if (busy) return;
    onSend(`/${name}`);
    setText('');
    textareaRef.current?.focus();
  }, [busy, onSend]);

  const change = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => setText(event.target.value), []);

  const keyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (suggestions.length === 1 && text !== `/${suggestions[0].name}`) {
      pick(suggestions[0].name);
      return;
    }
    submit();
  }, [suggestions, text, pick, submit]);

  return { text, attachTextarea, suggestions, canSend, change, keyDown, submit, pick };
};
