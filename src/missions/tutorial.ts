import type { Mission } from './types'

export const tutorial: Mission = {
  id: 'tutorial',
  title: 'First VPC',
  description:
    'Drop a VPC onto the canvas and carve out a public subnet inside it. Learn how blocks nest.',
  goal: 'Place 1 VPC containing 1 public Subnet.',
  hint: 'A Subnet must sit inside a VPC to get a CIDR range.',
  requiredResources: ['vpc', 'subnet'],
}
