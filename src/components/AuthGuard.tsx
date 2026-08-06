import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, role, isLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate("/", { replace: true }); return; }

    const hrPaths = ["/hr/employees", "/hr/leave", "/hr/attendance", "/hr", "/departments", "/notifications", "/settings"];
    if (role === "HR" && !hrPaths.some((p) => pathname.startsWith(p))) {
      navigate("/hr/employees", { replace: true });
      return;
    }
    // Employee directory/management is HR & Executive only. Leave & Attendance
    // (/hr/leave) is intentionally open to Staff — they submit their own leave
    // requests and clock in/out there.
    if (role === "Staff" && pathname.startsWith("/hr/employees")) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, user, role, pathname, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-5"
        >
          {/* Logo mark */}
          <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center shadow-lg">
            <span className="text-2xl font-black tracking-tight">
              <span className="text-red-500">B</span>
              <span className="text-white">T</span>
            </span>
          </div>

          {/* Animated dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-2 h-2 rounded-full bg-red-800"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>

          <p className="text-sm text-neutral-400 font-medium tracking-wide">Loading workspace…</p>
        </motion.div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
