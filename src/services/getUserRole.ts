import { fetchFromTable } from "@/lib/db-service"

interface UserRoleRecord {
  role: string;
}

export async function getUserProjectRole(email: string, projectId: string) {
  const { data, error } = await fetchFromTable<UserRoleRecord>({
    table: 'pype_voice_email_project_mapping',
    select: 'role',
    filters: [
      { column: 'email', operator: 'eq', value: email },
      { column: 'project_id', operator: 'eq', value: projectId },
      { column: 'is_active', operator: 'eq', value: true }
    ],
    limit: 1
  })

  if (error || !data || data.length === 0 || !data[0]?.role) {
    return 'user'
  }
  return data[0].role
}
