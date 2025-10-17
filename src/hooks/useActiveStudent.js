import { useEffect, useState } from "react";

export function getActiveAdmission() {
  return (
    localStorage.getItem("activeStudentAdmission") ||
    localStorage.getItem("username") || // fallback: logged-in user
    ""
  );
}

export default function useActiveStudent() {
  const [admission, setAdmission] = useState(getActiveAdmission());

  useEffect(() => {
    const onSwitch = (e) => {
      const a = e?.detail?.admission || getActiveAdmission();
      setAdmission(a);
    };
    window.addEventListener("student-switched", onSwitch);
    window.addEventListener("family-updated", onSwitch);
    return () => {
      window.removeEventListener("student-switched", onSwitch);
      window.removeEventListener("family-updated", onSwitch);
    };
  }, []);

  return admission;
}
