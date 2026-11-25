User result: Lux uses bundled Inter for the normal application UI without a network or operating-system font dependency. Labels, menus, body text, and numbers use weight 400. Section headings use weight 500. Numeric controls and FPS use tabular figures. Code stays monospace. Existing font sizes and dense spacing stay unchanged.

Why now: Lux already names Inter but ships no Inter asset. The UI therefore changes by host and can render heavier than intended.

Acceptance:
- Bundle an official Inter font and its license in the Studio source snapshot and renderer output.
- Load the font through a local `@font-face` under the renderer CSP.
- Apply weight 400 to normal UI text and weight 500 to semantic section headings, including MUI portal content.
- Preserve monospace code surfaces and existing font sizes and spacing.
- Apply tabular figures to numeric controls, measurements, and FPS.
- Pass the Studio build and TypeScript checks.
- In an isolated native Studio profile, prove `document.fonts` loaded Inter and record its local resource request. Capture a dense panel and menu for UI review.

Excluded: brand icon typography, CodeMirror token emphasis, layout changes, user profile changes, user scene writes, installer changes, and unreserved GPU or Electron launches.
