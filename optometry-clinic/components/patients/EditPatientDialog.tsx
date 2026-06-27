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
};

type Props = {
  patient: Patient;
};

export function EditPatientDialog({ patient }: Props) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name:     patient.full_name,
    phone:         patient.phone,
    phone2:        patient.phone2,
    address:       patient.address,
    date_of_birth: patient.date_of_birth,
    sex:           patient.sex,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!form.full_name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("patients")
      .update({
        full_name:     form.full_name.trim(),
        phone:         form.phone.trim(),
        phone2:        form.phone2.trim(),
        address:       form.address.trim(),
        date_of_birth: form.date_of_birth,
        sex:           form.sex,
      })
      .eq("id", patient.id);
    setLoading(false);
    if (error) {
      toast.error("Failed to save. Please try again.");
      console.error(error);
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

          {/* Header — slightly tinted so it reads as a distinct zone */}
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

            {/* Full name — most important field, gets a bit more visual weight */}
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
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

          </div>

          {/* Footer — separated from form */}
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