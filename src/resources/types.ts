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

/**
 * A valid placement target for a resource: either another resource type that
 * acts as its container, or `'canvas'` for a top-level (unparented) node.
 */
export type ParentKind = ResourceType | 'canvas'

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
   * Where this resource may be placed. Drives nesting rules (Phase 1):
   * `'canvas'` means it may sit at the top level, a `ResourceType` means it
   * may be nested inside a node of that type. A resource with no `'canvas'`
   * entry must always live inside a container.
   */
  allowedParents: readonly ParentKind[]
  /**
   * True if this resource is a container that can visually hold child nodes
   * (VPC, Subnet). Containers render as a box and take a `defaultSize`.
   */
  container?: boolean
  /** Pixel size applied when a container node is created. */
  defaultSize?: { width: number; height: number }
  /**
   * Resource types this one may draw a (directional) edge to. Drives edge
   * rules (Phase 1): a connection `source → target` is allowed only if the
   * source's `connectsTo` includes the target's type.
   */
  connectsTo?: readonly ResourceType[]
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
