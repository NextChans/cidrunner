import type { Edge } from '@xyflow/react'
import { getResource, type ResourceType } from '@/resources'
import type { ResourceCategory } from '@/resources/types'
import { assignedSgIds, type SecurityGroupDef } from '@/graph/securityGroups'
import type { ResourceNodeType } from '@/store/useGraphStore'

/**
 * draw.io (diagrams.net) export (ADR 0064). cidrunner already holds everything a
 * diagram needs — resource type, parent-relative position, containment, and
 * edges — so, like the Terraform generator, this maps each node to an
 * `mxCell` with an AWS 2017 (`mxgraph.aws4`) shape and each edge to a connector.
 * Output is uncompressed `<mxfile>` XML, which draw.io, the VS Code extension,
 * and Confluence all open directly. Export-only (import is far lower-fidelity).
 */

/** AWS4 resource-icon name per leaf resource type (drawio `resIcon`). */
const RES_ICON: Partial<Record<ResourceType, string>> = {
  igw: 'internet_gateway',
  nat: 'nat_gateway',
  alb: 'application_load_balancer',
  ec2: 'ec2',
  ecs: 'elastic_container_service',
  eks: 'elastic_kubernetes_service',
  rds: 'rds',
  elasticache: 'elasticache',
  s3: 'simple_storage_service',
  efs: 'elastic_file_system',
  ecr: 'elastic_container_registry',
  lambda: 'lambda',
  apigw: 'api_gateway',
  dynamodb: 'dynamodb',
  cloudfront: 'cloudfront',
  route53: 'route_53',
  sqs: 'simple_queue_service',
  sns: 'simple_notification_service',
  cloudwatch: 'cloudwatch',
  cloudtrail: 'cloudtrail',
  cognito: 'cognito',
  secretsmanager: 'secrets_manager',
  kms: 'key_management_service',
  acm: 'certificate_manager',
  waf: 'waf',
}

/** Icon background colour by palette category (AWS service group colours). */
const CATEGORY_FILL: Record<ResourceCategory, string> = {
  network: '#8C4FFF',
  compute: '#ED7100',
  database: '#4D72F3',
  storage: '#7AA116',
  integration: '#E7157B',
  management: '#E7157B',
  security: '#DD344C',
}

/** Default leaf icon box (AWS4 icons are square). */
const LEAF = 78

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]!)
}

/** Container (group) style per organizational/container type. */
function containerStyle(node: ResourceNodeType): string {
  const base =
    'sketch=0;outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;' +
    'fontStyle=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;verticalAlign=top;' +
    'align=left;spacingLeft=30;dashed=0;'
  switch (node.data.type) {
    case 'account':
      return `${base}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;fontColor=#232F3E;`
    case 'vpc':
      return `${base}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc;strokeColor=#248814;fillColor=none;fontColor=#248814;`
    case 'az':
      // AZ has no dedicated group icon — a dashed region reads clearly.
      return `${base}rounded=0;dashed=1;dashPattern=8 4;strokeColor=#00A4A6;fillColor=none;fontColor=#147EBA;`
    case 'subnet': {
      const isPublic = node.data.config.public === true
      return isPublic
        ? `${base}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_public_subnet;strokeColor=#248814;fillColor=#E9F3E6;fontColor=#248814;`
        : `${base}shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_private_subnet;strokeColor=#147EBA;fillColor=#E6F2F8;fontColor=#147EBA;`
    }
    default:
      return `${base}rounded=1;strokeColor=#879196;fillColor=none;`
  }
}

/** Leaf resource-icon style. */
function leafStyle(type: ResourceType): string {
  const meta = getResource(type)
  const icon = RES_ICON[type]
  const fill = CATEGORY_FILL[meta.category]
  if (!icon) {
    // No AWS4 icon mapped — a labelled rounded box still reads.
    return `rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=none;fontColor=#FFFFFF;fontSize=11;`
  }
  return (
    'sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;' +
    `fillColor=${fill};strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;` +
    'align=center;html=1;fontSize=11;fontStyle=0;aspect=fixed;whiteSpace=wrap;' +
    `shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.${icon};`
  )
}

/** Depth in the containment tree — so parents are emitted before children. */
function depthOf(node: ResourceNodeType, byId: Map<string, ResourceNodeType>): number {
  let d = 0
  let cur = node.parentId ? byId.get(node.parentId) : undefined
  while (cur && d < 100) {
    d += 1
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return d
}

/** Builds a draw.io `.drawio` XML document for the design. */
export function generateDrawio(
  nodes: ResourceNodeType[],
  edges: Edge[] = [],
  securityGroups: SecurityGroupDef[] = [],
): string {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const sgName = new Map(securityGroups.map((sg) => [sg.id, sg.name]))
  const ids = new Set(nodes.map((n) => n.id))

  // Parents must precede children in the XML.
  const ordered = [...nodes].sort((a, b) => depthOf(a, byId) - depthOf(b, byId))

  const cells: string[] = []
  for (const node of ordered) {
    const meta = getResource(node.data.type)
    const isContainer = meta.container === true
    const parent = node.parentId && ids.has(node.parentId) ? `n-${node.parentId}` : '1'
    const style = isContainer ? containerStyle(node) : leafStyle(node.data.type)

    // Size: containers keep their authored region; leaves are square icons.
    const w = isContainer
      ? Number(node.style?.width ?? node.measured?.width ?? 240)
      : LEAF
    const h = isContainer
      ? Number(node.style?.height ?? node.measured?.height ?? 160)
      : LEAF

    // Label: name + any assigned Security Groups (which aren't nodes — ADR 0059).
    const sgs = assignedSgIds(node)
      .map((sgId) => sgName.get(sgId))
      .filter((n): n is string => n !== undefined)
    const label = sgs.length ? `${node.data.label}&#10;🛡 ${sgs.join(', ')}` : node.data.label

    cells.push(
      `        <mxCell id="n-${esc(node.id)}" value="${esc(label)}" style="${esc(style)}" vertex="1" parent="${esc(parent)}">\n` +
        `          <mxGeometry x="${node.position.x}" y="${node.position.y}" width="${w}" height="${h}" as="geometry" />\n` +
        `        </mxCell>`,
    )
  }

  const edgeStyle =
    'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;strokeColor=#545B64;'
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue
    cells.push(
      `        <mxCell id="e-${esc(e.id)}" style="${edgeStyle}" edge="1" parent="1" ` +
        `source="n-${esc(e.source)}" target="n-${esc(e.target)}">\n` +
        `          <mxGeometry relative="1" as="geometry" />\n` +
        `        </mxCell>`,
    )
  }

  return `<mxfile host="cidrunner" type="device">
  <diagram id="cidrunner" name="cidrunner">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`
}

/** Triggers a browser download of the design as a `.drawio` file. */
export function downloadDrawio(
  nodes: ResourceNodeType[],
  edges: Edge[] = [],
  securityGroups: SecurityGroupDef[] = [],
): void {
  const xml = generateDrawio(nodes, edges, securityGroups)
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'cidrunner.drawio'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
