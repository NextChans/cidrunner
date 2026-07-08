import { Database } from 'lucide-react'
import type { ResourceMeta } from './types'
import { collect, validateRange } from './validators'

/** RDS — a managed relational database instance. */
export const rds: ResourceMeta = {
  type: 'rds',
  label: 'RDS Database',
  description: '관리형 관계형 DB',
  icon: Database,
  color: 'text-indigo-400',
  defaults: {
    engine: 'mysql',
    instance_class: 'db.t3.micro',
    allocated_storage: 20,
    multi_az: false,
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
    { key: 'instance_class', label: '인스턴스 클래스', type: 'text', placeholder: 'db.t3.micro' },
    { key: 'allocated_storage', label: '스토리지 (GiB)', type: 'number', min: 20, max: 65536 },
    { key: 'multi_az', label: 'Multi-AZ', type: 'boolean', help: '고가용성을 위한 다중 가용영역 배포' },
  ],
  validate: (c) => collect(validateRange(c.allocated_storage, 20, 65536, '스토리지')),
  terraform: ({ name, awsName, config }) => `resource "aws_db_instance" "${name}" {
  identifier          = "${awsName}"
  allocated_storage   = ${Number(config.allocated_storage ?? 20)}
  engine              = "${config.engine ?? 'mysql'}"
  instance_class      = "${config.instance_class ?? 'db.t3.micro'}"
  username            = "admin"
  password            = var.db_password
  multi_az            = ${config.multi_az ? 'true' : 'false'}
  skip_final_snapshot = true
}`,
}
