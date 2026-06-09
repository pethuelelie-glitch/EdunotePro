import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Utilisateurs — EduNote Pro" }] }),
  component: UsersPage,
});

type AdminUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: "admin" | "user";
  created_at: string;
};

function UsersPage() {
  const { isAdmin, loading, user: me } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });

  const changeRole = async (userId: string, role: "admin" | "user") => {
    const { error } = await supabase.rpc("admin_set_user_role", { _user_id: userId, _role: role });
    if (error) return toast.error(error.message);
    toast.success("Rôle mis à jour");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-sm text-muted-foreground">Administrez les comptes et les rôles.</p>
        </div>
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>}
            {users?.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.first_name ?? "—"} {u.last_name ?? ""}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                </TableCell>
                <TableCell>{new Date(u.created_at).toLocaleDateString("fr-FR")}</TableCell>
                <TableCell className="text-right">
                  {u.id === me?.id ? (
                    <span className="text-xs text-muted-foreground">Vous</span>
                  ) : (
                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v as "admin" | "user")}>
                      <SelectTrigger className="w-32 ml-auto"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Utilisateur</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}