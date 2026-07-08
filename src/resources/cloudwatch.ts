import { Activity } from 'lucide-react'
import type { ResourceMeta, ResourceType } from './types'
import { collect, validateRange } from './validators'

/** Per-target metric an alarm watches, keyed by the monitored resource type. */
const ALARM_SPEC: Record<
  string,
  { namespace: string; metric: string; dimension: string; ref: string; comment: string }
> = {
  ec2: {
    namespace: 'AWS/EC2',
    metric: 'CPUUtilization',
    dimension: 'InstanceId',
    ref: 'aws_instance.$.id',
    comment: 'EC2 CPU 사용률',
  },
  rds: {
    namespace: 'AWS/RDS',
    metric: 'CPUUtilization',
    dimension: 'DBInstanceIdentifier',
    ref: 'aws_db_instance.$.identifier',
    comment: 'RDS CPU 사용률',
  },
  alb: {
    namespace: 'AWS/ApplicationELB',
    metric: 'HTTPCode_ELB_5XX_Count',
    dimension: 'LoadBalancer',
    ref: 'aws_lb.$.arn_suffix',
    comment: 'ALB 5XX 응답 수',
  },
  lambda: {
    namespace: 'AWS/Lambda',
    metric: 'Errors',
    dimension: 'FunctionName',
    ref: 'aws_lambda_function.$.function_name',
    comment: 'Lambda 오류 수',
  },
}

/**
 * CloudWatch — observability for the topology (ADR 0026). It always emits a log
 * group; a cloudwatch → resource edge is a *monitoring* attachment (like an SG
 * edge — not request traffic) that emits a metric alarm scoped to that
 * resource. Alarms carry no actions (an SNS topic would wire notifications).
 */
export const cloudwatch: ResourceMeta = {
  type: 'cloudwatch',
  label: 'CloudWatch',
  description: '모니터링 — 로그·지표·알람',
  category: 'management',
  icon: Activity,
  color: 'text-red-400',
  defaults: {
    retention_days: 30,
    threshold: 80,
  },
  // Regional service — not inside a VPC. Attach to resources by drawing an edge.
  allowedParents: ['canvas'],
  connectsTo: ['ec2', 'rds', 'alb', 'lambda'],
  fields: [
    {
      key: 'retention_days',
      label: '로그 보관 기간 (일)',
      type: 'number',
      min: 1,
      max: 3653,
    },
    {
      key: 'threshold',
      label: '알람 임계값',
      type: 'number',
      min: 1,
      max: 100000,
      help: '연결한 리소스의 지표가 이 값을 넘으면 알람',
    },
  ],
  validate: (c) =>
    collect(
      validateRange(c.retention_days, 1, 3653, '로그 보관 기간'),
      validateRange(c.threshold, 1, 100000, '알람 임계값'),
    ),
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const threshold = Number(config.threshold ?? 80)
    const alarms = (refs.monitorTargets ?? [])
      .map(({ kind, name: target }: { kind: ResourceType; name: string }) => {
        const spec = ALARM_SPEC[kind]
        if (!spec) return ''
        return `

resource "aws_cloudwatch_metric_alarm" "${name}_${target}" {
  alarm_name          = "${awsName}-${target}"
  alarm_description   = "${spec.comment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "${spec.metric}"
  namespace           = "${spec.namespace}"
  period              = 300
  statistic           = "Average"
  threshold           = ${threshold}
  dimensions = {
    ${spec.dimension} = ${spec.ref.replace('$', target)}
  }
  tags = { Name = "${displayName}" }
}`
      })
      .join('')
    return `resource "aws_cloudwatch_log_group" "${name}" {
  name              = "/cidrunner/${awsName}"
  retention_in_days = ${Number(config.retention_days ?? 30)}
  tags = { Name = "${displayName}" }
}${alarms}`
  },
}
