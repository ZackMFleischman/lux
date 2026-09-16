import test from 'node:test';
import assert from 'node:assert/strict';
import { shortcutCommand, shortcutHint } from '../../apps/studio/src/studio-shortcuts.ts';

type Key = Parameters<typeof shortcutCommand>[0];
const key = (value: Partial<Key>): Key => ({ key: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...value });

test('Studio shortcut map uses the approved Windows bindings and accepts Command equivalents', () => {
  const expected = [
    [{ key: 'm', ctrlKey: true, shiftKey: true }, 'maximize-panel'],
    [{ key: 'F11' }, 'fullscreen'],
    [{ key: 'I', metaKey: true, shiftKey: true }, 'toggle-inspector'],
    [{ key: 'p', ctrlKey: true, shiftKey: true }, 'save-frame'],
    [{ key: 'r', ctrlKey: true, shiftKey: true }, 'toggle-recording'],
    [{ key: 's', ctrlKey: true }, 'save'],
    [{ key: 'S', metaKey: true, shiftKey: true }, 'save-as'],
    [{ key: 'e', ctrlKey: true, shiftKey: true }, 'export'],
    [{ key: 'Enter', ctrlKey: true }, 'build'],
    [{ key: '?', shiftKey: true }, 'shortcut-reference'],
    [{ key: '/', shiftKey: true }, 'shortcut-reference'],
  ] as const;
  for (const [event, command] of expected) assert.equal(shortcutCommand(key(event)), command);
  assert.equal(shortcutCommand(key({ key: 's', ctrlKey: true, altKey: true })), null);
  assert.equal(shortcutCommand(key({ key: 'Enter', ctrlKey: true, shiftKey: true })), null);
  assert.equal(shortcutCommand(key({ key: 'F11', ctrlKey: true })), null);
});

test('shortcut hints expose the exact commands shown by menus and buttons', () => {
  assert.deepEqual(shortcutHint, {
    'maximize-panel': 'Ctrl+Shift+M', fullscreen: 'F11', 'toggle-inspector': 'Ctrl+Shift+I',
    'save-frame': 'Ctrl+Shift+P', 'toggle-recording': 'Ctrl+Shift+R', save: 'Ctrl+S',
    'save-as': 'Ctrl+Shift+S', export: 'Ctrl+Shift+E', build: 'Ctrl+Enter',
    'shortcut-reference': '?',
  });
});
