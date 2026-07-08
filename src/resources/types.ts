import type { LucideIcon } from 'lucide-react'

/**
 * The 10 AWS resource primitives the MVP supports.
 * Kept intentionally small — one block per real-world concept.
 */
export type ResourceType =
  | 'vpc'
  | 'subnet'
  | 'igw'
  | 'nat'
  | 'sg'
  | 'alb'
  | 'ec2'
  | 'rds'
  | 's3'
  | 'lambda'

export interface ResourceMeta {
  type: ResourceType
  /** Human-facing label shown in the palette and on the node. */
  label: string
  /** Short one-liner describing what the block represents. */
  description: string
  /** lucide-react icon component. */
  icon: LucideIcon
  /** Tailwind text-color class used to tint the node accent. */
  color: string
  /** Default config seeded into a node's `data.config` when created. */
  defaults: Record<string, unknown>
  /**
   * Emits the Terraform HCL for this resource.
   * Phase 4 concern — currently a no-op returning an empty string.
   */
  terraform: (id: string, config: Record<string, unknown>) => string
  /**
   * Returns a list of validation error messages (empty = valid).
   * Phase 3 concern — optional and unimplemented for now.
   */
  validate?: (config: Record<string, unknown>) => string[]
}
