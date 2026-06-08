import { useAuth } from "@/contexts/AuthContext";
import { isSalesDashboardRole } from "@/lib/appRoles";
import Dashboard from "@/pages/Dashboard";
import SalesDashboard from "@/pages/SalesDashboard";

/** `/app` — dashboard gerencial o comercial según rol. */
export default function RoleHome() {
  const { user } = useAuth();
  if (isSalesDashboardRole(user?.role)) {
    return <SalesDashboard />;
  }
  return <Dashboard />;
}
