import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Paramètres — EduNote Pro" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, role } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Minimum 6 caractères");
    if (password !== confirm) return toast.error("Les mots de passe ne correspondent pas");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Mot de passe mis à jour");
    setPassword("");
    setConfirm("");
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Gérez votre compte</p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <Label className="text-muted-foreground">Email</Label>
          <p className="font-medium mt-1">{user?.email}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Rôle</Label>
          <p className="font-medium mt-1 capitalize">{role}</p>
        </div>
      </div>

      <form onSubmit={updatePassword} className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Changer le mot de passe</h2>
        <div className="space-y-2">
          <Label htmlFor="pwd">Nouveau mot de passe</Label>
          <Input id="pwd" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pwd2">Confirmer</Label>
          <Input id="pwd2" type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading}>{loading ? "Enregistrement…" : "Mettre à jour"}</Button>
      </form>
    </div>
  );
}
