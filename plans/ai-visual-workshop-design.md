# Lux

Design document • 11 September 2026 • Revised requirements; domain model under discussion

## 1. Overview

Lux is an app that helps an artist create animated visuals with AI.
The AI writes the code that produces the visual.
The artist describes changes, adjusts controls, and examines the result.

The artist will prepare a visual in this app before a show.
During the show, Resolume will display the visual.
The visual will continue to respond to parameter changes, audio, and MIDI in Resolume.
A recorded video does not meet this requirement.

The app will display one complete visual at a time by default.
That visual can contain particles, a background, a simulation, and several effects.
The artist can save many visuals and many variations of each visual.
Only the selected visual needs to run.

### 1.1 The five areas we will build

#### Create a visual with AI

The artist describes an idea to an AI assistant.
The AI creates or changes the visual through tools that the app provides.
The artist can use an external AI assistant first.
Later, the app will also contain a chat panel.

Both AI assistants will use the same tools through MCP, the Model Context Protocol.
This also lets a development agent operate and test the app.
The visual must continue to run without an AI connection.
The AI must also create and revise images and sprites during authoring.
Import generated files as durable assets, expose previews, and connect them to components.
External and embedded assistants use the same asset-import operation.
Save actual files and available provenance, not only prompts or temporary provider URLs.
Validate decoding, dimensions, alpha, and sprite layout before replacement.
Complete this workflow by Milestone 4; verify a generated sprite in an offline Resolume package in Milestone 5.
Image generation must not be a playback dependency.

#### Adjust the parts of a visual

The app will show useful parts, such as Particle field, Background, and Glow.
The artist can select a part, change its controls, or ask the AI to change it.
The app will also show how these parts connect.

For example, Glow can affect only the particles.
Color grade can affect the complete image.
The AI writes the code inside each part and defines the connections between parts.
The artist does not need to edit shader code or draw every connection.

#### Let the AI examine the result

The artist can select a part or mark a rectangle on the preview.
The AI can capture that output and examine it.
A capture can contain one image or several images at specified animation times.

The AI can also read measurements that a component provides.
For example, particle positions can help the AI determine whether particles move around an attractor.
The artist can let the AI examine the complete image but change only the particle component.

#### Keep the app responsive

One complex visual can use too much CPU or GPU time.
The app must measure visual performance and interface performance separately.
The artist and the AI must be able to identify slow work.

The app must also recover from incorrect generated code.
A visual failure must not destroy the saved project.
Performance measurements and recovery start in the first milestone.

#### Use the visual in Resolume

The artist chooses which controls Resolume will expose.
For example, Resolume can expose Speed, Density, Color, and Burst.
Audio or MIDI can change these controls during a show.

The proposed design uses a small Resolume plugin and a separate background renderer.
The renderer runs the same visual code as the app.
The studio and AI can close while the renderer continues to operate.
We must test this connection before we build the complete editor.

### 1.2 Example of the complete workflow

1. Ask the AI to create a particle visual.
2. Adjust the particle speed and color.
3. Add Glow to the particles.
4. Select Particle field.
5. Ask the AI to make the particles move around two attractors.
6. Let the AI capture three images and read particle measurements.
7. Compare the old result with the new result.
8. Save a variation.
9. Select the controls for Resolume.
10. Load the visual in Resolume and connect audio or MIDI to those controls.

### 1.3 What this app does not replace

Resolume remains responsible for show mixing, transitions, projector mapping, and output routing.
The studio does not need decks or a wall of continuously animated previews.

The first release does not include cloud rendering, shared accounts, a marketplace, or a complete node editor.
Recorded video export can follow later.
Image capture for AI inspection remains a required feature.

## 2. How to read this document

Each milestone adds features to the previous milestone.
Each milestone includes a user result, required work, and a completion test.
The initial tracer contains three submilestones.
First, an external AI creates, captures, and revises a visual in Lux and displays it in Resolume.
Next, the tracer tests independent instances, saved compositions, and reactive playback.
Each submilestone must work before the next submilestone starts.

Requirements describe the result we need.
Proposed technical choices describe one possible implementation.
A proposed choice is not proof that the implementation will work.
The numerical performance targets in Appendix B also require tests on actual hardware.

