// Internal metadata helper only; not an authored SDK entry or executable factory.
import { normalizeComponentDeclaration } from '../../runtime-contracts/src/components.mjs';
import type { ComponentDeclaration, ComponentMetadata } from '../../runtime-contracts/src/components.mjs';
import type { ControlDeclarations } from '../../runtime-contracts/src/parameters.mjs';

export function declareComponent<const C extends ControlDeclarations>(
  declaration: Omit<ComponentDeclaration, 'controls' | 'controlDescriptions'> & {
    readonly controls: C;
    readonly controlDescriptions: { readonly [K in keyof C]: string };
  },
): ComponentMetadata {
  return normalizeComponentDeclaration(declaration);
}
