export const shortcutHint = Object.freeze({
  'maximize-panel': 'Ctrl+Shift+M',
  fullscreen: 'F11',
  'toggle-inspector': 'Ctrl+Shift+I',
  'save-frame': 'Ctrl+Shift+P',
  'toggle-recording': 'Ctrl+Shift+R',
  save: 'Ctrl+S',
  'save-as': 'Ctrl+Shift+S',
  export: 'Ctrl+Shift+E',
  build: 'Ctrl+Enter',
} as const);

export type StudioShortcutCommand = keyof typeof shortcutHint;
export type StudioShortcutAction = Readonly<{
  run(): void | Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}>;
export type StudioShortcutActions = Partial<Record<StudioShortcutCommand, StudioShortcutAction>>;

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

export function shortcutCommand(event: ShortcutEvent): StudioShortcutCommand | null {
  const key = event.key.toLowerCase();
  const primary = event.ctrlKey !== event.metaKey && (event.ctrlKey || event.metaKey);
  if (event.altKey) return null;
  if (event.key === 'F11' && !event.ctrlKey && !event.metaKey && !event.shiftKey) return 'fullscreen';
  if (!primary) return null;
  if (event.shiftKey) {
    if (key === 'm') return 'maximize-panel';
    if (key === 'i') return 'toggle-inspector';
    if (key === 'p') return 'save-frame';
    if (key === 'r') return 'toggle-recording';
    if (key === 's') return 'save-as';
    if (key === 'e') return 'export';
    return null;
  }
  if (key === 's') return 'save';
  if (event.key === 'Enter') return 'build';
  return null;
}

export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]');
}

export function blocksTextEntry(command: StudioShortcutCommand): boolean {
  return command === 'maximize-panel' || command === 'toggle-inspector' || command === 'fullscreen';
}
