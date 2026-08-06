import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { env } from "@/lib/env";
import type { Employee } from "@/types";

export type Role = "Executive" | "HR" | "Staff" | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  employee: Employee | null;
  isLoading: boolean;
  refreshEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  employee: null,
  isLoading: true,
  refreshEmployee: async () => {},
});

const HR_EMAIL = env.hrMasterEmail;

async function lookupEmployee(email: string): Promise<Employee | null> {
  const snap = await getDocs(
    query(collection(db, "employees"), where("email", "==", email), limit(1))
  );
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Employee;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshEmployee = useCallback(async () => {
    if (!auth.currentUser?.email) return;
    try {
      const emp = await lookupEmployee(auth.currentUser.email);
      setEmployee(emp);
    } catch {
      // keep previous value
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setRole(null);
        setEmployee(null);
        setIsLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        const emp = await lookupEmployee(currentUser.email ?? "");
        if (emp) {
          // Legacy: "Admin" maps to "Executive"
          const empRole = (emp.role as string) === "Admin" ? "Executive" : emp.role;
          setRole(currentUser.email === HR_EMAIL ? "HR" : (empRole as Role));
          setEmployee(emp);
        } else {
          setRole(currentUser.email === HR_EMAIL ? "HR" : "Staff");
          setEmployee(null);
        }
      } catch {
        setRole(currentUser.email === HR_EMAIL ? "HR" : "Staff");
        setEmployee(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, employee, isLoading, refreshEmployee }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
