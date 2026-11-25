Independent validator:
1. Review commit c7660fd06eb40230436463a53b727960378dfdf0 against LUX-143 revision 2.
2. Inspect result.json and the four PNGs in this directory. Confirm the normal-startup canvas, the same old visual with enabled animation controls while Build is busy, paused promoted output with spikeHeight 1.7, and identical retained output after the invalid build.
3. Confirm required checks from the evidence: `npm run typecheck` and `npm run test:studio:cpu` passed on the isolated checkout.
4. After integration, rerun the native harness in a reserved serial GPU lane against the landed SHA if the target tree differs from the tested commit.
5. Install/check the visual skill from the integrated checkout using `node scripts/install-visual-skill.mjs` then `node scripts/install-visual-skill.mjs --check`; the coordinator owns this shared installation because concurrent skill edits must be combined first.
