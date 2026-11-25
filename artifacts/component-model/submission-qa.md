Coordinator owns integration and final skill installation/check from the integrated checkout. Run node scripts/install-visual-skill.mjs, then node scripts/install-visual-skill.mjs --check. Do not overwrite the installed skill from the worker branch during concurrent integration.

Independent reviewer should inspect the three native evidence directories listed in evidence.md: direct Visual node/Inspector, nested graph navigation, the new defineVisual source, normal and narrow layouts, and failed-build retention. No additional GPU run is required for this review.

Known separate UI defect: slider thumb mouse hitbox overlaps Animate for some values. Coordinator confirmed it predates this source and owns a separate fix; graph demonstrations use real Enter activation, never force-click. Scene reopen restores 1920x1080; the final harness reapplies supported640x360 for routine phases. This slice does not claim either defect fixed.

LUX-151 may consume visualControlNode/compositionControlTarget with the unchanged {nodePath, definitionHash, schemaHash, controlId} tuple. Its branch owns subsequent Inspector/renderer edits. Shared evaluator, animation formats, persistence and native-input policy are unchanged by LUX-150.
