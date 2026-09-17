import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import api from "../../api";
import "./CustomizableDashboard.css";

const DashboardLayoutContext = createContext(null);
const EMPTY_LAYOUT = Object.freeze({ version: 1, sections: [], cards: {} });

const cloneLayout = (value) => {
  try {
    return JSON.parse(JSON.stringify(value || EMPTY_LAYOUT));
  } catch {
    return { version: 1, sections: [], cards: {} };
  }
};

const normalizeLayout = (value) => ({
  version: 1,
  sections: Array.isArray(value?.sections) ? value.sections : [],
  cards: value?.cards && typeof value.cards === "object" ? value.cards : {},
});

const mergeOrder = (saved = [], current = []) => {
  const currentSet = new Set(current);
  const ordered = saved.filter((id) => currentSet.has(id));
  current.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  return ordered;
};

export function DashboardLayoutProvider({
  dashboardKey = "admin_erp",
  canCustomize = false,
  children,
}) {
  const cacheKey = `edubridge.dashboard-layout.${dashboardKey}`;
  const [savedLayout, setSavedLayout] = useState(EMPTY_LAYOUT);
  const [draftLayout, setDraftLayout] = useState(EMPTY_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/dashboard-layouts/me", {
          params: { dashboard_key: dashboardKey },
        });
        const normalized = normalizeLayout(data?.layout || EMPTY_LAYOUT);
        if (!mounted) return;
        setSavedLayout(normalized);
        setDraftLayout(cloneLayout(normalized));
        try {
          localStorage.setItem(cacheKey, JSON.stringify(normalized));
        } catch {}
      } catch (error) {
        let cached = EMPTY_LAYOUT;
        try {
          cached = normalizeLayout(JSON.parse(localStorage.getItem(cacheKey) || "null"));
        } catch {}
        if (mounted) {
          setSavedLayout(cached);
          setDraftLayout(cloneLayout(cached));
          setStatus("Using cached dashboard layout; server layout could not be loaded.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [dashboardKey, cacheKey]);

  const activeLayout = editing ? draftLayout : savedLayout;

  const patchDraft = useCallback((updater) => {
    setDraftLayout((previous) => normalizeLayout(updater(cloneLayout(previous))));
  }, []);

  const setSectionOrder = useCallback(
    (sections) => patchDraft((layout) => ({ ...layout, sections })),
    [patchDraft]
  );

  const updateCardConfig = useCallback(
    (sectionId, updater) => {
      patchDraft((layout) => {
        const current = layout.cards?.[sectionId] || { order: [], spans: {}, heights: {}, hidden: [] };
        return {
          ...layout,
          cards: {
            ...layout.cards,
            [sectionId]: updater({
              order: Array.isArray(current.order) ? current.order : [],
              spans: current.spans && typeof current.spans === "object" ? current.spans : {},
              heights: current.heights && typeof current.heights === "object" ? current.heights : {},
              hidden: Array.isArray(current.hidden) ? current.hidden : [],
            }),
          },
        };
      });
    },
    [patchDraft]
  );

  const startEditing = useCallback(() => {
    if (!canCustomize) return;
    setDraftLayout(cloneLayout(savedLayout));
    setStatus("");
    setEditing(true);
  }, [canCustomize, savedLayout]);

  const cancelEditing = useCallback(() => {
    setDraftLayout(cloneLayout(savedLayout));
    setEditing(false);
    setStatus("");
  }, [savedLayout]);

  const saveLayout = useCallback(async () => {
    if (!canCustomize || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const normalized = normalizeLayout(draftLayout);
      const { data } = await api.put("/dashboard-layouts/me", {
        dashboard_key: dashboardKey,
        layout: normalized,
      });
      const saved = normalizeLayout(data?.layout || normalized);
      setSavedLayout(saved);
      setDraftLayout(cloneLayout(saved));
      setEditing(false);
      setStatus("Dashboard layout saved.");
      try {
        localStorage.setItem(cacheKey, JSON.stringify(saved));
      } catch {}
    } catch (error) {
      setStatus(error?.response?.data?.message || "Could not save dashboard layout.");
    } finally {
      setSaving(false);
    }
  }, [canCustomize, saving, draftLayout, dashboardKey, cacheKey]);

  const resetLayout = useCallback(async () => {
    if (!canCustomize || saving) return;
    if (!window.confirm("Reset dashboard arrangement and card sizes to the default layout?")) return;
    setSaving(true);
    setStatus("");
    try {
      await api.delete("/dashboard-layouts/me", {
        params: { dashboard_key: dashboardKey },
      });
      const empty = { version: 1, sections: [], cards: {} };
      setSavedLayout(empty);
      setDraftLayout(cloneLayout(empty));
      setEditing(false);
      setStatus("Dashboard reset to default.");
      try {
        localStorage.removeItem(cacheKey);
      } catch {}
    } catch (error) {
      setStatus(error?.response?.data?.message || "Could not reset dashboard layout.");
    } finally {
      setSaving(false);
    }
  }, [canCustomize, saving, dashboardKey, cacheKey]);

  const value = useMemo(
    () => ({
      canCustomize,
      editing,
      loading,
      saving,
      status,
      layout: activeLayout,
      startEditing,
      cancelEditing,
      saveLayout,
      resetLayout,
      setSectionOrder,
      updateCardConfig,
    }),
    [
      canCustomize,
      editing,
      loading,
      saving,
      status,
      activeLayout,
      startEditing,
      cancelEditing,
      saveLayout,
      resetLayout,
      setSectionOrder,
      updateCardConfig,
    ]
  );

  return (
    <DashboardLayoutContext.Provider value={value}>
      {children}
    </DashboardLayoutContext.Provider>
  );
}

export function useDashboardLayout() {
  const context = useContext(DashboardLayoutContext);
  if (!context) throw new Error("Dashboard layout components must be inside DashboardLayoutProvider");
  return context;
}

export function DashboardCustomizeToolbar({ className = "" }) {
  const {
    canCustomize,
    editing,
    loading,
    saving,
    status,
    startEditing,
    cancelEditing,
    saveLayout,
    resetLayout,
  } = useDashboardLayout();

  if (!canCustomize) return null;

  return (
    <div className={`dashboard-customize-toolbar ${className}`.trim()}>
      {!editing ? (
        <button
          type="button"
          className="btn btn-outline-primary shadow-sm"
          onClick={startEditing}
          disabled={loading}
        >
          <i className="bi bi-grid-3x3-gap me-1" /> Customize Dashboard
        </button>
      ) : (
        <>
          <span className="dashboard-customize-hint d-none d-xl-inline">
            Drag sections/cards • resize from the bottom-right corner
          </span>
          <button type="button" className="btn btn-primary shadow-sm" onClick={saveLayout} disabled={saving}>
            <i className="bi bi-check2-circle me-1" /> {saving ? "Saving…" : "Save Layout"}
          </button>
          <button type="button" className="btn btn-outline-secondary shadow-sm" onClick={cancelEditing} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-outline-danger shadow-sm" onClick={resetLayout} disabled={saving}>
            <i className="bi bi-arrow-counterclockwise me-1" /> Reset
          </button>
        </>
      )}
      {status ? <span className="dashboard-customize-status">{status}</span> : null}
    </div>
  );
}

export function DashboardSection({ children }) {
  return <>{children}</>;
}

function SortableSection({ id, editing, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  });

  return (
    <div
      ref={setNodeRef}
      className={`dashboard-sortable-section ${editing ? "is-editing" : ""} ${isDragging ? "is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {editing ? (
        <div className="dashboard-section-editbar">
          <button
            type="button"
            className="dashboard-drag-button"
            title="Drag this whole section"
            aria-label="Drag this whole dashboard section"
            {...attributes}
            {...listeners}
          >
            <i className="bi bi-grip-horizontal" />
            <span>Move section</span>
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function DashboardSectionStack({ children }) {
  const { editing, layout, setSectionOrder } = useDashboardLayout();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }));
  const items = React.Children.toArray(children).filter(Boolean);
  const map = new Map();
  items.forEach((child, index) => {
    const id = child?.props?.sectionId || child?.key || `section-${index}`;
    map.set(String(id), child);
  });
  const ids = [...map.keys()];
  const orderedIds = mergeOrder(layout.sections, ids);

  const onDragEnd = ({ active, over }) => {
    if (!editing || !over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setSectionOrder(arrayMove(orderedIds, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
        <div className="dashboard-section-stack">
          {orderedIds.map((id) => (
            <SortableSection key={id} id={id} editing={editing}>
              {map.get(id)}
            </SortableSection>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableGridItem({
  id,
  sectionId,
  span,
  height,
  minSpan,
  maxSpan,
  hidden,
  editing,
  containerRef,
  onResize,
  onToggleHidden,
  children,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  });
  const resizeRef = useRef(null);

  const startResize = (event) => {
    if (!editing || window.innerWidth < 768) return;
    event.preventDefault();
    event.stopPropagation();
    const element = containerRef.current;
    const cardElement = event.currentTarget.closest(".dashboard-custom-grid-item");
    if (!element || !cardElement) return;
    const rect = element.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startSpan = span;
    const startHeight = height || cardRect.height;
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture?.(pointerId);

    const move = (moveEvent) => {
      const columnWidth = Math.max(rect.width / 12, 1);
      const deltaColumns = Math.round((moveEvent.clientX - startX) / columnWidth);
      const nextSpan = Math.max(minSpan, Math.min(maxSpan, startSpan + deltaColumns));
      const rawHeight = startHeight + (moveEvent.clientY - startY);
      const nextHeight = Math.max(160, Math.min(1000, Math.round(rawHeight / 20) * 20));
      onResize(nextSpan, nextHeight);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });
  };

  if (hidden && !editing) return null;

  return (
    <div
      ref={setNodeRef}
      className={`dashboard-custom-grid-item ${editing ? "is-editing" : ""} ${hidden ? "is-hidden-card" : ""} ${isDragging ? "is-dragging" : ""}`}
      style={{
        gridColumn: `span ${span}`,
        height: height ? `${height}px` : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      data-card-id={id}
      data-section-id={sectionId}
    >
      {editing ? (
        <div className="dashboard-card-editbar">
          <button
            type="button"
            className="dashboard-card-drag"
            title="Drag card"
            aria-label="Drag dashboard card"
            {...attributes}
            {...listeners}
          >
            <i className="bi bi-grip-vertical" />
          </button>
          <span className="dashboard-card-size">{span}/12{height ? ` • ${height}px` : ""}</span>
          <button
            type="button"
            className="dashboard-card-visibility"
            onClick={() => onToggleHidden(id)}
            title={hidden ? "Show card" : "Hide card"}
            aria-label={hidden ? "Show dashboard card" : "Hide dashboard card"}
          >
            <i className={`bi ${hidden ? "bi-eye" : "bi-eye-slash"}`} />
          </button>
        </div>
      ) : null}
      <div className="dashboard-custom-grid-content">{children}</div>
      {editing && !hidden ? (
        <button
          ref={resizeRef}
          type="button"
          className="dashboard-card-resize"
          onPointerDown={startResize}
          title="Drag to resize card"
          aria-label="Resize dashboard card"
        >
          <i className="bi bi-arrows-angle-expand" />
        </button>
      ) : null}
    </div>
  );
}

export function DashboardGrid({ sectionId, children, className = "", gap = 16 }) {
  const { editing, layout, updateCardConfig } = useDashboardLayout();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }));
  const containerRef = useRef(null);
  const childArray = React.Children.toArray(children).filter(Boolean);

  const meta = childArray.map((child, index) => {
    const id = String(
      child?.props?.dashboardCardId ||
        child?.props?.["data-dashboard-card-id"] ||
        child?.key ||
        `${sectionId}-card-${index}`
    );
    const defaultSpan = Math.max(
      1,
      Math.min(12, Number(child?.props?.dashboardDefaultSpan || child?.props?.["data-dashboard-default-span"] || 12))
    );
    const minSpan = Math.max(1, Math.min(12, Number(child?.props?.dashboardMinSpan || child?.props?.["data-dashboard-min-span"] || 2)));
    const maxSpan = Math.max(minSpan, Math.min(12, Number(child?.props?.dashboardMaxSpan || child?.props?.["data-dashboard-max-span"] || 12)));
    return { id, child, defaultSpan, minSpan, maxSpan };
  });

  const ids = meta.map((item) => item.id);
  const map = new Map(meta.map((item) => [item.id, item]));
  const config = layout.cards?.[sectionId] || {};
  const orderedIds = mergeOrder(config.order, ids);
  const hidden = new Set(Array.isArray(config.hidden) ? config.hidden : []);

  const update = (updater) => updateCardConfig(sectionId, updater);

  const onDragEnd = ({ active, over }) => {
    if (!editing || !over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    update((current) => ({ ...current, order: arrayMove(orderedIds, oldIndex, newIndex) }));
  };

  const setSize = (id, nextSpan, nextHeight) => {
    update((current) => ({
      ...current,
      order: current.order?.length ? current.order : orderedIds,
      spans: { ...(current.spans || {}), [id]: nextSpan },
      heights: { ...(current.heights || {}), [id]: nextHeight },
    }));
  };

  const toggleHidden = (id) => {
    update((current) => {
      const set = new Set(current.hidden || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return {
        ...current,
        order: current.order?.length ? current.order : orderedIds,
        hidden: [...set],
      };
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
        <div
          ref={containerRef}
          className={`dashboard-custom-grid ${className}`.trim()}
          style={{ gap }}
        >
          {orderedIds.map((id) => {
            const item = map.get(id);
            if (!item) return null;
            const configuredSpan = Number(config.spans?.[id]);
            const configuredHeight = Number(config.heights?.[id]);
            const height = Number.isFinite(configuredHeight) && configuredHeight > 0 ? configuredHeight : null;
            const span = Math.max(
              item.minSpan,
              Math.min(item.maxSpan, Number.isFinite(configuredSpan) && configuredSpan > 0 ? configuredSpan : item.defaultSpan)
            );
            return (
              <SortableGridItem
                key={id}
                id={id}
                sectionId={sectionId}
                span={span}
                height={height}
                minSpan={item.minSpan}
                maxSpan={item.maxSpan}
                hidden={hidden.has(id)}
                editing={editing}
                containerRef={containerRef}
                onResize={(nextSpan, nextHeight) => setSize(id, nextSpan, nextHeight)}
                onToggleHidden={toggleHidden}
              >
                {item.child}
              </SortableGridItem>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
