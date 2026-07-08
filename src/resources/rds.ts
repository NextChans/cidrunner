import { Database } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateRange } from './validators'

/** RDS — a managed relational database instance. */
export const rds: ResourceMeta = {
  type: 'rds',
  label: 'RDS Database',
  description: '관리형 관계형 DB (2개 AZ Subnet 필요)',
  category: 'database',
  icon: Database,
  color: 'text-indigo-400',
  defaults: {
    engine: 'mysql',
    instance_class: 'db.t3.micro',
    allocated_storage: 20,
    multi_az: false,
    storage_encrypted: true,
  },
  // Databases live inside a (private) subnet.
  allowedParents: ['subnet'],
  fields: [
    {
      key: 'engine',
      label: '엔진',
      type: 'select',
      options: [
        { value: 'mysql', label: 'MySQL' },
        { value: 'postgres', label: 'PostgreSQL' },
        { value: 'mariadb', label: 'MariaDB' },
      ],
    },
    {
      key: 'instance_class',
      label: '인스턴스 클래스',
      type: 'text',
      required: true,
      placeholder: 'db.t3.micro',
    },
    { key: 'allocated_storage', label: '스토리지 (GiB)', type: 'number', min: 20, max: 65536 },
    { key: 'multi_az', label: 'Multi-AZ', type: 'boolean', help: '고가용성을 위한 다중 가용영역 배포' },
    {
      key: 'storage_encrypted',
      label: '스토리지 암호화',
      type: 'boolean',
      help: '끄면 보안 경고가 발생합니다',
    },
  ],
  validate: (c) => collect(validateRange(c.allocated_storage, 20, 65536, '스토리지')),
  // The generator emits an aws_db_subnet_group per VPC that hosts an RDS.
  terraform: ({ name, awsName, config, refs, displayName }) => {
    const sgs = (refs.securityGroups ?? []).map((s) => `aws_security_group.${s}.id`)
    const sgLine = sgs.length ? `\n  vpc_security_group_ids = [${sgs.join(', ')}]` : ''
    const subnetGroup = refs.vpc ? `\n  db_subnet_group_name = aws_db_subnet_group.${refs.vpc}_dbsg.name` : ''
    return `resource "aws_db_instance" "${name}" {
  identifier          = "${awsName}"
  allocated_storage   = ${Number(config.allocated_storage ?? 20)}
  engine              = "${config.engine ?? 'mysql'}"
  instance_class      = "${config.instance_class ?? 'db.t3.micro'}"
  username            = "dbadmin"
  password            = var.db_password
  multi_az            = ${config.multi_az ? 'true' : 'false'}
  storage_encrypted   = ${config.storage_encrypted === false ? 'false' : 'true'}
  publicly_accessible = false
  skip_final_snapshot = true${subnetGroup}${sgLine}
  tags = { Name = "${displayName}" }
}`
  },
}
