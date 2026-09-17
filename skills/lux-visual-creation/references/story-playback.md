# Story playback

Use the adapter and running Studio from the same build. Check
`discover.runningStudio.capabilities.story`: version 1, rootSdkVersion `0.2.0`,
sustained, timedDirectSeek and commandReceipts must be supported. SDK 0.4
composition Story, stateful seeking, visual loading schedules and Story export
are unavailable in this slice.

## Read and operate

`lux.story.read({view:'definition'})` returns accepted beat and occurrence IDs.
Use `view:'capabilities'` for source-declared behavior and `view:'status'` for
current transport and guards. Selection in the native Story panel does not launch.
Each read returns top-level `instanceId`, `generation`, `revisionId`, `storyHash`
and `storyRevision`, plus `status`, `definition` or `capabilities` for its view.
Map generation/revisionId/storyHash/storyRevision to the corresponding
`expected…` transport fields.

Every `lux.story.transport` request includes `instanceId`, `expectedGeneration`,
`expectedRevisionId`, `expectedStoryHash`, `expectedStoryRevision`, and a fresh
`commandId`. Take identities from current status. Use the same complete payload
and command ID only to retry an uncertain result. A completed-frame receipt proves
the pose was drawn. After a successful mutation, use its acknowledged revision
for the next mutation; refresh if an automatic transition has advanced it. Never
retarget an old seek at a newly active beat after a stale-identity error.
Treat `expectedStoryHash` as an opaque accepted identity supplied by status;
do not derive it from source text. Transport returns `{receipt,currentStatus}`.
The receipt includes `commandId`, `action`, `storyRevision`, `frameId`,
`timeSeconds` and the exact drawn `story` frame; currentStatus is separate.

| Intent | Action data |
| --- | --- |
| Stay on orbit indefinitely | `{action:'launch', beatId:'orbit'}` |
| Start scheduled playback | `{action:'start'}` or provide `occurrenceId` |
| Resume the second orbit occurrence | `{action:'resume', occurrenceId:'orbit-2'}` |
| Suspend only scheduled advance | `{action:'set-auto-advance', enabled:false}` |
| Freeze phase and dwell; keep ambient live | `{action:'pause'}` |
| Resume retained phase/dwell intent | `{action:'play'}` |
| Go to the next attached occurrence | `{action:'advance'}` |
| Seek active timed arrival to 3 seconds | `{action:'seek', localTimeSeconds:3}` |
| Restart timed arrival once | `{action:'replay', beatId:'arrival'}` |
| Explicitly repeat timed arrival | `{action:'loop', beatId:'arrival'}` |
| Return to the normal visual | `{action:'return-normal'}` |

Launching the already active beat preserves its pose and activation. Resume
requires an explicit occurrence; repeated references to a beat are ambiguous.
Resume gives a fresh dwell and preserves pose when adopting the same active beat.
Auto-advance off/on retains remaining dwell. A manual-follow occurrence waits for
a cue. The final sustained beat stays live after the sequence ends.

Sustained beats have elapsed time but no local duration, progress, scrub, replay
or loop. Timed phase and occurrence dwell are independent: either may finish
first. Seeking pauses Story at the acknowledged pose and preserves dwell.
Preview pause freezes all clocks; a Story command draws one zero-delta frame and
leaves Preview paused. Return to normal is not Preview reset.
Seek must be within zero through the active beat's duration, inclusive; invalid
positions reject rather than clamp. Return to normal clears sequence association,
loop and follow intent. A later resume explicitly chooses an occurrence and starts
a fresh dwell; no hidden previous cursor is restored.

## Author a Story

The SDK 0.2 `defineVisual` literal declares capabilities:
The complete [Story visual example](../assets/story.ts) demonstrates direct arrival
poses and a sustained orbit while ambient spin continues.

```ts
story: {
  version: 1,
  beats: {
    arrival: { kind: 'timed', seek: 'direct' },
    orbit: { kind: 'sustained', seek: 'none' },
  },
},
```

In update/render, `frame.story.state` is `normal` or `active`. Normal includes
`storyEpoch`. Active also includes `beatId`, `activationId`, `occurrenceId`,
`elapsedSeconds`, `localTimeSeconds`, and `progress`. The last two are null for
sustained beats. A timed/direct pose must evaluate independently of earlier Story
frames, using current controls/input. Ambient `frame.timeSeconds` continues.
Beat changes do not call global create/reset/dispose. Use activation identity for
entry state, and epoch to invalidate caches after a discontinuity.

Read the complete source with `lux.studio.read`, then submit its preserved files,
assets and library links through `lux.studio.build` with `expectedDraftVersion`.
The optional `story` field supplies a complete definition, for example:

```json
{
  "version": 1,
  "beats": [
    {"id":"arrival","label":"Arrival","timing":{"kind":"timed","durationSeconds":8}},
    {"id":"orbit","label":"Orbit","timing":{"kind":"sustained"}}
  ],
  "sequence": [
    {"id":"arrival-1","beatId":"arrival","follow":{"kind":"after","seconds":8}},
    {"id":"orbit-1","beatId":"orbit","follow":{"kind":"after","seconds":20}},
    {"id":"orbit-2","beatId":"orbit","follow":{"kind":"manual"}}
  ]
}
```

An empty sequence is valid. Every definition must match a compiled source
capability. Scene JSON cannot grant a behavior missing from source. Omit `story`
on build to preserve the current definition; pass null to remove it. Source and
definition promote together only after validation and a completed candidate
frame. A successful rebuild or recovery returns to Normal. Save persists
definitions and sequence, never active beat, cursor, dwell or command history.
