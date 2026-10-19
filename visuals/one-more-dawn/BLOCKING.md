# One More Dawn – clip lanes and hand-offs

The opening (0:00–1:12.5) is split into four clips. Each clip file in
`src/lib/clips/` owns its time window: camera, lighting cues and every
performer's pose. `defaultFrame` in `src/lib/show.ts` is the original
continuous staging that every clip starts from.

| Clip | Window (song s) | Content |
| --- | --- | --- |
| awakening | 0 – 19.3 | Pre-show pin spot, curtain, Aria wakes, doors open, obedient blinks |
| question | 19.3 – 40.3 | Aria steps down, the question, the dream star |
| teaching | 40.3 – 57.4 | Band enters, Barnaby walks on, children walk/dance/sing, king rises |
| chain | 57.4 – 72.5 | Globe into his hands, the chain, the soldiers, the bow |

## Rules for clip lanes

- Edit only your clip file (you may add private helpers inside it). Shared
  files (engine, cast, rig, set, toon, song, show.ts helpers) are owned by
  the integrator; request changes instead of editing them.
- Hand-offs: at your window's first and last 0.25 s, every performer's
  position, facing, visibility and held props must match `defaultFrame`
  (within ~5 cm / 3°), so neighbouring clips join without a pop. Camera
  cuts at a boundary are allowed; lighting may change only on a musical
  accent you can point to in the timing file.
- Song timing: use `INTRO_LINES`, `VERSE1_LINES`, `SOPRANO_WORDS`,
  `BARITONE_WORDS` and `levelAt` from `song.ts` (generated from
  `assets/audio/One More Dawn - Disney Tones.timing.json`). Never place
  lyrics on screen.
- Performers are original robots. Never make one resemble an existing
  Futurama (or other) character.
- Verify with `node visuals/one-more-dawn/tools/qa-capture.mjs <out> <times…>`
  from the checkout root (isolated test Studio; never the user's app).
