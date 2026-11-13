# Scene interior graph implementation plan

> Execute inline with superpowers:executing-plans; request one independent final review.

**Goal:** Open Graph inside Scene and show only real visual/component nodes.
**Architecture:** Scene is the enclosing workspace. One breadcrumb trail shows the current location as plain text and clickable ancestors; no separate Scene settings or Back button. Remove its synthetic canvas card and the reserved layout column. Keep existing runtime paths and source representations.
**Tech Stack:** React, TypeScript, existing Studio CPU and Electron QA.
**Spec:** User-approved Scene-container proposal in this chat, with Scene interior as default.

## Constraints and review focus
Preserve source files, runtime identity, controls, output wires, nested Enter/Back navigation, and active creative sessions. Test node/background controls access, default direct/composition content, nested navigation, Fit and narrow layout.

## Task
- [x] Update existing Graph tests for interior-only nodes and header Scene access; observe the expected failure.
- [x] Remove synthetic Scene card and offset its nodes/wires/Fit bounds; update related integration checks and shipped skill documentation.
- [x] Run focused CPU and type checks, capture actual isolated application views at wide/narrow sizes, and independently review code and screenshots.
- [x] Install/check the updated shipped skill; submit exact evidence and delivery limits.

User refinement: preserve downward navigation with View inside, Enter and double-click; ancestor breadcrumbs provide upward navigation and select the ancestor controls.

Final refinements: horizontally scrollable ancestor trail; Alt+Up goes up one level within focused Graph and is listed in shortcut help. Preserve focus on the Graph canvas.

