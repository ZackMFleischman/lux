// Internal metadata helper only; not an authored SDK entry or executable factory.
import { normalizeComponentDeclaration } from '../../runtime-contracts/src/components.mjs';
import type { ComponentDeclaration, ComponentMetadata } from '../../runtime-contracts/src/components.mjs';
import type { ControlDeclarations, ControlSchemaOf, ValidControlDeclarations } from '../../runtime-contracts/src/parameters.mjs';

export function declareComponent<const C extends ControlDeclarations>(
  declaration: Omit<ComponentDeclaration, 'controls' | 'controlDescriptions'> & {
    readonly controls: C & ValidControlDeclarations<C>;
    readonly controlDescriptions: { readonly [K in keyof C]: string };
  },
): Omit<ComponentMetadata, 'controls'> & { readonly controls: ControlSchemaOf<C> } {
  return normalizeComponentDeclaration(declaration) as Omit<ComponentMetadata, 'controls'> & { readonly controls: ControlSchemaOf<C> };
}
