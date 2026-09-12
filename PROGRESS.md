# Remaining work to finish the tracer

Updated: 12 September 2026. **Tracer is not complete.** The current Studio supports procedural visual creation; changes below are being developed in separate worktrees while it stays open.

| Remaining task | What it means | Current progress |
| --- | --- | --- |
| Code-defined properties | Each visual defines its own sliders and settings. Intensity is just one possible property. Studio and AI use the same definitions. | **In progress:** mapping the SDK, compiler and runtime changes. Required for tracer completion. |
| Save and export those properties | Keep property values when reopening a scene or restarting it. Exported sources expose the visual's properties in Resolume. | **Next:** part of the property implementation; existing exported sources must keep working. |
| Editor usability | Ctrl+S applies code to preview. Keep scene save explicit, make the scene title distinct from menus, and keep file navigation compact at every width. | **In progress:** isolated implementation and keyboard tests. |
| Smooth slider dragging | Keep the slider under your pointer while earlier changes finish applying. Still show actual applied values separately. | **In progress:** reproducing delayed-update and failed-update cases with automated tests. |
| Image browsing and preview | See image assets alongside source files, use them in a visual, and retain them through preview restart and scene save/reopen. | **Reviewed; integration checks passed:** 80 Studio CPU/DOM tests and 14 editor tests. Actual image rendering still needs Studio validation. |
| PNG, JPEG and transparency | Load common image formats with correct colors and transparent edges. Reject malformed or excessively large images. | **In progress:** bounded PNG decoding first; JPEG and end-to-end transparency checks remain. |
| Image import and export | Import, replace and remove images in Studio. Include every required image in an export so it works independently. | **Pending:** browser and source preservation foundations exist; import controls and installed image playback remain. |
| Standalone Resolume checks | Run two different exported visuals with Lux closed and the development checkout unavailable. Reopen a saved composition and retain each source's values. | **Partly verified:** startup around one second and independent copies passed manual QA. Different-source and offline/package-isolation checks remain. |
| Failure recovery | Broken or stalled visuals stop cleanly; recovery uses current settings and does not freeze Studio or Resolume. | **Partly verified:** automated lifecycle checks pass. Retry policy and actual process/GPU stop-and-recovery measurements remain. |
| Performance and final sign-off | Measure real playback smoothness and control response, then record every required check as passed, failed or unavailable. | **Foundation complete:** measurement design and offline evaluator tested. Runtime measurement collection and final hardware acceptance remain. |

After relevant features land, update and reinstall the repo-shipped visual-creation skill. Its initial installation and validation are complete. Live Studio/Resolume tests will be coordinated so they do not interrupt the current creative session.
