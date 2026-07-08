import type { Mission } from './types'

export const threeTier: Mission = {
  id: 'three-tier',
  title: '고가용성 3-tier 웹',
  description:
    '전형적인 웹 계층을 구성합니다: 퍼블릭 Subnet의 ALB가 EC2 애플리케이션 서버로 트래픽을 보내고, 뒤에는 다중 AZ RDS 데이터베이스가 있습니다.',
  goal: '클라이언트 → ALB → EC2 → RDS 로 트래픽이 DB까지 도달하게 하세요.',
  hint: 'Subnet을 두 개의 AZ에 걸쳐 배치하고, Security Group으로 ALB → EC2 → RDS 통신을 허용하세요.',
  requiredResources: ['vpc', 'subnet', 'igw', 'alb', 'ec2', 'rds', 'sg'],
}
