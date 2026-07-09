import type { Mission } from './types'
import { liveChain, scopedSecurityOk } from './scope'

export const dataPipeline: Mission = {
  id: 'data-pipeline',
  title: '데이터 파이프라인',
  description:
    '실시간 이벤트를 스트림으로 수집해 가공한 뒤 원본 저장소에 적재합니다: Kinesis 스트림을 Lambda 컨슈머가 소비하고, 그 결과를 S3에 저장합니다.',
  goal: 'Kinesis → Lambda → S3 로 스트림 데이터가 저장되게 하세요.',
  hint: 'Kinesis Data Stream이 파이프라인의 진입점입니다. 스트림에서 Lambda로 엣지를 잇고, Lambda에서 S3로 이으세요. S3 암호화·퍼블릭 차단이 켜져 있으면 별 3개!',
  requiredResources: ['kinesis', 'lambda', 's3'],
  // ★1 Kinesis→Lambda→S3 도달 · ★2 설정 오류 없음 · ★3 보안 경고 0
  check: (ctx) => {
    const chain = liveChain(ctx, ['kinesis', 'lambda', 's3'])
    if (!chain) return 0
    let stars = 1
    if (ctx.allValid) stars += 1
    if (scopedSecurityOk(ctx, chain)) stars += 1
    return stars
  },
}
