# Saved visual playback in Resolume

Verification is in progress: compiled visuals currently render inside the
worker but fail to reach the compositor correctly. The commands below are the
implemented entry points, not a claim that host playback has passed.

## Prepare and play

Save the visual as a `.lux-scene` file in Studio. From this checkout:

```powershell
pnpm transport:prepare "C:\path\visual.lux-scene"
```

Preparation validates the scene, runs the existing compiler and linker, and
writes a content-addressed release under `artifacts/transport`. It never starts
a graphics process. Resolution is 1920×1080 at 60 requested frames per second;
the saved seed is retained.

With the matching `native/build/Release/LuxTracerTR02.dll` installed, open one
Resolume Avenue or Arena process and trigger one **Lux TR02 Probe** source.
The launcher checks the loaded DLL against this checkout's build. Set the
source's Intensity before starting playback:

```powershell
pnpm transport:play "C:\path\visual.lux-scene"
```

The command also accepts a prepared release JSON path. The render worker waits
for the native host snapshot before creating the visual; the saved scene's
Intensity does not override Resolume's control. Subsequent host values update
the running visual. Authoring edits require saving and restarting playback.

Press Ctrl+C to stop. The supervisor also stops the producer when Resolume or
the launching process exits. It owns only its producer process tree and never
terminates the user's Resolume process. Session records are written beneath
`artifacts/transport/sessions/<id>`.

## Current limits

Use one source instance and one producer. Routing multiple clips is separate
work. The launcher currently requires other Lux GPU sessions, including Studio,
to be closed during playback and hardware diagnostics. CPU preparation, builds,
and CPU regression tests can run while Studio is open.

This feature does not establish sustained 1080p60 performance, numeric
color/alpha correctness, device-loss recovery, or compositor frame provenance.
The initial worker acknowledgement identifies the visual's first render and
control value; it does not by itself identify the exported compositor texture.