This document uses short sentences, active voice, and consistent technical terms from ASD-STE100.
Appendix D defines the main technical terms.
A complete dictionary compliance review is still outstanding.
See the [official ASD-STE100 guidance](https://www.asd-ste100.org/STE_faq.html).

## 3. Milestone sequence

| Milestone | User result | Main addition |
| --- | --- | --- |
| 0.1 — AI and Resolume loop | Create, capture, revise, and display in Resolume. | Connect MCP, the shared runtime, plugin, and actual GPU image transfer. |
| 0.2 — Host lifecycle | Use independent instances and reopen saved compositions. | Establish identity, control persistence, lifecycle, and reconnect. |
| 0.3 — Reactive playback | Control the visual with audio and MIDI in Resolume. | Test triggers, simulation state, delay, and recovery. |
| 1 — Safe AI edits | Save, undo, and restore AI changes across sessions. | Extend basic validation and recovery with durable projects and revision history. |
| 2 — Visual structure | Select and adjust the parts of a visual. | Add components, branches, effects, and the inspector. |
| 3 — AI inspection | Show the AI a selected region or a sequence of images. | Add capture controls and analytical views. |
| 4 — Creative controls | Refine and save visuals with chat, audio, MIDI, and combined controls. | Add the complete authoring interface. |
| 5 — Performance package | Install the visual and use it in Resolume without the studio. | Complete packaging, recovery, and performance tests. |

The tracer uses a small feature set.
Later milestones complete that feature set and add more complex visuals.
Performance work occurs in every milestone.

## 4. Milestone 0 — Initial tracer

The initial tracer starts with the AI creation loop inside Lux.
Actual Resolume playback is required in Submilestone 0.1. Prove the runtime GPU transfer path before expanding the SDK.
Submilestones 0.2 and 0.3 extend this connection with lifecycle and reactive playback.

### 4.1 Submilestone 0.1 — Create, capture, revise, and display in Resolume

#### User result

The user asks an external AI to create a visual.
The AI submits visual code through MCP, and Lux renders the result.
The AI captures the actual output and receives the image in its conversation.
The AI uses that image to revise the visual and captures the new result.

For example, the user asks for blue particles that move around a bright center.
The AI creates the visual and examines its capture.
If the center hides the particles, the AI reduces its brightness and captures the result again.

#### Required work

1. Create a Lux window with one preview.
2. Define a small visual code interface that an external AI can discover.
3. Expose code creation and replacement through MCP.
4. Compile the submitted code and render it in Lux.
5. Return build status and errors to the AI.
6. Expose full-output image capture through MCP.
7. Return images in a form that the external AI can actually view.
8. Attach the visual revision and animation time to each capture.
9. Let the AI submit a revision after it examines a capture.
10. Add play, pause, reset, and renderer restart controls.
11. Measure visual frame rate and interface frame rate separately.

The user must not need to copy generated code into Lux manually.
The capture must show the output of that submitted visual.
A text description of the output does not replace image feedback.
A local file path alone is insufficient unless the AI client can retrieve and view the image.

Support repeated still captures in this submilestone.
The AI can capture again after the animation advances.
Exact timed sequences, rectangular capture, and diagnostic views remain in Milestone 3.

Keep visual execution separate from interface execution.
Report build and runtime errors through MCP.
Keep the last working visual available after a failed code replacement.
Provide basic recovery now; durable history and complete recovery tests follow in Milestone 1.

The AI can start from a small SDK example.
However, it must create or change executable visual code in response to the user's request.
Selecting a fixed example or changing only its parameters does not complete this submilestone.

#### Completion test

1. Start Lux and connect an external AI client through MCP.
2. Ask the AI to create a visual from a text request.
3. Verify that Lux renders the submitted code without manual file transfer.
4. Ask the AI to capture the visual.
5. Verify that the AI receives and examines the actual image.
6. Ask the AI to identify and make one visible improvement from that image.
7. Verify that Lux renders the revised code.
8. Capture the revised output and compare it with the first image.
9. Verify that each capture identifies the correct revision.
10. Submit invalid code and verify an actionable error and access to the last working visual.

Completion requires a working create → render → capture → revise loop and actual dynamic Resolume playback.
Keep the prompt, code revisions, and captures as evidence of the test.
The test does not require an embedded chat panel or an installer.

#### Additional Submilestone 0.1 requirement — Actual Resolume connection

##### User result

The user sees the same visual in Lux and Resolume.
A named parameter in Resolume changes the visual.

##### Required work

1. Add a continuous parameter to the tracer visual.
2. Expose the parameter in Lux and through MCP.
3. Connect the same runtime to a small FFGL source plugin.
4. Expose the named parameter in Resolume.
5. Transfer completed images through a GPU texture connection.
6. Measure connection delay, CPU time, and available GPU time.
7. Define the startup image and the response to a late frame.

The normal performance path must not use CPU image capture for every frame.
The plugin must use a completed frame without an intentional wait for the renderer.
Inspection captures from Submilestone 0.1 remain separate from the performance image path.

##### Completion test

1. Load the visual in the selected Resolume version.
2. Change its named parameter through a native Resolume control.
3. Verify the visible response and record its delay.
4. Close the Lux interface and verify continued background playback.
5. Stop the renderer and verify that the plugin does not intentionally wait for it.
6. Restart the renderer and restore the current host value.

Use the actual host and GPU connection.
A placeholder connection does not complete this submilestone.

Verify orientation, color, and alpha with a known image pattern. Pass the applicable Appendix B gates before completing 0.1.

### 4.2 Submilestone 0.2 — Independent instances and saved compositions

#### User result

Load independent copies and reopen saved Resolume compositions with the intended visual versions and values.

#### Required work

1. Define durable visual identity and distinct runtime-instance identities.
2. Give each instance independent parameters, simulation state, and output resources.
3. Preserve visual version and host values through composition save and reopen.
4. Keep native control indices stable for compatible updates; reject silent incompatible replacement.
5. Test discovery, activation, reset, resize, deactivation, removal, and reconnect.
6. Resolve how the plugin identifies its packaged visual and control schema.

#### Completion test

1. Load two copies with different control values.
2. Change or reset one and verify the other is unaffected.
3. Save and reopen the composition; verify both versions and values.
4. Resize and deactivate one; verify resource release and continued playback of the other.
5. Restart the renderer and verify independent restoration of host values.
6. Verify control identity stability for a compatible update.
7. Pass Appendix B with one reference instance; record the two-instance isolation test separately.

Use the actual supported Resolume version and GPU connection.

### 4.3 Submilestone 0.3 — Test reactive playback and recovery

#### User result

The visual responds to audio, a MIDI control, and repeated MIDI triggers in Resolume.
The connection also works with a simulation that retains state between frames.

#### Required work

1. Add one trigger control to the tracer visual.
2. Connect audio modulation and MIDI to the native controls.
3. Preserve separate trigger events in their original order.
4. Test a small simulation through the same runtime and image connection.
5. Measure frame delivery, control delay, and plugin cost.
6. Test renderer failure and recovery during playback.

#### Completion test

1. Connect audio to the continuous parameter.
2. Connect a MIDI knob to a control and MIDI notes to the trigger.
3. Send repeated notes and verify separate visible responses.
4. Repeat the connection test with the stateful simulation.
5. Stop and restart the renderer during playback.
6. Verify current control values and the absence of obsolete trigger playback.
7. Record visual performance and interface performance separately and pass the simulation, control, event, and recovery gates in Appendix B.

If the connection fails, revise the runtime design before the broader editor work.
The alternative must preserve dynamic playback in Resolume.

### 4.4 Decisions during the initial tracer

Select the Lux operating system, GPU, and runtime versions before Submilestone 0.1.
Select the Resolume version and native connection before Submilestone 0.1.
Windows is the proposed first platform.
The user did not require Windows as the only platform.

## 5. Milestone 1 — Make AI changes safe and repeatable

### User result

The user can ask an external AI to change a visual.
The user can save the result, undo a change, and reopen the project.
A bad AI change does not remove the last working version.

### Required work

Extend the code submission and basic recovery from Submilestone 0.1.
Add durable project history without creating a second AI tool path.

- Store source code, assets, settings, and runtime versions in a project.
- Assign stable identifiers to visual parts and parameters.
- Save accepted revisions and restore an earlier revision.
- Validate code and connections before activation.
- Return build errors and runtime errors through MCP.
- Show which parts an AI change affects.
- Preserve compatible parameter values after a code change.
- Require each edit to identify its starting revision.
- Reject an edit if that revision is no longer current.
- Keep saved project data outside the renderer process.
- Expose job status, cancellation, and results through the application tools.

The interface and AI tools must use the same application operations.
Two AI clients must not silently overwrite each other's work.
Long jobs must not prevent basic inspection or cancellation.

Use an explicit clock and seed for repeatable tests.
Move compilation and expensive processing away from the interface thread.
Limit work queues and release resources after a replacement.

### Agreed authoring UX

AI changes appear automatically in the studio preview after compilation and basic validation.
Group each AI request into one undoable change and show a concise change summary.
Failed candidates leave the previous working result available. A first frame does not prove freedom from later runtime failure.
Offer restart or restoration after runtime failure and show any required simulation reset.
Preserve compatible parameter values. Autosave without requiring Keep/Discard for every request.
Exported Resolume packages remain unchanged until an explicit export and replacement.
Start with serial scene-changing jobs and revision conflicts; a collaborative approval system is not required.

### Completion test

1. Ask an external AI to change the example visual.
2. Save the accepted revision.
3. Submit code with a build error.
4. Verify that the app retains the accepted revision.
5. Submit code that stops responding during execution.
6. Restart the renderer without loss of the accepted project.
7. Undo a valid change.
8. Close and reopen the project without an AI connection or development server.
9. Submit two edits from the same revision.
10. Verify that the second edit reports a conflict after the first edit succeeds.

## 6. Milestone 2 — Show and control the parts

### User result

The user can understand the visual through named components.
The user can select a component, change its parameters, and control its effects.

### Required work

Add a composition graph to the project model.
A graph describes components and their connections.
It must support branches from its first implementation.
The first tracer can use only one component.

Each component must declare:

- Its stable identifier, type, version, and code reference.
- Its input and output types.
- Its parameters and defaults.
- Its supported enable, bypass, pause, and reset actions.
- Its normal output and available diagnostic outputs.

Add a structure view and a component inspector.
Use a simple stack for a linear effect sequence.
Show branches and groups in the structure view.
The AI can change connections through validated operations.
Manual editing of every connection can follow later.

Add controls to insert, remove, reorder, and bypass effects.
Add an effect amount control and reusable saved chains.
Let the user select which parameters appear on the main control panel.

### Rules for the visual structure

The AI must declare the structure directly.
The app must not depend on automatic graph extraction from arbitrary code.

A component can contain complex shader or simulation code.
A visible component does not require a separate GPU pass or worker.
Cameras and attractors can remain parts of a shared 3D scene.
This preserves shared lighting, depth, and simulation behavior.

Execute a shared dependency once when possible.
Do not execute unused branches.
Use explicit previous-frame resources for feedback.
Reject connections with incompatible types or missing inputs.

### Rules for bypass

An image effect can pass its input to its output without the effect.
A source can stop producing output.
A simulation needs defined pause, reset, and resume behavior.
Only show actions that the component supports.

Bypass must remove unnecessary work by default.
An optional mode can continue a simulation to preserve its history.
Show the cost of that mode.
An effect amount of zero does not prove that the effect uses no GPU time.

### Completion test

Create this composition:

| Component | Sends output to |
| --- | --- |
| Particle field | Glow and Composite |
| Glow | Composite |
| Background | Composite |
| Composite | Color grade |
| Color grade | Final output |

Select Particle field and change its speed.
Bypass Glow and verify that the particles remain visible.
Verify that Color grade still affects the complete image.
Measure the work that remains after bypass.
Save and reload the composition with its parameter values intact.

## 7. Milestone 3 — Give the AI useful evidence

### User result

The user can show the AI a component, image region, or period of motion.
The AI can compare images and available measurements before it changes the code.

### Required work

Extend the full-output capture from Submilestone 0.1.
Keep the same capture tools as the basis for these additional options.

- Select the final output, a component output, or a diagnostic output.
- Mark a rectangular region on the selected output.
- Set the output image size.
- Capture one image or a timed image sequence.
- Support live capture and controlled capture.
- Expose these operations through MCP.
- Provide a small set of reusable diagnostics for the initial visual types.
- Let the user specify inspection targets separately from edit targets.

A rectangle identifies an image region.
It does not automatically identify particles or other editable objects.
For the first release, combine a rectangle with a component selection when necessary.
Object tracking and persistent simulation masks can follow later.

### Capture request

| Setting | Meaning |
| --- | --- |
| Target | The complete output, a component output, or a supported diagnostic view. |
| Viewbox | The full target or a rectangle inside it. |
| Output size | The width and height of each captured image. |
| Aspect policy | Preserve the image shape with padding, crop to fill, or stretch. |
| Frame count | The number of images to return. |
| Interval | The animation time between requested images. |
| Start | The current state or a supported reset or saved state. |
| Mode | Live capture or controlled capture. |
| Render override | An optional change to the visual's render resolution or quality. |

Support normalized rectangle coordinates from 0 to 1.
These coordinates express position and size relative to the target image.
Validate the rectangle and requested image size.

Example: request three frames with a 500 ms interval.
Capture the frames at relative animation times 0 ms, 500 ms, and 1000 ms.
The sequence covers one second of animation.

`durationMs = (frameCount - 1) * intervalMs`

### Image size and render resolution

By default, capture the existing output, crop the selected region, and reduce the image size.
This reduces transfer size and AI image input.
It does not necessarily reduce the cost of the visual itself.

A render override changes how the visual produces its output.
That change can affect the image or simulation.
Record this setting separately from capture size.

### Live capture and controlled capture

Live capture takes available frames near the requested intervals.
The visual can continue to receive live audio and MIDI.
Return actual animation times and report late or repeated frames.

Controlled capture advances the animation to the requested times.
A simulation must run the necessary intermediate steps.
Do not replace 500 ms of simulation with one large update.
Use recorded or synthetic inputs when repeatable audio or MIDI behavior is necessary.

Controlled capture can take longer than the animation duration.
Report when a component cannot reproduce an exact starting state.
Do not interrupt a live Resolume instance to run this test.
Schedule studio work or use a separate controlled job.

### Capture result and job limits

Each result must include the images and the information necessary to interpret them:

- Project revision and runtime version.
- Target and resolved rectangle.
- Render size and capture size.
- Requested times and actual times.
- Parameter values, seed, quality, and input references.
- Capture mode and active diagnostics.
- Failure or partial-result information, if applicable.

Keep the selection fixed when the capture starts.
A later user selection must not change that job.
Return full-image context for a crop when requested.

Limit frame counts, dimensions, samples, queue sizes, and job duration.
Provide job status, cancellation, and result retrieval for external clients.
Do not capture every layer continuously.

### Completion test

1. Select Particle field and mark a rectangle.
2. Request three controlled frames at 500 ms intervals.
3. Set a smaller capture size without changing render resolution.
4. Change the selection while the job runs.
5. Verify the original target, rectangle, image size, and timestamps in the result.
6. Capture the final image and an isolated particle output.
7. Read a bounded sample of particle positions or trails.
8. Let the AI change only the particle simulation.
9. Compare the old and new results with the same seed and input sequence.
10. Repeat in live mode and verify the actual timestamps.

## 8. Milestone 4 — Complete the creative controls

### User result

The artist can refine a visual inside the app with chat, controls, audio, and MIDI.
The artist can save named variations and compare them.

### Required work

Add the embedded chat panel with the existing MCP capabilities.
Show selected components and captures as removable chat attachments.
The embedded assistant and external assistants must receive equivalent tool behavior.

Complete the preview controls for resolution, quality, target frame rate, seed, and frame-step.
Show renderer status, errors, and relevant performance measurements in the interface.

Add named variants that refer to a visual revision.
Store parameter values, seed, and modulation settings with each variant.
Compare variants one at a time or through saved images.
Do not run every variant for its thumbnail.

Add studio audio input and MIDI input selection.
Support continuous controls and separate trigger events.
Add recorded input sequences for tests.
Add tempo, phase, simple curves, and low-frequency oscillators for parameter changes over time.

Add macros that control several parameters.
For example, Energy can change speed, turbulence, and glow together.
Define each mapping range and smoothing behavior.
Let the artist select the controls that Resolume will expose.

### Control rules

Each parameter needs a stable identifier, type, default, range, label, and description.
Add units and groups where useful.
Proposed types include numbers, booleans, choices, colors, vectors, and triggers.
Test how Resolume represents each exported type.

Preserve compatible controls after AI revisions.
Report a change that requires a new parameter definition or mapping.
Identify controls that require compilation, allocation, or simulation reset.
Controls for live performance must remain inexpensive within their supported ranges.

Continuous values can replace older pending values.
Separate triggers must remain separate events in their original order.
Define queue limits, overflow reports, and reconnect behavior.
Do not replay obsolete triggers after a reconnect.

The studio controls live values during standalone editing.
Resolume controls the exported values during performance.
Define how base values, macros, and modulation combine.
Do not assume that all studio device mappings transfer automatically into Resolume.

### Completion test

Create an Energy macro and connect audio to it.
Connect a MIDI knob to Density and a MIDI note to Burst.
Send repeated notes and verify separate bursts.
Save two variants and compare them without two continuous previews.

Ask the embedded AI to change motion in a selected component.
Verify that compatible colors, variants, and mappings remain intact.
Run the same tool operation from an external AI client.
Verify equivalent results and conflict handling.

## 9. Milestone 5 — Deliver a reliable Resolume package

### User result

The artist installs a visual and uses it in Resolume.
The visual works after the studio and AI close.
Its controls, audio response, and MIDI response remain available.

### Required work

Package the accepted visual with its assets, presets, control definitions, and required runtime versions.
Provide installation and automatic management of the background renderer.
The user must not need manual development commands for normal playback.
Show connection status and provide recovery from a renderer failure.

Repeat the plugin lifecycle and independent-instance tests from Submilestone 0.2 against the installed package.
Test saved Resolume compositions and renderer reconnects.
Keep parameter identifiers and native control indices stable for compatible updates.
Define a new export version or migration for incompatible changes.

Each plugin instance must have separate parameters, simulation state, and output identity.
Two instances must not accidentally control the same mutable visual.
High-capacity playback of many visuals is not an initial performance promise.

Define the startup image and the response to late frames.
Use the last completed frame when a new frame is unavailable.
Restore current host values after recovery.
Verify texture orientation, color, alpha, synchronization, and resource ownership.

The initial plugin produces a source image.
Effects inside that visual remain supported.
A plugin that processes an incoming Resolume image needs a separate future milestone.

### Complete the performance tests

Test a procedural shader, a simulation, particles, a 3D scene, and an effect sequence.
Use the same seed, input sequence, dimensions, and quality for comparisons.
Record hardware, software versions, warmup, and measurement settings.

Measure CPU work, GPU work, delivered frames, and interface response separately.
Report shared GPU pass costs together.
Do not invent a separate cost for each visible component.
Label unavailable GPU timing and limited memory estimates.

Measure the full Resolume connection, including repeated frames and control response time.
Test parameter extremes and repeated code replacements.
Run a long session to find growing queues or unreleased resources.
Measure the additional cost of diagnostics.

### Completion test

1. Install a package on the supported system.
2. Close the studio and AI.
3. Load the visual in Resolume.
4. Adjust published parameters with audio and MIDI.
5. Save and reopen the Resolume composition.
6. Verify the intended visual version and control values.
7. Load two copies and verify independent state.
8. Resize and deactivate the source.
9. Restart the renderer and verify recovery.
10. Record results against the agreed performance targets.

Use actual GPU hardware and the actual supported Resolume version.
A headless test or source-code review cannot prove this milestone complete.

## Appendix A. Proposed system design

These choices require the Milestone 0 tests.

| Part | Proposed implementation | Responsibility |
| --- | --- | --- |
| Studio | Electron, React, and TypeScript | Show controls, structure, chat, and reports. |
| Application core | Shared application services | Store project state and validate operations. |
| AI connection | MCP server | Expose the same tools to internal and external assistants. |
| Visual SDK | Typed component definitions and graphics helpers | Define inputs, outputs, parameters, time, and diagnostics. |
| Renderer | Three.js, TSL, and WebGPU | Execute the visual and produce images. |
| Render host | Separate host with a worker and OffscreenCanvas | Separate visual execution from interface execution. |
| Supervisor | Desktop process | Start, stop, and recover renderers. |
| Resolume source | Small native FFGL plugin | Expose controls and display a completed texture. |
| Background renderer | Same visual runtime as the studio | Run the packaged visual during performance. |
| Texture connection | Candidate Spout or Syphon integration | Transfer GPU images to the plugin. |

Keep image transport separate from control and event transport.
Do not execute generated visual code with privileged desktop access or inside Resolume.
Do not send live preview pixels through React state.

Separate processes cannot guarantee protection from GPU or driver failures.
Test device loss and recovery.
Also test actual process separation with the selected Electron configuration.

If the texture connection fails, evaluate a shared native renderer.
That choice can require a different visual SDK.
Do not replace the dynamic playback requirement with recorded clips.

Use the [Loom repository](https://github.com/ZackMFleischman/loom) as a source of ideas and selected reusable code.
Record the inspected commit before implementation.
Do not require complete Loom compatibility or migrate its full feature set.

## Appendix B. Initial performance targets

These are proposed test targets, not measured results.
Milestone 0 must establish the test computer and a repeatable measurement procedure.

| Measurement | Initial target |
| --- | --- |
| Reference visual | 1920 × 1080 pixels at 60 frames per second. |
| GPU frame work | 95th percentile at or below 12 ms. |
| CPU update and submission | 95th percentile at or below 4 ms. |
| Interface response | 95th percentile at or below 50 ms; 99th percentile at or below 100 ms. |
| Added connection delay | 95th percentile at or below two Resolume frame periods. |
| Plugin CPU callback | 95th percentile at or below 1 ms, without intentional renderer waits. |
| Unresponsive JavaScript | Supervisor stops the visual within two seconds. |
| Long session | No continuing growth in tracked resources or queues during a 60-minute test after warmup. |
| Routine measurements | Less than 2% additional median frame cost. |

Measure actual delivered frames as well as CPU and GPU time.
An acceptable CPU result alone does not prove smooth playback.
Report GPU transfer work separately from plugin CPU time.

Complex visuals can use a lower preview resolution.
However, the selected performance settings must pass the dynamic playback tests.
Do not reduce quality silently during a comparison.

### Provisional tracer pass/fail gates

These are initial engineering budgets, not measured capabilities or promises for every visual.
Use a deterministic animated shader with a frame marker, alpha pattern, and an immediately visible control in 0.1.
Add a seeded fixed-step particle simulation with a documented bounded count and burst events in 0.3.
Record source, count, timestep, seed, quality, hardware, and software versions.

- Run at 1920 × 1080 with a 60 Hz host for five minutes after 30 seconds of warmup.
- At least 99% of host output opportunities consume a fresh source frame. Report repeated and skipped frames separately. No unexplained delivery gap may exceed 100 ms.
- Plugin receipt of a control update to host consumption of its corresponding source image: p95 at or below 50 ms and p99 at or below 100 ms, with intentional smoothing disabled.
- Measure physical MIDI input to visible response separately when external measurement is available. Plugin-local timing is not total device latency.
- For 20 trigger events per second over ten seconds, preserve all events delivered to the plugin in order. Use counters and frame markers; separately verify host delivery of repeated MIDI notes.
- After an explicit renderer restart, restore a completed reference frame and host values within five seconds. Keep the host responsive and discard obsolete triggers.
- Apply the CPU, GPU, interface, and callback budgets above. Report unavailable GPU timing as unavailable, not passing; frame-delivery tests remain mandatory.

Use frame IDs and monotonic timestamps at renderer completion and host consumption.
The measurement ends at host source consumption, not physical projector presentation.
Keep the 60-minute soak for release. The two-instance test establishes isolation, not unrestricted capacity.
A failed gate requires a recorded bottleneck and explicit revised budget or design decision before completion.
Do not silently lower quality or change the workload to obtain a pass.

## Appendix C. Decisions for the implementation plan

| Decision | When to resolve it |
| --- | --- |
| Lux operating system, GPU, and runtime | Before Submilestone 0.1. |
| Resolume version and native connection | Before Submilestone 0.1. |
| GPU texture transfer and synchronization | Prove in Submilestone 0.1. |
| Background renderer installation approach | Prove the process in Milestone 0; complete installation in Milestone 5. |
| MCP transport, local access, and viewable image results | During Submilestone 0.1. |
| Project schema and version migration | During Milestone 1. |
| Component types and first examples | During Milestones 1 and 2. |
| Simulation timestep, overload, and reset rules | Establish in Milestone 0; complete before controlled capture. |
| Capture limits and state restoration | During Milestone 3. |
| Model provider and credential interface | Before embedded chat in Milestone 4. |
| Modulation order and event overflow | Establish basic rules in Milestone 0; complete in Milestone 4. |
| Supported host audio and timing inputs | Test in Milestone 0; document before release. |
| Final numerical release targets | Revise with measured evidence before Milestone 5. |

Do not assume that FFGL supplies raw audio samples or every raw MIDI message.
Native parameter modulation and repeated trigger behavior remain required.
Test richer audio spectrum and beat inputs against the selected host.

Future milestones can add manual graph wiring, object tracking, persistent masks, more diagnostics, and additional platforms.
They can also add incoming-image effects and recorded video export.
Arbitrary simulations do not automatically produce seamless loops.
Identical output across different GPUs is not a release promise.

## Appendix D. Technical terms

| Term | Meaning in this document |
| --- | --- |
| Visual | One complete animated result, including all its components and effects. |
| Component | A named part that the artist can inspect or control. |
| Composition graph | The components and connections that produce a visual. |
| Parameter | A value that changes a visual, such as speed or color. |
| Published control | A parameter or macro selected for the main interface and Resolume. |
| Macro | One control that changes several parameters. |
| Variant | Saved values, seed, and modulation settings for a visual revision. |
| Revision | A saved version of the visual's code and structure. |
| Renderer | The software that executes a visual and produces images. |
| Runtime | The shared software that loads and executes visual components. |
| Seed | A value that sets the starting sequence for repeatable random behavior. |
| Viewbox | The rectangular part of an output selected for capture. |
| Diagnostic | An image or measurement that helps explain visual behavior or cost. |
| Tracer | A small working feature that passes through the main system parts. |
| MCP | Model Context Protocol; the interface through which AI clients call application tools. |
| FFGL | The native plugin interface proposed for the Resolume source. |
| GPU pass | One unit of GPU work; it can serve more than one visible component. |
| Trigger | A separate event, such as a request for one particle burst. |
| Modulation | A change to a parameter from audio, MIDI, or another signal. |

## Appendix E. Handoff to the coding agent

First produce an implementation plan from these milestones.
Do not start the complete implementation before the plan exists.

For each milestone, list the code changes, dependencies, tests, and evidence required for completion.
Use milestone numbers and subsection names as requirement references.
These references replace the previous category-based requirement identifiers.

Keep the tracer small but functional.
Complete both the external AI feedback loop and actual Resolume playback in Submilestone 0.1. Prove GPU transfer before expanding the SDK or editor.
Add features through the later milestones without removing the existing tests.
Keep performance measurements and recovery in the early work.

Inspect the selected Loom code and current SDK documentation before reuse.
Record assumptions and prototype results.
Resolve routine code choices in the plan.
If a technical test fails, propose a revised design that preserves the required user result.

## Appendix F. Domain and workflow proposal

See [the domain and workflow proposal](./domain-and-workflow-proposal.md) for recommended terminology, graph abstraction, compositing, library, storage, and release ownership. Those recommendations remain under discussion; automatic preview plus Undo is agreed.
