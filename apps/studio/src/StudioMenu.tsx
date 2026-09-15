import { createContext, useContext, useId, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Button, ClickAwayListener, MenuList, Paper, Popper } from '@mui/material';

const MenuContext = createContext<ReturnType<typeof useMenuState> | null>(null);
function useMenuState() { return useState<string | null>(null); }

/** One open application menu, including menus rendered through dock portals. */
export function StudioMenuProvider({ children }: { children: ReactNode }) {
  const state = useMenuState();
  return <MenuContext.Provider value={state}>{children}</MenuContext.Provider>;
}

export function StudioMenu({ label, children, buttonRef, className = '' }: {
  label: string; children: ReactNode; buttonRef?: RefObject<HTMLButtonElement | null>; className?: string;
}) {
  const local = useMenuState();
  const [active, setActive] = useContext(MenuContext) ?? local;
  const ownRef = useRef<HTMLButtonElement>(null);
  const trigger = buttonRef ?? ownRef;
  const id = useId();
  const open = active === id;
  function close(restoreFocus = false) {
    setActive(current => current === id ? null : current);
    if (restoreFocus) trigger.current?.focus();
  }
  function adjacent(direction: number) {
    const buttons = [...(trigger.current?.closest('header')?.querySelectorAll<HTMLButtonElement>('[data-studio-menu]') ?? [])];
    const next = buttons[(buttons.indexOf(trigger.current!) + direction + buttons.length) % buttons.length];
    if (next && next !== trigger.current) { next.focus(); next.click(); }
  }
  return <ClickAwayListener onClickAway={() => close()}><div className={`studio-menu ${className}`}>
    <Button ref={trigger} data-studio-menu aria-haspopup="menu" aria-expanded={open}
      aria-controls={open ? id : undefined} className="studio-menu-trigger" color="inherit"
      onClick={() => setActive(current => current === id ? null : id)}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(id); }
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); adjacent(event.key === 'ArrowRight' ? 1 : -1); }
      }}>{label}</Button>
    <Popper open={open} anchorEl={trigger.current} placement="bottom-start" sx={{ zIndex: 1300 }}>
      <Paper className="studio-menu-paper">
        <MenuList id={id} aria-label={label} autoFocus autoFocusItem dense
          onClick={event => { if ((event.target as Element).closest('[role="menuitem"]:not([aria-disabled="true"])')) close(); }}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
            if (event.key === 'Tab') { event.preventDefault(); close(true); }
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); adjacent(event.key === 'ArrowRight' ? 1 : -1); }
          }}>{children}</MenuList>
      </Paper>
    </Popper>
  </div></ClickAwayListener>;
}
