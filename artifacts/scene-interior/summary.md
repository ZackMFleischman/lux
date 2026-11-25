LUX-222 implementation and review complete.
Graph opens inside Scene; no Scene card or duplicate Scene settings/Back buttons. Current breadcrumb is text; ancestors navigate upward. View inside, Enter and double-click navigate down. Alt+Up navigates one level upward while Graph is focused. Entry and ancestor navigation retain canvas focus; the trail scrolls at narrow sizes.
Validation: Studio TypeScript passed; full dock suite 12/12 passed before shortcut addition; final focused graph suite 4/4 and shortcut map 2/2 passed; final isolated native UI run succeeded including ancestor Enter then Alt+Up, root no-op, two nested levels and narrow view.
Independent review: GPT-6.1 Terra medium, bounded UI/code review. Findings on overflow and focus were fixed; no actionable findings remain.
Delivery: repository source changed; installed creative session preserved and not restarted. Showing the change in that installed session requires a later installed-app update/restart.
