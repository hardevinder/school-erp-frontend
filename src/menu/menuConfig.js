export const MENU = [
  { key:'dashboard', label:'Dashboard', path:'/dashboard', any:['fees.read','marks.edit','users.read'] },
  { key:'fees', label:'Fees', path:'/fees', any:['fees.read'] },
  { key:'fee-setup', label:'Fee Setup', path:'/fee-setup', all:['fees.write'] },
  { key:'users', label:'Users', path:'/users', any:['users.read'] },
  {
    key:'exams', label:'Examination', any:['exam.manage','marks.edit'], children:[
      { key:'exam-settings', label:'Settings', path:'/exam/settings', all:['exam.manage'] },
      { key:'marks-entry', label:'Marks Entry', path:'/exam/marks', any:['marks.edit'] },
    ]
  },
];

export const canSee = (perms, item) => {
  const anyOk = !item.any || item.any.some(p => perms.includes(p));
  const allOk = !item.all || item.all.every(p => perms.includes(p));
  return anyOk && allOk;
};

export const buildMenu = (perms, items) =>
  items
    .map(i => {
      if (!canSee(perms, i)) return null;
      const children = i.children ? buildMenu(perms, i.children) : undefined;
      return { ...i, children };
    })
    .filter(Boolean);
