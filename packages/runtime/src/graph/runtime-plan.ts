import type { ValidatedNestedGraph, NodeControlOverride, NestedExecutionPlan } from '../../../runtime-contracts/src/nested-graph.ts';
import { planNestedGraph } from './nested-plan.ts';

// The brand is compile-time only. The registry is the local authority boundary.
declare const runtimePlanBrand: unique symbol;
export type GraphRuntimePlan = Readonly<{ readonly [runtimePlanBrand]: true }>;
const preparedPlans = new WeakMap<object, NestedExecutionPlan>();

export function prepareGraphRuntimePlan(validated: ValidatedNestedGraph, overrides?: readonly NodeControlOverride[]): GraphRuntimePlan {
  // C03b owns authenticity, admission budgets, topology and effective defaults.
  const result = planNestedGraph(validated, overrides);
  const token = Object.freeze(Object.create(null)) as GraphRuntimePlan;
  preparedPlans.set(token, result);
  return token;
}

export function readGraphRuntimePlan(plan: GraphRuntimePlan): NestedExecutionPlan {
  const result = preparedPlans.get(plan);
  if (!result) throw new TypeError('Expected a prepared graph runtime plan');
  return result;
}
