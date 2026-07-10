import type { Edge } from '@xyflow/react'
import type { ResourceType } from '@/resources'
import type { ResourceNodeType } from '@/store/useGraphStore'

/** Builds a resource node for graph-module tests. */
export function N(
  id: string,
  type: ResourceType,
  parentId?: string,
  config: Record<string, unknown> = {},
  label = id,
): ResourceNodeType {
  return {
    id,
    type: 'resource',
    position: { x: 0, y: 0 },
    parentId,
    data: { type, label, config },
  }
}

/** Builds an edge for graph-module tests. */
export function E(id: string, source: string, target: string): Edge {
  return { id, source, target }
}

/**
 * A best-practice 3-tier + serverless topology used across suites. Security
 * Groups are assigned via `config.securityGroupIds` and a `securityGroups`
 * collection (ADR 0059) — no sg nodes/edges. Consumers that emit Terraform or
 * grade the graph pass `securityGroups` through.
 */
export function bestPracticeTopology() {
  const sgIds = { securityGroupIds: ['sg-7'] }
  const nodes = [
    N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }, 'Prod VPC'),
    N('subnet-1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }, 'Public A'),
    N('subnet-2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }, 'Public B'),
    N('subnet-3', 'subnet', 'vpc-1', { cidr_block: '10.0.11.0/24', az: 'a', public: false }, 'Private A'),
    N('subnet-4', 'subnet', 'vpc-1', { cidr_block: '10.0.12.0/24', az: 'b', public: false }, 'Private B'),
    N('igw-5', 'igw', 'vpc-1', {}, 'IGW'),
    N('nat-6', 'nat', 'subnet-1', {}, 'NAT'),
    N('alb-8', 'alb', 'vpc-1', { internal: false, listener_port: 80, ...sgIds }, 'Web ALB'),
    N('ec2-9', 'ec2', 'subnet-3', { instance_type: 't3.micro', ami: 'auto', ...sgIds }, 'App Server'),
    N(
      'rds-10',
      'rds',
      'subnet-4',
      {
        engine: 'mysql',
        instance_class: 'db.t3.micro',
        allocated_storage: 20,
        multi_az: true,
        storage_encrypted: true,
        ...sgIds,
      },
      'Main DB',
    ),
    N('s3-11', 's3', undefined, { versioning: true, encryption: true, block_public_access: true }, 'Assets'),
    N(
      'lambda-12',
      'lambda',
      undefined,
      { runtime: 'nodejs20.x', handler: 'index.handler', memory_mb: 256 },
      'API Fn',
    ),
  ]
  const edges = [
    E('t1', 'alb-8', 'ec2-9'),
    E('t2', 'ec2-9', 'rds-10'),
    E('t3', 'lambda-12', 's3-11'),
  ]
  const securityGroups = [
    { id: 'sg-7', name: 'Web SG', allowHttp: true, allowHttps: true, allowSsh: false },
  ]
  return { nodes, edges, securityGroups }
}
