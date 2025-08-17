import React, { useLayoutEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../components/Sidebar.css";
import Navbar from "../components/Navbar";

export default function AppLayout() {
  const [headerHeight, setHeaderHeight] = useState(56);
  const location = useLocation();

  useLayoutEffect(() => {
    const measure = () => {
      const el =
        document.querySelector(".navbar.fixed-top.app-header") ||
        document.querySelector(".app-header.navbar");
      const h = el ? Math.round(el.getBoundingClientRect().height) : 56;
      setHeaderHeight(h || 56);
      document.body.style.setProperty("--header-h", `${h || 56}px`);
    };

    measure();

    const onResize = () => measure();
    window.addEventListener("resize", onResize);

    const el =
      document.querySelector(".navbar.fixed-top.app-header") ||
      document.querySelector(".app-header.navbar");

    let ro;
    if (el && "ResizeObserver" in window) {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
    };
  }, [location.pathname]); // re-measure on route changes too

  return (
    <>
      {/* Always on top */}
      <Navbar />

      {/* Sidebar sits under the header using --header-h */}
      <Sidebar headerHeight={headerHeight} />

      {/* Push content below fixed header */}
      <main className="app-content" style={{ paddingTop: headerHeight + 8 }}>
        <Outlet />
      </main>
    </>
  );
}
