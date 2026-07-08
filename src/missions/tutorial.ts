import type { Mission } from './types'

export const tutorial: Mission = {
  id: 'tutorial',
  title: '첫 VPC 만들기',
  description:
    '캔버스에 VPC를 놓고 그 안에 퍼블릭 Subnet을 만들어 보세요. 블록이 어떻게 중첩되는지 배웁니다.',
  goal: 'VPC 1개 안에 퍼블릭 Subnet 1개를 배치하세요.',
  hint: 'Subnet은 VPC 안에 있어야 CIDR 범위를 할당받습니다.',
  requiredResources: ['vpc', 'subnet'],
}
