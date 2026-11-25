Root integration checklist:

- Independently review `de0226d5973740f2703ebf54479529e0df950875`, including the broker's exact observed permission shapes and capture/discovery race tests.
- Integrate the commit serially into current main.
- Rebuild and rerun the focused audio and interaction commands on the landed commit.
- If installed-app delivery is wanted, build or install from the integrated source and repeat the pre-connect CABLE and Default checks in a new isolated profile. This worker did not install or merge the app.

The full interaction file had one unrelated tooltip timing failure during a 29-test run. Its isolated rerun passed. The four affected audio interaction tests passed together after that run.
