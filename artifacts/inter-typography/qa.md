Independent source and UI review must inspect commit `e445637c5a93eb1361038b0144d7809b28c79640` against the native result and screenshots.

Confirm the font is packaged from `apps/studio/src/fonts`, emitted under a custom dist root, and allowed only by `font-src 'self'`.

Confirm regular UI text is 400, semantic headings are 500, numeric UI uses tabular figures, and code remains monospace. Check that font sizes and dense spacing did not change.

No user Studio restart, user profile change, or user scene write occurred. No installer was changed.
