import { useCallback, useEffect, useRef, useState } from "react";

export const WORKSPACE_STORAGE_KEY = "edubridge.activeWorkspace";
export const WORKSPACE_EVENT = "edubridge:workspace-change";

const normalizeWorkspace = (value, fallback = "ERP") =>
  value === "LMS" || value === "ERP" ? value : fallback;

export function defaultWorkspaceForRole(role = "") {
  const normalized = String(role || "").toLowerCase();
  if (["teacher", "student", "academic_coordinator", "coordinator", "department_hod"].includes(normalized)) {
    return "LMS";
  }
  return "ERP";
}

export function useWorkspace(defaultWorkspace = "ERP") {
  const fallback = normalizeWorkspace(defaultWorkspace);
  const hasSavedPreference = useRef(
    typeof window !== "undefined" && Boolean(window.localStorage.getItem(WORKSPACE_STORAGE_KEY))
  );
  const [workspace, setWorkspaceState] = useState(() => {
    if (typeof window === "undefined") return fallback;
    return normalizeWorkspace(window.localStorage.getItem(WORKSPACE_STORAGE_KEY), fallback);
  });

  useEffect(() => {
    if (!hasSavedPreference.current) setWorkspaceState(fallback);
  }, [fallback]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onWorkspaceChange = (event) => {
      hasSavedPreference.current = true;
      const next = normalizeWorkspace(event?.detail?.workspace, fallback);
      setWorkspaceState(next);
    };

    const onStorage = (event) => {
      if (event.key !== WORKSPACE_STORAGE_KEY) return;
      hasSavedPreference.current = Boolean(event.newValue);
      setWorkspaceState(normalizeWorkspace(event.newValue, fallback));
    };

    window.addEventListener(WORKSPACE_EVENT, onWorkspaceChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WORKSPACE_EVENT, onWorkspaceChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [fallback]);

  const setWorkspace = useCallback((nextValue) => {
    const next = normalizeWorkspace(nextValue, fallback);

    hasSavedPreference.current = true;
    setWorkspaceState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent(WORKSPACE_EVENT, { detail: { workspace: next } }));
    }
  }, [fallback]);

  return { workspace, setWorkspace };
}
