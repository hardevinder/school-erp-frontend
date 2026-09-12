// EduBridge: persistent branch selector helper
// - Removes "All Branches" from native branch dropdowns.
// - Remembers the last selected branch in localStorage.
// - Re-applies it after route changes / component remounts.
// - If no saved branch exists, selects the first real branch.
//
// This helper intentionally does not clear the branch on logout/login.
// The selection remains until the user chooses another branch.

const STORAGE_KEY = "edubridge:selectedBranchId";
const MARKER = "data-edubridge-branch-persist";
const ALL_BRANCHES_RE = /^\s*all\s+branches?\s*$/i;

const getOptions = (select) => Array.from(select?.options || []);

const isAllBranchesOption = (option) =>
  ALL_BRANCHES_RE.test(String(option?.textContent || option?.label || "").trim());

const realOptions = (select) =>
  getOptions(select).filter((option) => !isAllBranchesOption(option));

const findBranchSelects = () => {
  const all = Array.from(document.querySelectorAll("select"));

  return all.filter((select) => {
    if (select.hasAttribute(MARKER)) return true;
    return getOptions(select).some(isAllBranchesOption);
  });
};

const dispatchSelectionChange = (select) => {
  // React listens for bubbling change events on select elements.
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

const saveCurrentBranch = (select) => {
  const value = String(select.value ?? "").trim();
  const option = getOptions(select).find(
    (item) => String(item.value) === String(select.value)
  );

  if (!value || !option || isAllBranchesOption(option)) return;

  localStorage.setItem(STORAGE_KEY, value);
};

const removeAllBranchesOption = (select) => {
  getOptions(select)
    .filter(isAllBranchesOption)
    .forEach((option) => option.remove());
};

const ensurePersistentBranch = (select) => {
  if (!(select instanceof HTMLSelectElement)) return;

  select.setAttribute(MARKER, "1");

  // Read before removing the option so this also works when the page initially
  // renders with "All Branches" selected.
  const previouslySelected = String(select.value ?? "").trim();

  removeAllBranchesOption(select);

  const options = realOptions(select);
  if (!options.length) return;

  const saved = String(localStorage.getItem(STORAGE_KEY) || "").trim();

  const savedOption =
    saved &&
    options.find((option) => String(option.value) === String(saved));

  const currentOption = options.find(
    (option) =>
      String(option.value) === String(select.value) &&
      String(option.value).trim() !== ""
  );

  // Priority:
  // 1) last branch chosen by user
  // 2) branch already selected by the app
  // 3) first real branch
  const target =
    savedOption ||
    currentOption ||
    options.find((option) => String(option.value).trim() !== "") ||
    options[0];

  if (!target) return;

  const targetValue = String(target.value);

  if (String(select.value) !== targetValue || !previouslySelected) {
    select.value = targetValue;
    localStorage.setItem(STORAGE_KEY, targetValue);
    dispatchSelectionChange(select);
  } else {
    localStorage.setItem(STORAGE_KEY, targetValue);
  }

  if (select.dataset.edubridgeBranchListener !== "1") {
    select.dataset.edubridgeBranchListener = "1";

    select.addEventListener("change", () => {
      const chosen = getOptions(select).find(
        (option) => String(option.value) === String(select.value)
      );

      if (chosen && !isAllBranchesOption(chosen) && String(select.value).trim()) {
        localStorage.setItem(STORAGE_KEY, String(select.value));
      }
    });
  }
};

let scheduled = false;

const scan = () => {
  scheduled = false;
  findBranchSelects().forEach(ensurePersistentBranch);
};

const scheduleScan = () => {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(scan);
};

const start = () => {
  scan();

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Browser back/forward and SPA route changes can remount the header.
  window.addEventListener("popstate", scheduleScan);
  window.addEventListener("pageshow", scheduleScan);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}

export { STORAGE_KEY };
