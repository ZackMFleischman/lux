# Studio export action

Implementation slice of TR-06, 12 September 2026. The installed runtime and host acceptance remain separate gates.

Studio names an export and chooses its output directory using the native folder picker. The authoring session exclusively captures and validates the entire current draft, then exports that same source with its current applied controls. Editing, Open, Save and competing AI builds cannot change the admitted snapshot during export. Canceling the folder picker leaves the source intact. Export does not clear unsaved changes or silently replace an installed release.

The main process accepts only its trusted main renderer. A bounded child process validates a temporary scene document, compiles and links before copying the pinned runtime, and returns the immutable package path and identities. No generated code executes in the main process. The preview remains available while packaging. Errors stay in the export dialog; success identifies the package location without claiming installed playback has passed.

Validation: session tests cover full multi-file snapshot, exclusive admission, cancellation and failure; real Electron tests exercise the dialog and package result when the native payload is built. Package and installed-runtime tests retain responsibility for dependency hashes, safe paths and source registration.
