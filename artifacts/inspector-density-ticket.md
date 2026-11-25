User result: A control-dense Inspector stays compact and lets the user filter its current scene or component controls immediately.

Why now: The user found the accepted connected group surfaces too tall when many controls are present.

Acceptance:
- Tighten group, header, control, row, and slider vertical spacing while retaining 13px headings, connected outlines, contrast, numeric legibility, and pointer access.
- Add a compact full-width Filter controls field. Match control label, id, and group case-insensitively. A matching group shows all of its controls. Hide empty groups and show a compact no-match message.
- Clearing restores the groups and values. Filtering must not mutate controls or retained group expansion. Reset the filter for a new selected scene or component.
- Verify actual isolated Studio at a 260px Inspector with many controls, including filtered and cleared views.

Excluded: broader Inspector redesign, Graph work, and changes to the active user Studio session.
