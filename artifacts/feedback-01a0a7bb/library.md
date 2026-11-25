User result: All Studio profiles use one growing standard component library with repository-owned source files, also available in the installed app.
Why now: The current library is stored in each profile's component-library.json, contrary to the user's intended shared standard library.
Acceptance:
- Store reusable component source in a repository-owned library directory independent of Studio profiles; package the standard content with desktop releases.
- Explicitly saved reusable components enter the library. Ordinary scene edits remain scene edits.
- Preserve existing profile entries during migration, linked revisions, saved fallbacks and fork behavior. Detect conflicts; never silently overwrite entries or lose concurrent additions.
- Demonstrate shared discovery across two profiles and packaged-app availability. Cross-machine distribution uses repository updates/releases.
- Update and install/check the shipped authoring skills.
Checklist: implementation; migration/concurrency checks; independent review; integration; actual app demonstration.
Approved in task 01a0a7bb-ee60-76f1-bcd6-5d179614f551. Follow-up to LUX-112.
