import type { LucideIcon } from 'lucide-react'

/**
 * The AWS resource primitives the game supports — one block per real-world
 * concept. The original 10-block MVP set (ADR 0001) was expanded to 14 in
 * batch 1 (ADR 0022: DynamoDB, CloudFront, Route 53, SQS), to 20 in batch 2
 * (ADR 0026: ECS, EKS, SNS, EFS, ElastiCache, CloudWatch), to 26 in batch 3
 * (ADR 0035: Cognito, Secrets Manager, KMS, ACM, WAF, Kinesis), and to 27 when
 * the Lambda + API GW combo was split into standalone Lambda and API Gateway
 * blocks (ADR 0046), and to 29 with the AWS Account and Availability Zone
 * organizational containers (ADR 0050).
 */
export type ResourceType =
  | 'account'
  | 'az'
  | 'vpc'
  | 'subnet'
  | 'igw'
  | 'nat'
  | 'sg'
  | 'alb'
  | 'ec2'
  | 'ecs'
  | 'eks'
  | 'rds'
  | 'elasticache'
  | 's3'
  | 'efs'
  | 'lambda'
  | 'apigw'
  | 'dynamodb'
  | 'cloudfront'
  | 'route53'
  | 'sqs'
  | 'sns'
  | 'cloudwatch'
  | 'cognito'
  | 'secretsmanager'
  | 'kms'
  | 'acm'
  | 'waf'
  | 'kinesis'

/** Palette groups, mirroring how the AWS console organizes services. */
export type ResourceCategory =
  | 'network'
  | 'compute'
  | 'database'
  | 'storage'
  | 'integration'
  | 'management'
  | 'security'

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  network: '네트워킹',
  compute: '컴퓨팅',
  database: '데이터베이스',
  storage: '스토리지',
  integration: '앱 통합',
  management: '관리·모니터링',
  security: '보안·아이덴티티',
}

/** Palette display order for the categories. */
export const CATEGORY_ORDER: readonly ResourceCategory[] = [
  'network',
  'compute',
  'database',
  'storage',
  'integration',
  'management',
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
    /** Local names of the *private* subnets in the same VPC (for containers). */
    privateSubnets?: string[]
    /**
     * One subnet per distinct AZ in the same VPC — EFS mount targets are unique
     * per AZ, so mounting into two same-AZ subnets fails `apply`.
     */
    azUniqueSubnets?: string[]
    /** Local names of security groups attached to this node via SG edges. */
    securityGroups?: string[]
    /** Local names of EC2 instances this ALB forwards to (alb → ec2 edges). */
    targets?: string[]
    /** Local name of the source RDS when this node is a read replica (rds → rds edge). */
    replicaSource?: string
    /** CloudFront origin (first cloudfront → alb/s3/lambda edge). */
    originTarget?: { kind: ResourceType; name: string }
    /** Route 53 alias record target (first route53 → cloudfront/alb edge). */
    aliasTarget?: { kind: ResourceType; name: string }
    /** Local names of Lambda consumers of this queue (sqs → lambda edges). */
    consumers?: string[]
    /** Local names of SQS queues feeding this Lambda (sqs → lambda edges). */
    sqsSources?: string[]
    /** SNS subscribers (sns → sqs/lambda edges): each fans out to one endpoint. */
    subscribers?: { kind: ResourceType; name: string }[]
    /** CloudWatch monitor targets (cloudwatch → ec2/rds/alb/lambda edges). */
    monitorTargets?: { kind: ResourceType; name: string }[]
    /** Local name of the customer-managed KMS key (secretsmanager → kms edge). */
    kmsKey?: string
    /** Lambda proxy target of an API Gateway (apigw → lambda edge). */
    integrationTarget?: string
    /**
     * ACM certificate securing this ALB (acm → alb attachment edge, ADR 0056).
     * When present the ALB emits an HTTPS:443 listener and redirects HTTP:80,
     * instead of a plaintext HTTP listener.
     */
    certificate?: string
    /**
     * Cognito user pool authorizing this API Gateway (cognito → apigw attachment
     * edge, ADR 0056). When present the API's method uses a COGNITO_USER_POOLS
     * authorizer instead of `authorization = "NONE"`.
     */
    authorizer?: string
    /**
     * Derived tiered ingress for a Security Group (ADR 0055): for each resource
     * this SG is attached to, the source SGs that send it traffic + the target
     * port — so the emitted SG allows `ALB-SG → app:80`, `app-SG → rds:3306`,
     * etc., instead of only the internet toggles.
     */
    sgIngress?: { fromSg: string; port: number; desc: string }[]
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
