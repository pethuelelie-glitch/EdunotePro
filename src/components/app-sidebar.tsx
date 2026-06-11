import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Trophy,
  CalendarRange,
  LogOut,
  GanttChart,
  ShieldCheck,
  Activity,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
  { title: "Étudiants", url: "/students", icon: Users },
  { title: "Classes", url: "/classes", icon: GraduationCap },
  { title: "Modules", url: "/modules", icon: BookOpen },
  { title: "Notes", url: "/grades", icon: ClipboardList },
  { title: "Classement", url: "/rankings", icon: Trophy },
  { title: "Années académiques", url: "/years", icon: CalendarRange },
];

const adminItems = [
  { title: "Utilisateurs", url: "/users", icon: ShieldCheck },
  { title: "Journal d'activité", url: "/activity", icon: Activity },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, role, signOut, isAdmin } = useAuth();

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GanttChart className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">EduNote Pro</span>
            <span className="text-xs text-muted-foreground">Gestion académique</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={path === item.url}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="flex flex-col gap-2 p-2">
          <div className="px-2 text-xs">
            <p className="font-medium truncate">{user?.email}</p>
            <p className="text-muted-foreground capitalize">{role}</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="justify-start">
            <Link to="/settings">
              <Settings className="h-4 w-4 mr-2" /> Paramètres
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="justify-start">
            <LogOut className="h-4 w-4 mr-2" /> Déconnexion
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
