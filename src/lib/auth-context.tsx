import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { env } from "@/lib/env";

export type Role = "Executive" | "HR" | "Staff" | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
});

const HR_EMAIL = env.hrMasterEmail;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setRole(null);
        setIsLoading(false);
        return;
      }

      setUser(currentUser);

      // HR master account
      if (currentUser.email === HR_EMAIL) {
        setRole("HR");
        setIsLoading(false);
        return;
      }

      // Look up role from employees collection
      try {
        const snap = await getDocs(
          query(
            collection(db, "employees"),
            where("email", "==", currentUser.email),
            limit(1)
          )
        );
        if (!snap.empty) {
          const data = snap.docs[0].data();
          // Legacy: "Admin" maps to "Executive"
          const empRole = data.role === "Admin" ? "Executive" : data.role;
          setRole(empRole as Role);
        } else {
          setRole("Staff");
        }
      } catch {
        setRole("Staff");
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
