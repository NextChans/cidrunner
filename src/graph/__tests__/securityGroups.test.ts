import { describe, expect, it } from 'vitest'
import {
  assignedSgIds,
  isSgAssignable,
  materializeSecurityGroups,
  type SecurityGroupDef,
} from '@/graph/securityGroups'
import { generateTerraform } from '@/graph/terraform'
import { N, E } from './helpers'

const WEB_SG: SecurityGroupDef = {
  id: 'sg-1',
  name: 'Web SG',
  allowHttp: true,
  allowHttps: true,
  allowSsh: false,
}

describe('security groups (ADR 0059)', () => {
  it('reads assigned ids off a resource config, ignoring non-strings', () => {
    expect(assignedSgIds(N('ec2-1', 'ec2', undefined, { securityGroupIds: ['sg-1', 'sg-2'] }))).toEqual([
      'sg-1',
      'sg-2',
    ])
    expect(assignedSgIds(N('ec2-2', 'ec2', undefined, {}))).toEqual([])
    expect(assignedSgIds(N('ec2-3', 'ec2', undefined, { securityGroupIds: 'nope' }))).toEqual([])
  })

  it('marks ENI-owning resources assignable and others not', () => {
    expect(isSgAssignable('ec2')).toBe(true)
    expect(isSgAssignable('rds')).toBe(true)
    expect(isSgAssignable('lambda')).toBe(false)
    expect(isSgAssignable('s3')).toBe(false)
  })

  it('materializes a synthetic sg node + attachment edge parented to the member VPC', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: false }),
      N('ec2-1', 'ec2', 's1', { instance_type: 't3.micro', ami: 'auto', securityGroupIds: ['sg-1'] }),
    ]
    const { nodes: outN, edges: outE } = materializeSecurityGroups(nodes, [], [WEB_SG])
    const sgNode = outN.find((n) => n.id === 'sg-1')
    expect(sgNode?.data.type).toBe('sg')
    expect(sgNode?.parentId).toBe('vpc-1') // parented to the member's enclosing VPC
    expect(outE.some((e) => e.source === 'sg-1' && e.target === 'ec2-1')).toBe(true)
  })

  it('is a no-op with no security groups, and drops unassigned ones', () => {
    const nodes = [N('ec2-1', 'ec2', undefined, {})]
    expect(materializeSecurityGroups(nodes, [], [])).toEqual({ nodes, edges: [] })
    // A defined-but-unassigned SG contributes no synthetic node.
    const { nodes: outN } = materializeSecurityGroups(nodes, [], [WEB_SG])
    expect(outN.some((n) => n.data.type === 'sg')).toBe(false)
  })

  it('emits a real aws_security_group + vpc_security_group_ids from the assignment', () => {
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('s2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
      N('ec2-1', 'ec2', 's1', { instance_type: 't3.micro', ami: 'auto', securityGroupIds: ['sg-1'] }),
    ]
    const main = generateTerraform(nodes, [], [WEB_SG])['main.tf']!
    expect(main).toContain('resource "aws_security_group" "sg_1"')
    expect(main).toContain('vpc_id      = aws_vpc.vpc_1.id')
    expect(main).toContain('vpc_security_group_ids = [aws_security_group.sg_1.id]')
    expect(main).not.toContain('REPLACE_ME')
  })

  it('derives tiered SG-to-SG ingress from the traffic topology', () => {
    // ALB and EC2 wear different SGs; the app SG must allow the ALB SG on :80.
    const albSg: SecurityGroupDef = { id: 'sg-alb', name: 'ALB', allowHttp: true, allowHttps: true, allowSsh: false }
    const appSg: SecurityGroupDef = { id: 'sg-app', name: 'App', allowHttp: false, allowHttps: false, allowSsh: false }
    const nodes = [
      N('vpc-1', 'vpc', undefined, { cidr_block: '10.0.0.0/16' }),
      N('s1', 'subnet', 'vpc-1', { cidr_block: '10.0.1.0/24', az: 'a', public: true }),
      N('s2', 'subnet', 'vpc-1', { cidr_block: '10.0.2.0/24', az: 'b', public: true }),
      N('alb-1', 'alb', 'vpc-1', { internal: false, listener_port: 80, securityGroupIds: ['sg-alb'] }),
      N('ec2-1', 'ec2', 's1', { instance_type: 't3.micro', ami: 'auto', securityGroupIds: ['sg-app'] }),
    ]
    const main = generateTerraform(nodes, [E('t1', 'alb-1', 'ec2-1')], [albSg, appSg])['main.tf']!
    expect(main).toMatch(/security_groups = \[aws_security_group\.sg_alb\.id\]/)
  })
})
