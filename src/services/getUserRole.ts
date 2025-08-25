interface UserRoleRecord {
  role: string;
}

export async function getUserProjectRole(email: string, projectId: string) {
  try {
    const response = await fetch('/api/overview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        table: 'pype_voice_email_project_mapping',
        select: 'role',
        filters: [
          { column: 'email', operator: 'eq', value: email },
          { column: 'project_id', operator: 'eq', value: projectId },
          { column: 'is_active', operator: 'eq', value: true }
        ],
        limit: 1
      })
    });

    if (!response.ok) {
      console.error('Failed to fetch user role:', response.statusText);
      return 'user';
    }

    const result = await response.json();
    
    if (result.error || !result.data || result.data.length === 0 || !result.data[0]?.role) {
      return 'user';
    }
    
    return result.data[0].role;
  } catch (error) {
    console.error('Error fetching user role:', error);
    return 'user';
  }
}
