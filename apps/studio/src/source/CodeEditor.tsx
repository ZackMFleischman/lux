import { useLayoutEffect, useRef, useState } from 'react';
import { Alert, TextField } from '@mui/material';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, bracketMatching } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { javascript } from '@codemirror/lang-javascript';
import type { EditorStateCache } from './editor-state.ts';
export type CodeEditorProps = {
  documentKey: number; path: string; text: string; readOnly: boolean; cache: EditorStateCache;
  onChange(text: string): boolean | void; onCompositionChange?(composing: boolean): void;
  diagnosticTarget?: { path: string; offset: number; request: number } | null;
};
const access = new Compartment();
const behavior = new Compartment();
const readOnlyExtensions = (value: boolean) => [EditorState.readOnly.of(value), EditorView.editable.of(!value)];
const sourceColors = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: '#c792ea' },
  { tag: [tags.definition(tags.variableName), tags.function(tags.variableName), tags.propertyName], color: '#82aaff' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: '#80cbc4' },
  { tag: [tags.string, tags.regexp], color: '#c3e88d' },
  { tag: [tags.number, tags.bool, tags.atom], color: '#f7b779' },
  { tag: [tags.comment, tags.meta], color: '#a1adc3' },
  { tag: tags.invalid, color: '#ff8a98', textDecoration: 'underline' },
]);
const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: '#111217', color: '#e1e2ec', fontSize: '13px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'Consolas, monospace' },
  '.cm-content': { caretColor: '#b4a4e9' }, '.cm-cursor': { borderLeftColor: '#b4a4e9' },
  '.cm-gutters': { backgroundColor: '#191b23', color: '#959bb0', borderRight: '1px solid #30323d' },
  '.cm-activeLine': { backgroundColor: '#b4a4e90c' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#b4a4e940' },
  '&.cm-focused': { outline: '1px solid #b4a4e9' },
}, { dark: true });
export function CodeEditor(props: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null), view = useRef<EditorView | null>(null), latest = useRef(props);
  const createState = useRef<((text: string) => EditorState) | null>(null);
  const [failure, setFailure] = useState(''); latest.current = props;
  useLayoutEffect(() => {
    if (!host.current) return;
    let editor: EditorView | undefined;
    try {
      const nonce = document.querySelector<HTMLMetaElement>('meta[name="style-nonce"]')?.content;
      if (!nonce || !/^[A-Za-z0-9+/=]{24,64}$/.test(nonce)) throw Error('Studio style nonce unavailable');
      const retained = props.cache.get(props.path, props.text);
      const handlers = [EditorView.domEventHandlers({
        beforeinput: (event, target) => {
          // Chromium's native rich-text replacement copies token colors into
          // inline styles before CodeMirror reconciles the DOM, violating CSP.
          // Composition and other input stay on CodeMirror's native path.
          if (!event.cancelable || event.inputType !== 'insertText' || event.data === null ||
              event.isComposing || target.compositionStarted || target.state.selection.main.empty) return false;
          event.preventDefault();
          if (!target.state.readOnly && target.state.facet(EditorView.editable)) {
            target.dispatch(target.state.replaceSelection(event.data), { userEvent: 'input.type', scrollIntoView: true });
          }
          return true;
        },
        compositionstart: () => { latest.current.onCompositionChange?.(true); },
        compositionend: () => { latest.current.onCompositionChange?.(false); },
      }), EditorView.updateListener.of(update => {
        props.cache.set(props.documentKey, props.path, { state: update.state, scrollTop: update.view.scrollDOM.scrollTop, scrollLeft: update.view.scrollDOM.scrollLeft });
      })];
      createState.current = text => EditorState.create({ doc: text, extensions: [
        access.of(readOnlyExtensions(props.readOnly)), EditorView.cspNonce.of(nonce), theme,
        lineNumbers(), drawSelection(), highlightActiveLine(), history(), bracketMatching(),
        javascript({ typescript: true }), syntaxHighlighting(sourceColors), highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.contentAttributes.of({ 'aria-label': `TypeScript source ${props.path}`, 'aria-describedby': 'source-keyboard-help' }),
        behavior.of(handlers),
      ] });
      const state = retained?.state ?? createState.current(props.text);
      editor = new EditorView({ state, parent: host.current, dispatchTransactions: (transactions, target) => {
        // Admit every edit, including undo transactions that bypass state filters,
        // before mutating the visible document or its history.
        if (transactions.some(transaction => transaction.docChanged) &&
            latest.current.onChange(transactions.at(-1)!.newDoc.toString()) === false) return;
        target.update(transactions);
      } }); view.current = editor;
      editor.dispatch({ effects: [access.reconfigure(readOnlyExtensions(latest.current.readOnly)), behavior.reconfigure(handlers)] });
      if (retained) { editor.scrollDOM.scrollTop = retained.scrollTop; editor.scrollDOM.scrollLeft = retained.scrollLeft; }
      setFailure('');
    } catch (reason) { editor?.destroy(); view.current = null; setFailure(`Editor unavailable: ${String(reason)}. The plain text editor below preserves your source.`); }
    return () => {
      if (editor) { props.cache.set(props.documentKey, props.path, { state: editor.state, scrollTop: editor.scrollDOM.scrollTop, scrollLeft: editor.scrollDOM.scrollLeft }); editor.destroy(); }
      view.current = null; latest.current.onCompositionChange?.(false);
    };
  }, [props.documentKey, props.path, props.cache]);
  useLayoutEffect(() => {
    const editor = view.current; if (!editor) return;
    if (editor.state.doc.toString() !== props.text) {
      // An external edit gets a fresh history; local updates already have identical text.
      editor.setState(createState.current!(props.text));
    }
    if (editor.state.readOnly !== props.readOnly) editor.dispatch({ effects: access.reconfigure(readOnlyExtensions(props.readOnly)) });
  });
  useLayoutEffect(() => {
    const editor = view.current, target = props.diagnosticTarget;
    if (!editor || !target || target.path !== props.path) return;
    editor.dispatch({ selection: { anchor: Math.min(Math.max(target.offset, 0), editor.state.doc.length) }, scrollIntoView: true }); editor.focus();
  }, [props.diagnosticTarget, props.path]);
  return <><div ref={host} className="source-code-editor" />{failure && <><Alert severity="warning">{failure}</Alert>
    <TextField fullWidth multiline minRows={8} maxRows={16} disabled={props.readOnly} label={`TypeScript source ${props.path}`} value={props.text}
      onChange={event => props.onChange(event.target.value)} onCompositionStart={() => props.onCompositionChange?.(true)} onCompositionEnd={() => props.onCompositionChange?.(false)} />
  </>}</>;
}
