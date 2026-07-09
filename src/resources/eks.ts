import { Ship } from 'lucide-react'
import type { ResourceMeta } from './types'

/**
 * EKS — managed Kubernetes (ADR 0026). The heaviest block: an apply-ready
 * cluster needs a control-plane role, the cluster itself spanning ≥2 AZ
 * subnets (enforced by graph checks), a node role with the three managed
 * worker policies, and a managed node group. The emitter is self-contained;
 * pod-level wiring to an ALB (via the AWS Load Balancer Controller) is out of
 * scope, so EKS reaches data stores as a compute tier like ECS.
 */
export const eks: ResourceMeta = {
  type: 'eks',
  label: 'EKS Cluster',
  description: '관리형 쿠버네티스',
  category: 'compute',
  icon: Ship,
  color: 'text-blue-300',
  defaults: {
    k8s_version: '1.31',
    node_instance_type: 't3.medium',
  },
  // The control plane and node group span the VPC's subnets.
  allowedParents: ['vpc'],
  connectsTo: ['rds', 'dynamodb', 's3', 'elasticache', 'efs', 'sqs', 'sns'],
  fields: [
    {
      key: 'k8s_version',
      label: '쿠버네티스 버전',
      type: 'select',
      options: [
        { value: '1.31', label: '1.31' },
        { value: '1.30', label: '1.30' },
        { value: '1.29', label: '1.29' },
      ],
    },
    {
      key: 'node_instance_type',
      label: '노드 인스턴스 타입',
      type: 'select',
      options: [
        { value: 't3.medium', label: 't3.medium' },
        { value: 't3.large', label: 't3.large' },
        { value: 'm5.large', label: 'm5.large' },
      ],
    },
  ],
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const version = typeof config.k8s_version === 'string' ? config.k8s_version : '1.31'
    const instanceType =
      typeof config.node_instance_type === 'string' ? config.node_instance_type : 't3.medium'
    const subnetPool = refs.subnets ?? []
    const subnets = (subnetPool.length ? subnetPool : ['REPLACE_ME'])
      .map((s) => `aws_subnet.${s}.id`)
      .join(', ')
    // Worker nodes belong in PRIVATE subnets, not public ones (ADR 0055).
    const nodePool = refs.privateSubnets?.length ? refs.privateSubnets : subnetPool
    const nodeSubnets = (nodePool.length ? nodePool : ['REPLACE_ME'])
      .map((s) => `aws_subnet.${s}.id`)
      .join(', ')
    // Attached Security Groups (SG → eks edges) join the cluster ENIs so the
    // control plane / nodes can reach the data tier (ADR 0055).
    const clusterSgs = (refs.securityGroups ?? []).map((s) => `aws_security_group.${s}.id`)
    const clusterSgLine = clusterSgs.length
      ? `\n    security_group_ids = [${clusterSgs.join(', ')}]`
      : ''
    const clusterPrefix = `${awsName.slice(0, 20)}-c-`
    const nodePrefix = `${awsName.slice(0, 20)}-n-`
    return `resource "aws_iam_role" "${name}_cluster_role" {
  name_prefix = "${clusterPrefix}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "${name}_cluster_policy" {
  role       = aws_iam_role.${name}_cluster_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_eks_cluster" "${name}" {
  name     = "${awsName}"
  version  = "${version}"
  role_arn = aws_iam_role.${name}_cluster_role.arn
  vpc_config {
    subnet_ids = [${subnets}]${clusterSgLine}
  }
  depends_on = [aws_iam_role_policy_attachment.${name}_cluster_policy]
  tags = { Name = "${displayName}" }
}

resource "aws_iam_role" "${name}_node_role" {
  name_prefix = "${nodePrefix}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "${name}_node_worker" {
  role       = aws_iam_role.${name}_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "${name}_node_cni" {
  role       = aws_iam_role.${name}_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "${name}_node_ecr" {
  role       = aws_iam_role.${name}_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_eks_node_group" "${name}_nodes" {
  cluster_name    = aws_eks_cluster.${name}.name
  node_group_name = "${awsName}-nodes"
  node_role_arn   = aws_iam_role.${name}_node_role.arn
  subnet_ids      = [${nodeSubnets}]
  instance_types  = ["${instanceType}"]
  scaling_config {
    desired_size = 2
    max_size     = 3
    min_size     = 1
  }
  depends_on = [
    aws_iam_role_policy_attachment.${name}_node_worker,
    aws_iam_role_policy_attachment.${name}_node_cni,
    aws_iam_role_policy_attachment.${name}_node_ecr,
  ]
  tags = { Name = "${displayName}" }
}`
  },
}
