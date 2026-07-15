# 0066. Kinesis 다운스트림 — 소비(Lambda) vs Firehose 전송(S3)을 케이스별로

- Status: Accepted
- Date: 2026-07-15
- Deciders: 차니, Claude

## Context

Kinesis 블록은 지금까지 `connectsTo: ['lambda']` 한 가지만 모델링했고,
`checks.ts`는 **무조건** "스트림을 소비할 Lambda가 연결되어 있지 않습니다"
경고를 띄웠다. 하지만 실제 AWS에서 스트림 데이터의 다운스트림은 두 가지다:

- **Kinesis Data Stream** — Lambda 컨슈머가 레코드를 처리(event source mapping).
- **Kinesis Data Firehose** — 소비자 없이 S3 등으로 **자동 전송**.

차니 지적: "Firehose로 볼 경우 소비자 불요(S3로 자동 전송)인데, 지금은 무조건
Lambda가 없다고 경고가 뜬다. 케이스에 따라 달라야 하지 않나?" — 맞다. 경고가
토폴로지와 무관하게 항상 켜지는 건 오탐이다.

## Decision

**다운스트림을 엣지로 추론한다 — `kinesis → lambda`는 소비, `kinesis → s3`는
Firehose 전송.** (앱이 이미 토폴로지에서 동작을 추론하는 방식 — cloudtrail→s3,
apigw→lambda 등 — 과 일관.)

- **엣지 규칙**: `kinesis.connectsTo`를 `['lambda', 's3']`로 확장. 둘 다 그릴 수
  있고 공존 가능(스트림을 Lambda가 소비하면서 동시에 S3로도 전송).
- **경고**: 스트림에 Lambda 소비자 **또는** S3 전송 대상이 **하나도** 없을 때만
  경고. 문구도 "Lambda 소비자 또는 S3 전송"으로 갱신. simulate의 막힘 메시지도 동일.
- **Terraform(apply-ready)**: `kinesis → s3` 엣지가 있으면 `refs.deliveryBucket`을
  통해 **`aws_kinesis_firehose_delivery_stream`**(destination=`extended_s3`,
  `kinesis_source_configuration`로 스트림 소비 + `extended_s3_configuration`로
  버킷 전송) + 스트림 읽기·S3 쓰기 권한을 가진 **Firehose IAM role**을 함께 emit.
  기존 `kinesis → lambda`의 event source mapping은 그대로.
- **시뮬레이션**: 무변경으로 자동 해결 — kinesis는 이미 entry, s3는 sink라
  `kinesis → s3`가 완결 플로우로 추적된다(파티클·사운드 자연 재생).

## Consequences

- **좋은 점**: 경고 오탐 제거. Firehose 전송 파이프라인이 apply-ready TF로 완성되고
  라이브 시뮬에서 완결 플로우로 보인다. 엣지 추론이라 새 필드·마이그레이션 없음.
- **나쁜 점 / 한계**: 게임 단순화상 Firehose는 별도 블록이 아니라 `kinesis → s3`
  엣지로 표현된다(실제 AWS의 독립 서비스와 1:1은 아님). Firehose 목적지는 S3만
  (Redshift/OpenSearch 등은 미지원). 버퍼링·변환·압축 옵션은 기본값.
- data-pipeline 미션은 여전히 `Kinesis → Lambda → S3` 체인을 요구하므로 직행
  `kinesis → s3`로는 클리어되지 않는다(회귀 없음).
