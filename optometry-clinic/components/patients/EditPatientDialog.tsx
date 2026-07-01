"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

type Patient = {
  id: string;
  full_name: string;
  phone: string;
  phone2: string;
  address: string;
  date_of_birth: string;
  sex: string;
  file_number: string | null;
};

type Props = {
  patient: Patient;
  // Role is fetched server-side and passed down so we never trust the
  // client to decide what it's allowed to edit.
  userRole: string | null;
};

export function EditPatientDialog({ patient, userRole }: Props) {
  const supabase = createClient();
  const isAdmin = userRole === "admin";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name:     patient.full_name    ?? "",
    phone:         patient.phone        ?? "",
    phone2:        patient.phone2       ?? "",
    address:       patient.address      ?? "",
    date_of_birth: patient.date_of_birth ?? "",
    sex:           patient.sex          ?? "",
    file_number:   patient.file_number  ?? "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!form.full_name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }

    setLoading(true);

    // Build the update payload. file_number is only included for admins —
    // even if someone manipulates the form client-side, the RLS policy on
    // the patients table will block the write for non-admins.
    const payload: Record<string, string | null> = {
      full_name:     form.full_name.trim(),
      phone:         form.phone.trim()    || null,
      phone2:        form.phone2.trim()   || null,
      address:       form.address.trim()  || null,
      date_of_birth: form.date_of_birth   || null,
      sex:           form.sex             || null,
    };

    if (isAdmin) {
      // Normalise: strip whitespace, convert empty string to null
      const fn = form.file_number.trim() || null;
      payload.file_number = fn;
    }

    const { error } = await supabase
      .from("patients")
      .update(payload)
      .eq("id", patient.id);

    setLoading(false);

    if (error) {
      // Unique constraint violation — someone else has this file number
      if (error.code === "23505") {
        toast.error(
          `File number "${form.file_number.trim()}" is already assigned to another patient.`
        );
      } else {
        toast.error("Failed to save. Please try again.");
        console.error(error);
      }
      return;
    }

    toast.success("Patient profile updated.");
    setOpen(false);
    window.location.reload();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="w-3.5 h-3.5 mr-1.5" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">

          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-gray-50/80">
            <DialogTitle className="text-base font-semibold text-gray-900">
              Edit patient profile
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Changes are saved to the patient record immediately.
            </p>
          </DialogHeader>

          {/* Form body */}
          <div className="px-6 py-5 space-y-5">

            {/* File number — admin only */}
            {isAdmin && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  File number
                  <span className="ml-2 normal-case text-xs font-normal tracking-normal
                                   bg-amber-50 text-amber-700 border border-amber-200
                                   rounded px-1.5 py-0.5">
                    Admin only
                  </span>
                </label>
                <Input
                  name="file_number"
                  value={form.file_number}
                  onChange={handleChange}
                  placeholder="e.g. 523"
                  className="text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Must be unique. Leave blank to unassign.
                </p>
              </div>
            )}

            {/* Full name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Full name
              </label>
              <Input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                className="text-sm font-medium text-gray-900"
              />
            </div>

            {/* Phone row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Phone
                </label>
                <Input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="08012345678"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Phone 2
                  <span className="ml-1.5 normal-case text-xs text-muted-foreground/60 font-normal tracking-normal">
                    optional
                  </span>
                </label>
                <Input
                  name="phone2"
                  value={form.phone2}
                  onChange={handleChange}
                  placeholder="—"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Address
              </label>
              <Input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Street, City"
                className="text-sm"
              />
            </div>

            {/* DOB + Sex row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Date of birth
                </label>
                <Input
                  name="date_of_birth"
                  type="date"
                  value={form.date_of_birth}
                  onChange={handleChange}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Sex
                </label>
                <select
                  name="sex"
                  value={form.sex}
                  onChange={handleChange}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent
                             px-3 py-1 text-sm text-gray-900 shadow-sm transition-colors
                             focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-5 pb-6 border-t border-border bg-gray-50/80 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
}
