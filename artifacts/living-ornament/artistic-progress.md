# Living Ornament visual progress

Source: codex/living-ornament, uncommitted batch LUX-171. Actual isolated Studio captures; scripted application interaction, not native-input evidence. User desktop preserved.

## First study

`batch1-first/seed-7.png` and seeds 19/43: unacceptable giant ellipse-like blobs, angular band, yellow dominance, weak hierarchy and excessive pooling halo. Sent geometry and color revisions before proceeding to motifs.

## Second study

`batch1-second/seed-7.png` and seeds 19/43: curved bands, teal/violet/dark families, stronger contours and paper texture are improvements. Still too broad/smooth; tiny islands and sharp intersection slivers weaken intentional composition. Requested smaller broad anchors, smooth bays, larger attached islands, and distinct blush versus ivory families. Screenshots printed inline for the user.

## Performance comparison

Same isolated build and 1920×1080 output, normal animation, 4-second warmup followed by 20-second measurement. Each app ran separately. Raw source and telemetry retained in each directory.

| Version | Observed completed-frame FPS | Worker FPS | Lowest interval FPS | Maximum reported interval GPU p95 |
| --- | ---: | ---: | ---: | ---: |
| First study | 27.08 | 26.75 | 25.68 | 30.21 ms |
| Second study | 58.02 | 57.64 | 37.86 | 4.39 ms |

These are sequential runs, not a controlled hardware benchmark. GPU values are sampled pass timings and exclude unmeasured uploads/copies. The maximum interval p95 is not an aggregate frame percentile. No runtime fault occurred. The second study approaches the 60 FPS goal but has an interval dip that remains a performance limitation.

Evidence: `performance-first/result.json`, `performance-second/result.json`. Owned processes 9708 (second art), 26504 (second performance), and 22128 (first performance) exited with code 0. GPU reservation released after runs.

## Third study and independent review

Third-study captures show clearer blush/ivory separation, enlarged nested forms, thinner curved bands and softer bays. Accepted as a shape/color foundation; clean vector-like regions still need the planned attached pattern layer. Normal playback averaged58.52 FPS, worker57.15 FPS, maximum interval GPU p95 4.19ms. A roughly half-second interval fell to8.06FPS with queueWait max413.7ms while GPU sampled timing stayed3.93ms; this is an unresolved scheduling stall, not evidence of a locked60FPS. No runtime fault.

Independent review found inert composition exposure, weak hierarchy control, and local/world tangent mismatch. Fixes are underway before publication. Original Living Painting at18s and42s is exactly pixel-identical after dual-output changes (legacy-18-comparison.json and legacy-42-comparison.json).

## Reviewed foundation

All source findings resolved: removed inactive composition exposure, material hierarchy changes across three tiers with matched child masks, nesting zero removes islands, tangent and local share the attached frame. Final captures: batch1-reviewed at18 seconds and batch1-motion-42 at42 seconds, seeds7/19/43 and detail. Default composition remains coherent; motion is deliberately subtle until173. Final normal20-second run: observed59.8296FPS, worker59.7288FPS, minimum interval58.1046FPS, maximum interval GPU p954.128768ms. No fault. Owned PIDs9132,27576,28384 exited0; measurement exclusivity released. Earlier scheduling stalls remain in raw evidence; this one successful repeat does not establish universal frame-time guarantees.
