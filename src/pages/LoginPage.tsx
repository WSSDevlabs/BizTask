import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin } from "@/lib/backend-utils";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [remember, setRemember]     = useState(true);
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
      await loginAdmin(identifier, password, remember);
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

  const titaniumStyle = {
    backgroundImage: [
      "linear-gradient(155deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 14%)",
      "repeating-linear-gradient(98deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px)",
      "linear-gradient(135deg, #4d4e52 0%, #6e6f74 17%, #38393c 36%, #58595d 54%, #2a2b2e 71%, #6b6c71 87%, #404144 100%)",
    ].join(", "),
    boxShadow: [
      "0 30px 80px -20px rgba(0,0,0,0.75)",
      "inset 0 1px 0 rgba(255,255,255,0.25)",
      "inset 0 -1px 0 rgba(0,0,0,0.55)",
      "inset 0 0 0 1px rgba(255,255,255,0.05)",
    ].join(", "),
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-neutral-950 relative overflow-hidden">
      {/* Matte background texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 15%, rgba(255,255,255,0.05) 0%, transparent 45%), radial-gradient(circle at 80% 85%, rgba(255,255,255,0.03) 0%, transparent 50%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="w-8 h-8 rounded-lg bg-red-800 flex items-center justify-center shadow-lg shadow-red-950/50">
            <span className="text-white font-black text-base leading-none">B</span>
          </div>
          <span className="text-xl font-black tracking-tight text-white">
            Biz<span className="text-red-500">Task</span>
          </span>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-neutral-400 mt-1.5 text-sm">
            Sign in with your Worker ID or email address.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={titaniumStyle}
          className="space-y-4 rounded-2xl border border-white/10 p-6"
        >
          {/* Worker ID / Email */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-neutral-200">
              Worker ID / Email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. RZ01 or your email"
              required
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-black/25 text-white placeholder-neutral-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-red-600/40 focus:border-red-500/60 transition-all duration-150 text-sm hover:border-white/20"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-neutral-200">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 pr-11 rounded-xl border border-white/10 bg-black/25 text-white placeholder-neutral-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-red-600/40 focus:border-red-500/60 transition-all duration-150 text-sm hover:border-white/20"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2.5 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-black/25 text-red-600 focus:ring-red-600/40 focus:ring-2 cursor-pointer accent-red-600"
            />
            <span className="text-sm text-neutral-300">Remember me</span>
          </label>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !identifier || !password}
            className="w-full py-3 px-4 mt-2 bg-gradient-to-b from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 disabled:from-neutral-500 disabled:to-neutral-600 text-white font-bold rounded-xl shadow-sm shadow-black/40 hover:shadow-md hover:shadow-black/40 hover:-translate-y-px active:translate-y-0 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-neutral-950 text-sm flex items-center justify-center gap-2 disabled:cursor-not-allowed"
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

        <p className="text-center text-xs text-neutral-600 mt-8">
          © {new Date().getFullYear()} BizTask
        </p>
      </motion.div>
    </div>
  );
}
