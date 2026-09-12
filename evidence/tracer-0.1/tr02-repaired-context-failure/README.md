# Repaired standalone diagnostic: context initialization failed

Source0163a09, native repairacbbe65 (reviewede023ea2), native DLL SHA13440a481726246cb7336fd5ede1552d1e45d3241ba7a34f3ed26881c345a30b.

One exclusive supervised run attempted five seconds of producer work and ten seconds of standalone receiver under20second budget. Receiver exited5 during FFGL instantiation with `worker shared GL context failed`. Orchestrator exited2, job cleanupComplete=true, no timeout. Resolume remained closed and installed probe remained disabled. This is a failed feasibility observation, not transport or stability acceptance.

Next change is diagnostic instrumentation to distinguish wglCreateContextAttribsARB failure from wglMakeCurrent failure and record exact Win32 errors and pixel format/context identities. No transport fallback or additional behavior change inferred yet.
