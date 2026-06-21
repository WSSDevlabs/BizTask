import { motion } from "framer-motion";

export default function PageTransition({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.995 }}
      animate={{ opacity: 1, y: 0,  scale: 1     }}
      exit={{    opacity: 0, y: 8,  scale: 0.995 }}
      transition={{ type: "spring", stiffness: 340, damping: 30, mass: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
