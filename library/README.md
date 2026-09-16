# Lux standard component library

Studio stores explicitly saved reusable components here as immutable source revisions and updates `catalog.json` atomically. All profiles for this repository resolve this directory through Git's common checkout. Commit reviewed component additions and updates to distribute them through repository updates and desktop releases.

Desktop packages record this marked repository location and keep using it while it is available. A standalone installation uses a visible app-data fallback seeded from the packaged copy; when this repository returns, Studio imports nonconflicting additions and updates with matching immutable history here without deleting the fallback copy.

Ordinary scene edits and saves do not write here. Do not edit active revision directories in place; create or update a component through Studio so validation, revision checks, and concurrent-write protection run first.
