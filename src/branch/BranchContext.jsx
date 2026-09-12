import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../api";

export const BRANCH_STORAGE_KEY = "edubridgeActiveBranchId";
export const BRANCH_CHANGED_EVENT = "edubridge:branch-changed";

const BranchContext = createContext({
  branches: [],
  activeBranchId: null,
  activeBranch: null,
  allowAllBranches: false,
  allBranches: true,
  loading: true,
  setActiveBranch: () => {},
  refreshBranches: async () => {},
});

const readStored = () => {
  const raw = localStorage.getItem(BRANCH_STORAGE_KEY);
  if (!raw) return null;
  if (raw === "all") return "all";
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([]);
  const [allowAllBranches, setAllowAllBranches] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState(readStored);
  const [loading, setLoading] = useState(true);

  const refreshBranches = useCallback(async () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return [];
    }

    try {
      const { data } = await api.get("/branches", { headers: { "X-Skip-Branch": "1" } });
      const rows = Array.isArray(data?.branches) ? data.branches : [];
      const allowAll = Boolean(data?.allow_all);
      setBranches(rows);
      setAllowAllBranches(allowAll);

      const stored = readStored();
      const storedExists = stored === "all"
        ? allowAll
        : rows.some((b) => Number(b.id) === Number(stored));

      if (storedExists) {
        setActiveBranchId(stored);
      } else {
        const preferred = rows.find((b) => b.is_default) || rows[0] || null;
        if (preferred) {
          localStorage.setItem(BRANCH_STORAGE_KEY, String(preferred.id));
          setActiveBranchId(Number(preferred.id));
        } else if (allowAll) {
          localStorage.setItem(BRANCH_STORAGE_KEY, "all");
          setActiveBranchId("all");
        } else {
          localStorage.removeItem(BRANCH_STORAGE_KEY);
          setActiveBranchId(null);
        }
      }
      return rows;
    } catch (error) {
      console.warn("Unable to load branches:", error?.response?.data || error?.message || error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBranches();
    const onRefresh = () => refreshBranches();
    window.addEventListener("edubridge:branches-refresh", onRefresh);
    return () => window.removeEventListener("edubridge:branches-refresh", onRefresh);
  }, [refreshBranches]);

  const setActiveBranch = useCallback((value) => {
    const normalized = value === "all" ? "all" : Number(value);
    if (normalized !== "all" && (!Number.isInteger(normalized) || normalized <= 0)) return;
    localStorage.setItem(BRANCH_STORAGE_KEY, String(normalized));
    setActiveBranchId(normalized);
    window.dispatchEvent(
      new CustomEvent(BRANCH_CHANGED_EVENT, { detail: { branchId: normalized } })
    );
  }, []);

  const activeBranch = useMemo(
    () => branches.find((b) => Number(b.id) === Number(activeBranchId)) || null,
    [branches, activeBranchId]
  );
  const allBranches = activeBranchId === "all" || activeBranchId === null;

  const value = useMemo(
    () => ({
      branches,
      activeBranchId,
      activeBranch,
      allowAllBranches,
      allBranches,
      loading,
      setActiveBranch,
      refreshBranches,
    }),
    [branches, activeBranchId, activeBranch, allowAllBranches, allBranches, loading, setActiveBranch, refreshBranches]
  );

  // Prevent dashboard/pages from firing unscoped requests before the initial
  // branch selection is ready. Navbar is small enough that this is barely visible.
  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <div className="text-center text-muted">
          <div className="spinner-border spinner-border-sm mb-2" role="status" aria-hidden="true" />
          <div className="small">Loading institution workspace…</div>
        </div>
      </div>
    );
  }

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export const useBranch = () => useContext(BranchContext);
