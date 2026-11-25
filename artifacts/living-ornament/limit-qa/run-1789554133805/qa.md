# Remaining delivery steps

1. Independently review commits `025d41758f8af026e16a741257dd7b55a9b73362` and `cb086ec2c025f88fde86f67d09382954d0becc8f`, the retained safety bounds, and the actual UI captures in this directory.
2. Integrate the reviewed commits into main serially.
3. Install the changed authoring skill from main with `node scripts/install-visual-skill.mjs`, then run `node scripts/install-visual-skill.mjs --check`.
4. Record the landed commit and installed-skill receipts on LUX-170 before independent acceptance.
