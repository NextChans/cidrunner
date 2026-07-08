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

/** Palette groups, mirroring how the AWS console organizes services. */
export type ResourceCategory = 'network' | 'compute' | 'database' | 'storage' | 'security'

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  network: '네트워킹',
  compute: '컴퓨팅',
  database: '데이터베이스',
  storage: '스토리지',
  security: '보안',
}

/** Palette display order for the categories. */
export const CATEGORY_ORDER: readonly ResourceCategory[] = [
  'network',
  'compute',
  'database',
  'storage',
  'security',
]

/**
 * A valid placement target for a resource: either another resource type that
 * acts as its container, or `'canvas'` for a top-level (unparented) node.
 */
export type ParentKind = ResourceType | 'canvas'

/**
 * A single editable property, rendered as a form control in the Inspector
 * (Phase 2). The form is generated from a resource's `fields`, so the Inspector
 * stays data-driven rather than hard-coding a form per resource.
 */
export interface PropertyField {
  /** Key into the node's `data.config`. */
  key: string
  /** Human-facing label (Korean). */
  label: string
  type: 'text' | 'number' | 'boolean' | 'select'
  /** Marks the field as mandatory: an empty value is a validation error. */
  required?: boolean
  /** Options for a `'select'` field. */
  options?: readonly { value: string; label: string }[]
  /** Placeholder shown in empty text/number inputs. */
  placeholder?: string
  /** Short helper text under the control. */
  help?: string
  /** Bounds for a `'number'` field. */
  min?: number
  max?: number
}

/**
 * Everything a resource needs to emit apply-ready Terraform (Phase 4, refined
 * post-MVP — see ADR 0016). The generator builds this per node, resolving
 * `refs` from the graph topology (parent chain, same-VPC siblings, and
 * attachment/traffic edges) so emitters never walk the graph themselves.
 */
export interface TfContext {
  /** Terraform-safe local name (resource label), e.g. `subnet_1`. */
  name: string
  /** Value safe for AWS `name` attributes (alphanumeric + hyphen), e.g. `subnet-1`. */
  awsName: string
  /** Player-set display name, used for `tags.Name`. */
  displayName: string
  /** The node's `data.config`. */
  config: Record<string, unknown>
  refs: {
    /** Local name of the enclosing VPC (for subnet/igw/sg/alb). */
    vpc?: string
    /** Local name of the enclosing subnet (for ec2/rds/nat). */
    subnet?: string
    /** Local names of all subnets in the same VPC. */
    subnets?: string[]
    /** Local names of the *public* subnets in the same VPC (for external ALB). */
    publicSubnets?: string[]
    /** Local names of security groups attached to this node via SG edges. */
    securityGroups?: string[]
    /** Local names of EC2 instances this ALB forwards to (alb → ec2 edges). */
    targets?: string[]
  }
}

export interface ResourceMeta {
  type: ResourceType
  /** Human-facing label shown in the palette and on the node. */
  label: string
  /** Short one-liner describing what the block represents. */
  description: string
  /** Palette category (see {@link CATEGORY_LABELS}). */
  category: ResourceCategory
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
   * source's `connectsTo` includes the target's type. Edges from a Security
   * Group are *attachments*, not traffic (see ADR 0017).
   */
  connectsTo?: readonly ResourceType[]
  /**
   * Editable properties shown in the Inspector (Phase 2). Omit or leave empty
   * for resources with no user-editable configuration (e.g. IGW, NAT).
   */
  fields?: readonly PropertyField[]
  /**
   * Emits the Terraform HCL block(s) for this resource (Phase 4 / ADR 0016).
   * The generator resolves cross-resource references from the graph topology
   * and passes them in via `TfContext.refs`.
   */
  terraform: (ctx: TfContext) => string
  /**
   * Returns a list of validation error messages (empty = valid), run in real
   * time as the Inspector edits `config` (Phase 2).
   */
  validate?: (config: Record<string, unknown>) => string[]
}
