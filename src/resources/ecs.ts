import { Container } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateRange } from './validators'

/** Fargate cpu → allowed memory floors (AWS pairs them). We pick the floor. */
const FARGATE_MEMORY: Record<string, string> = {
  '256': '512',
  '512': '1024',
  '1024': '2048',
}

/**
 * ECS on Fargate — a serverless container workload heavier than Lambda but
 * without the cluster-management surface of EKS (ADR 0026). The emitter is
 * self-contained and apply-ready: a cluster, an execution role, a task
 * definition running a public nginx image, and a Fargate service placed in the
 * VPC's subnets. It reaches data stores like any other compute tier.
 */
export const ecs: ResourceMeta = {
  type: 'ecs',
  label: 'ECS Fargate',
  description: '서버리스 컨테이너 워크로드',
  category: 'compute',
  icon: Container,
  color: 'text-orange-300',
  defaults: {
    cpu: '256',
    desired_count: 2,
  },
  // Runs in a VPC's subnets, like an ALB — not itself a container for nodes.
  allowedParents: ['vpc'],
  connectsTo: ['rds', 'dynamodb', 's3', 'elasticache', 'efs', 'sqs', 'sns'],
  fields: [
    {
      key: 'cpu',
      label: 'Task CPU',
      type: 'select',
      options: [
        { value: '256', label: '0.25 vCPU' },
        { value: '512', label: '0.5 vCPU' },
        { value: '1024', label: '1 vCPU' },
      ],
    },
    {
      key: 'desired_count',
      label: '태스크 수',
      type: 'number',
      min: 1,
      max: 100,
    },
  ],
  validate: (c) => collect(validateRange(c.desired_count, 1, 100, '태스크 수')),
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const cpu = typeof config.cpu === 'string' && config.cpu in FARGATE_MEMORY ? config.cpu : '256'
    const memory = FARGATE_MEMORY[cpu] ?? '512'
    const sgs = (refs.securityGroups ?? []).map((s) => `aws_security_group.${s}.id`)
    const sgLine = sgs.length ? `\n    security_groups  = [${sgs.join(', ')}]` : ''
    const subnetPool = refs.privateSubnets?.length ? refs.privateSubnets : (refs.subnets ?? [])
    const subnets = (subnetPool.length ? subnetPool : ['REPLACE_ME'])
      .map((s) => `aws_subnet.${s}.id`)
      .join(', ')
    const rolePrefix = `${awsName.slice(0, 24)}-`
    return `resource "aws_ecs_cluster" "${name}" {
  name = "${awsName}"
  tags = { Name = "${displayName}" }
}

resource "aws_iam_role" "${name}_exec" {
  name_prefix = "${rolePrefix}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "${name}_exec_policy" {
  role       = aws_iam_role.${name}_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_ecs_task_definition" "${name}_task" {
  family                   = "${awsName}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "${cpu}"
  memory                   = "${memory}"
  execution_role_arn       = aws_iam_role.${name}_exec.arn
  container_definitions = jsonencode([{
    name      = "app"
    image     = "public.ecr.aws/nginx/nginx:stable"
    essential = true
    portMappings = [{ containerPort = 80, protocol = "tcp" }]
  }])
}

resource "aws_ecs_service" "${name}_svc" {
  name            = "${awsName}-svc"
  cluster         = aws_ecs_cluster.${name}.id
  task_definition = aws_ecs_task_definition.${name}_task.arn
  desired_count   = ${Number(config.desired_count ?? 2)}
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = [${subnets}]${sgLine}
    assign_public_ip = true
  }
}`
  },
}
