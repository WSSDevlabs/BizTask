import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin } from "@/lib/backend-utils";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff, AlertCircle, BarChart3, Users, FileText } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: BarChart3, label: "Finance & Reporting",   desc: "Invoices, expenses, cash flow" },
  { icon: Users,     label: "CRM & Pipeline",        desc: "Leads, deals, customer tracking" },
  { icon: FileText,  label: "Projects & HR",         desc: "Tasks, team, leave management" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [error, setError]           = useState("");
  const [isLoading, setIsLoading]   = useState(false);

  useEffect(() => {
    if (!authLoading && user && role !== null) {
      navigate(role === "HR" ? "/hr" : "/dashboard", { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await loginAdmin(identifier, password);
    } catch (err) {
      setError(
        err instanceof Error && err.message === "Worker ID not found."
          ? "Worker ID not found. Please check and try again."
          : "Login failed. Please check your credentials."
      );
      setIsLoading(false);
    }
  }

  if (!authLoading && user) return null;

  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Left panel (brand) ── hidden on mobile */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative flex-col justify-between bg-neutral-950 px-10 py-12 overflow-hidden select-none">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-red-900/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-red-800/15 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-full bg-gradient-to-b from-transparent via-red-900/20 to-transparent" />
        </div>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-800 flex items-center justify-center shadow-lg shadow-red-900/50">
              <span className="text-white font-black text-lg leading-none">B</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              Biz<span className="text-red-500">Task</span>
            </span>
          </div>
          <p className="text-neutral-500 text-xs mt-2 ml-0.5 uppercase tracking-widest font-medium">
            Internal ERP
          </p>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="relative z-10 my-auto"
        >
          <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight">
            Your business,<br />
            <span className="text-red-500">one command</span><br />
            center.
          </h2>
          <p className="text-neutral-400 mt-4 text-sm leading-relaxed max-w-xs">
            Everything your team needs — projects, finance, CRM, and HR — unified in a single platform.
          </p>

          {/* Feature list */}
          <div className="mt-8 space-y-3">
            {features.map(({ icon: Icon, label, desc }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-red-900/40 border border-red-900/50 flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-red-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-none">{label}</p>
                  <p className="text-neutral-500 text-xs mt-0.5">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <p className="text-neutral-600 text-xs relative z-10">
          © {new Date().getFullYear()} BizTask. All rights reserved.
        </p>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-neutral-50 lg:bg-white">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-red-800 flex items-center justify-center">
              <span className="text-white font-black text-base leading-none">B</span>
            </div>
            <span className="text-xl font-black tracking-tight text-neutral-900">
              Biz<span className="text-red-700">Task</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Welcome back</h1>
            <p className="text-neutral-400 mt-1.5 text-sm">
              Sign in with your Worker ID or email address.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Worker ID / Email */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-neutral-700">
                Worker ID / Email
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. W0001 or your email"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder-neutral-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-700/25 focus:border-red-600 transition-all duration-150 text-sm hover:border-neutral-300"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-neutral-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder-neutral-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-700/25 focus:border-red-600 transition-all duration-150 text-sm hover:border-neutral-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !identifier || !password}
              className="w-full py-3 px-4 mt-2 bg-gradient-to-b from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 disabled:from-neutral-300 disabled:to-neutral-400 text-white font-bold rounded-xl shadow-sm shadow-red-900/20 hover:shadow-md hover:shadow-red-900/20 hover:-translate-y-px active:translate-y-0 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2 text-sm flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-neutral-300 mt-8 lg:hidden">
            © {new Date().getFullYear()} BizTask
          </p>
        </motion.div>
      </div>
    </div>
  );
}
