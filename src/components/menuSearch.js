/** Search only the accessible menu items supplied by the sidebar. */
export function searchMenuItems(items, query) {
  const search = query.trim().toLowerCase();
  if (!search) return [];
  const tokens = search.split(/\s+/);
  const matches = items.filter((item) => item.path && tokens.every((token) =>
    `${item.label || ""} ${item.group || ""} ${item.path} ${item.workspace || ""}`.toLowerCase().includes(token)
  ));
  const score = (item) => {
    const label = (item.label || "").toLowerCase();
    return (label === search ? 100 : 0) + (label.startsWith(search) ? 50 : 0) + (label.includes(search) ? 25 : 0);
  };
  const seen = new Set();
  return matches.sort((a, b) => score(b) - score(a) || (a.label || "").localeCompare(b.label || "")).filter((item) => {
    if (seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
}
