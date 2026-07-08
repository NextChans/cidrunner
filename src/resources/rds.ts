import { Database } from 'lucide-react'
import type { ResourceMeta } from './types'

/** RDS — a managed relational database instance. */
export const rds: ResourceMeta = {
  type: 'rds',
  label: 'RDS Database',
  description: 'Managed relational DB',
  icon: Database,
  color: 'text-indigo-400',
  defaults: {
    engine: 'mysql',
    instance_class: 'db.t3.micro',
    multi_az: false,
  },
  // Phase 4: emit aws_db_instance HCL.
  terraform: () => '',
}
