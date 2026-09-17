// =============================================================================
// Skubase — Alignment & Service Billing Preset Services
// =============================================================================

export interface AlignmentServicePreset {
  displayOrder: number;
  particular: string;
  defaultRate: number;
  defaultQuantity: number;
}

/**
 * 11 Pre-defined alignment & shop service items in fixed reference order.
 */
export const DEFAULT_ALIGNMENT_SERVICES: readonly AlignmentServicePreset[] = [
  { displayOrder: 1, particular: "Wheel Alignment 3D", defaultRate: 0, defaultQuantity: 0 },
  { displayOrder: 2, particular: "Wheel Balancing", defaultRate: 0, defaultQuantity: 0 },
  { displayOrder: 3, particular: "Automatic Tire Changing", defaultRate: 0, defaultQuantity: 0 },
  { displayOrder: 4, particular: "Weight - Normal / Alloys", defaultRate: 0, defaultQuantity: 0 },
  { displayOrder: 5, particular: "Puncher Repair / Tubeless", defaultRate: 0, defaultQuantity: 0 },
  { displayOrder: 6, particular: "Tire Rotation", defaultRate: 0, defaultQuantity: 0 },
  { displayOrder: 7, particular: "Tubeless Tire Repair / Kit", defaultRate: 0, defaultQuantity: 0 },
  { displayOrder: 8, particular: "Nitrogen N2 Gas", defaultRate: 0, defaultQuantity: 0 },
  { displayOrder: 9, particular: "Tubeless Nozzle", defaultRate: 0, defaultQuantity: 0 },
  { displayOrder: 10, particular: "Tyre Changing / Opening Fitting", defaultRate: 0, defaultQuantity: 0 },
  { displayOrder: 11, particular: "Tire / Tube Estimate", defaultRate: 0, defaultQuantity: 0 },
] as const;
