import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings as SettingsIcon, LogOut, Mail, Shield, Camera, Loader2,
  IdCard, Briefcase, Building2, Check, KeyRound, ImageUp, X,
} from "lucide-react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { Card, PrimaryButton, SecondaryButton, Field, inputClass, StatusBadge } from "@/components/ui/shared";
import { useAuth } from "@/lib/auth-context";
import { logoutAdmin } from "@/lib/backend-utils";
import { updateEmployee, getDepartments, subscribeCompanySettings, updateCompanySettings } from "@/lib/db";
import { auth } from "@/lib/firebase";
import { getInitials } from "@/lib/utils";
import { usePageHeader } from "@/lib/page-header-context";
import type { Department } from "@/types";

const MAX_PHOTO_BYTES = 300 * 1024;
const MAX_LOGO_BYTES = 200 * 1024;

function resizeImageToDataUrl(file: File, maxDim = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a valid image."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Image processing is not supported in this browser.")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const roleTone = { Executive: "black", HR: "blue", Staff: "neutral" } as const;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { role, user, employee, refreshEmployee } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  usePageHeader({ icon: SettingsIcon, title: "Settings" });

  const [departments, setDepartments] = useState<Department[]>([]);
  useEffect(() => { getDepartments().then(setDepartments).catch(() => {}); }, []);
  const departmentName = departments.find((d) => d.id === employee?.departmentId)?.name;

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");

  async function handlePhotoChange(file: File) {
    if (!employee) { setPhotoError("No employee record is linked to this login, so a photo can't be saved."); return; }
    if (!file.type.startsWith("image/")) { setPhotoError("Please choose an image file."); return; }
    setPhotoError("");
    setUploadingPhoto(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      if (dataUrl.length > MAX_PHOTO_BYTES) { setPhotoError("Photo is still too large after compression. Try a smaller image."); return; }
      await updateEmployee(employee.id, { photoUrl: dataUrl });
      await refreshEmployee();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setPhotoError(
        code === "permission-denied"
          ? "Missing or insufficient permissions. Your employee account needs a one-time ID fix — contact Executive/IT."
          : err instanceof Error ? err.message : "Failed to upload photo."
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  // Company logo (Executive only)
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [companyLogo, setCompanyLogo] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState("");

  useEffect(() => subscribeCompanySettings((data) => setCompanyLogo(data.logoUrl ?? "")), []);

  async function handleLogoChange(file: File) {
    if (!file.type.startsWith("image/")) { setLogoError("Please choose an image file."); return; }
    setLogoError("");
    setUploadingLogo(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 240, 0.9);
      if (dataUrl.length > MAX_LOGO_BYTES) { setLogoError("Logo is still too large after compression. Try a smaller image."); return; }
      await updateCompanySettings({ logoUrl: dataUrl });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setLogoError(code === "permission-denied" ? "Only Executives can update the company logo." : err instanceof Error ? err.message : "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    setLogoError("");
    try {
      await updateCompanySettings({ logoUrl: "" });
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Failed to remove logo.");
    }
  }

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    setFullName(employee?.fullName ?? "");
    setPhone(employee?.phone ?? "");
  }, [employee?.id]);

  async function saveProfile() {
    if (!employee) return;
    setSavingProfile(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      await updateEmployee(employee.id, { fullName: fullName.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) });
      await refreshEmployee();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setProfileError(code === "permission-denied" ? "You don't have permission to update this profile." : err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSavingProfile(false);
    }
  }

  // Change password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");

  async function changePassword() {
    setPwError("");
    setPwSaved(false);
    if (newPw.length < 6) { setPwError("New password must be at least 6 characters."); return; }
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    if (!auth.currentUser?.email) return;
    setSavingPw(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPw);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPw);
      setPwSaved(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => setPwSaved(false), 2500);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setPwError(
        code === "auth/wrong-password" || code === "auth/invalid-credential"
          ? "Current password is incorrect."
          : code === "auth/weak-password"
          ? "New password is too weak."
          : err instanceof Error ? err.message : "Failed to change password."
      );
    } finally {
      setSavingPw(false);
    }
  }

  async function handleLogout() {
    await logoutAdmin();
    navigate("/");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Identity header */}
      <Card className="p-6">
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 shrink-0">
            {employee?.photoUrl ? (
              <img src={employee.photoUrl} alt="" className="w-20 h-20 rounded-full object-cover border border-neutral-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-600 to-sky-700 flex items-center justify-center">
                <span className="text-xl font-bold text-white">{getInitials(user?.email ?? "?")}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto || !employee}
              aria-label="Upload profile photo"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-neutral-200 shadow-sm flex items-center justify-center hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadingPhoto ? <Loader2 size={13} className="animate-spin text-neutral-500" /> : <Camera size={13} className="text-neutral-600" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoChange(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-black truncate">{employee?.fullName || user?.email}</p>
            <p className="text-sm text-neutral-500 truncate mt-0.5">{user?.email}</p>
            {role && <div className="mt-2"><StatusBadge label={role} tone={roleTone[role]} dot={false} /></div>}
          </div>
        </div>
        {photoError && <p className="text-red-600 text-xs font-medium mt-3">{photoError}</p>}
        <p className="text-[11px] text-neutral-400 mt-3">JPG or PNG, max {Math.floor(MAX_PHOTO_BYTES / 1024)} KB after compression. Photos are stored inline — no file storage bucket used.</p>
      </Card>

      {/* Profile information */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-black mb-4">Profile Information</h2>

        {employee ? (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 012-345 6789" />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-100">
              <div className="flex items-center gap-3 text-sm">
                <IdCard size={16} className="text-neutral-400 shrink-0" />
                <span className="text-neutral-500">Worker ID</span>
                <span className="ml-auto text-black font-medium truncate">{employee.workerId}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase size={16} className="text-neutral-400 shrink-0" />
                <span className="text-neutral-500">Position</span>
                <span className="ml-auto text-black font-medium truncate">{employee.position}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail size={16} className="text-neutral-400 shrink-0" />
                <span className="text-neutral-500">Email</span>
                <span className="ml-auto text-black font-medium truncate">{employee.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Building2 size={16} className="text-neutral-400 shrink-0" />
                <span className="text-neutral-500">Department</span>
                <span className="ml-auto text-black font-medium truncate">{departmentName ?? "—"}</span>
              </div>
            </div>

            {profileError && <p className="text-red-600 text-xs font-medium mt-4">{profileError}</p>}

            <div className="mt-5 pt-5 border-t border-neutral-100 flex items-center gap-3">
              <PrimaryButton onClick={saveProfile} isLoading={savingProfile}>Save Changes</PrimaryButton>
              {profileSaved && (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><Check size={14} /> Saved</span>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-neutral-400 shrink-0" />
              <span className="text-neutral-500">Email</span>
              <span className="ml-auto text-black font-medium truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield size={16} className="text-neutral-400 shrink-0" />
              <span className="text-neutral-500">Role</span>
              <span className="ml-auto text-black font-medium">{role}</span>
            </div>
            <p className="text-xs text-neutral-400 pt-2">No employee record is linked to this login, so profile fields aren't editable here.</p>
          </div>
        )}
      </Card>

      {/* Company branding — Executive only */}
      {role === "Executive" && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-black mb-1 flex items-center gap-2"><ImageUp size={15} className="text-neutral-400" /> Company Branding</h2>
          <p className="text-xs text-neutral-400 mb-4">The logo shown in the sidebar for everyone in the system. Only Executives can change it.</p>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-center overflow-hidden shrink-0">
              {companyLogo ? (
                <img src={companyLogo} alt="Company logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-red-800 flex items-center justify-center">
                  <span className="text-white font-black text-xl leading-none">B</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <SecondaryButton type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />} {companyLogo ? "Replace Logo" : "Upload Logo"}
              </SecondaryButton>
              {companyLogo && (
                <button type="button" onClick={removeLogo} className="p-2 rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors" aria-label="Remove logo">
                  <X size={16} />
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoChange(file);
                e.target.value = "";
              }}
            />
          </div>
          {logoError && <p className="text-red-600 text-xs font-medium mt-3">{logoError}</p>}
          <p className="text-[11px] text-neutral-400 mt-3">JPG or PNG, max {Math.floor(MAX_LOGO_BYTES / 1024)} KB after compression.</p>
        </Card>
      )}

      {/* Security */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-black mb-4 flex items-center gap-2"><KeyRound size={15} className="text-neutral-400" /> Change Password</h2>
        <div className="space-y-4">
          <Field label="Current Password">
            <input type="password" className={inputClass} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="New Password">
              <input type="password" className={inputClass} value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirm New Password">
              <input type="password" className={inputClass} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
        </div>

        {pwError && <p className="text-red-600 text-xs font-medium mt-4">{pwError}</p>}

        <div className="mt-5 pt-5 border-t border-neutral-100 flex items-center gap-3">
          <SecondaryButton onClick={changePassword} disabled={savingPw || !currentPw || !newPw}>
            {savingPw ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Update Password
          </SecondaryButton>
          {pwSaved && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><Check size={14} /> Password updated</span>
          )}
        </div>
      </Card>

      {/* Sign out */}
      <Card className="p-6">
        <PrimaryButton onClick={handleLogout}>
          <LogOut size={16} /> Sign Out
        </PrimaryButton>
      </Card>
    </div>
  );
}
