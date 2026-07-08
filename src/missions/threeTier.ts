import type { Mission } from './types'

export const threeTier: Mission = {
  id: 'three-tier',
  title: 'Highly Available 3-Tier Web',
  description:
    'Build a classic web tier: an ALB in public subnets fronting EC2 app servers, backed by a multi-AZ RDS database.',
  goal: 'Route client → ALB → EC2 → RDS with traffic reaching the DB.',
  hint: 'Spread subnets across two AZs and let a Security Group allow ALB → EC2 → RDS.',
  requiredResources: ['vpc', 'subnet', 'igw', 'alb', 'ec2', 'rds', 'sg'],
}
