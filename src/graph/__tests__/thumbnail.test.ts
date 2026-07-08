import { describe, expect, it } from 'vitest'
import { thumbnailBoxes } from '@/graph/thumbnail'
import { bestPracticeTopology, N } from './helpers'

describe('thumbnail', () => {
  it('returns no boxes for an empty design', () => {
    expect(thumbnailBoxes([])).toEqual([])
  })

  it('projects every node into the viewBox bounds', () => {
    const { nodes } = bestPracticeTopology()
    const boxes = thumbnailBoxes(nodes, 300, 200, 12)
    expect(boxes).toHaveLength(nodes.length)
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.x + b.w).toBeLessThanOrEqual(300 + 0.001)
      expect(b.y + b.h).toBeLessThanOrEqual(200 + 0.001)
      expect(b.w).toBeGreaterThan(0)
      expect(b.h).toBeGreaterThan(0)
    }
  })

  it('sorts largest boxes first so containers render beneath children', () => {
    const nodes = [
      { ...N('vpc-1', 'vpc'), style: { width: 480, height: 340 } },
      { ...N('subnet-1', 'subnet', 'vpc-1'), style: { width: 320, height: 190 } },
      N('ec2-1', 'ec2', 'subnet-1'),
    ]
    const boxes = thumbnailBoxes(nodes)
    for (let i = 1; i < boxes.length; i++) {
      const prev = boxes[i - 1]!
      const cur = boxes[i]!
      expect(prev.w * prev.h).toBeGreaterThanOrEqual(cur.w * cur.h)
    }
    // VPC (a container) is the largest, so it sorts to the front.
    expect(boxes[0]!.container).toBe(true)
  })

  it('resolves nested positions into absolute space (no negative offsets)', () => {
    // Child at a large parent-relative offset must still land inside the frame.
    const nodes = [
      { ...N('vpc-1', 'vpc'), position: { x: 100, y: 100 }, style: { width: 400, height: 300 } },
      { ...N('ec2-1', 'ec2', 'vpc-1'), position: { x: 300, y: 200 } },
    ]
    const boxes = thumbnailBoxes(nodes)
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeGreaterThanOrEqual(0)
    }
  })
})
