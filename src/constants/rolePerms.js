export const ROLE_PERMS = {
  superadmin: ['users.read','users.write','fees.read','fees.write','exam.manage'],
  admin: ['users.read','fees.read','fees.write','exam.manage'],
  academic_coordinator: ['fees.read','marks.review'],
  teacher: ['fees.read','marks.edit'],
  department_hod: ['department.view','department.manage','inventory.view','tasks.manage','events.manage','achievements.manage','academics.review'],
  student: ['fees.read.self'],
};
