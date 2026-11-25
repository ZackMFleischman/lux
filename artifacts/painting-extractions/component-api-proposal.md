# Living Painting component API proposal

This exploratory proposal is superseded by
[`docs/visuals/living-painting-components.md`](../../docs/visuals/living-painting-components.md),
which records the accepted flat shader-field snapshot contract and extraction
sequence.

The implemented contract uses port metadata
`{ kind: 'shader-field', version: 1, abi: string }` and an immutable bounded
snapshot `{ version: 1, abi, fragments: Record<string, string>, values:
Record<string, number> }`. Consumers verify their exact fragment and value keys,
assemble the admitted fragments at fixed source positions once per component
instance, reject source changes on that instance, and update existing uniforms
from numeric values on later evaluations.
