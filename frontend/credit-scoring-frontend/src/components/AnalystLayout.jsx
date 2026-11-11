import { LayoutDashboard, FileText, Building2, BarChart3, History, ArrowLeft } from "lucide-react";
import Sidebar from "./Sidebar";
import { layoutUser, roleOf, roleLabel } from "../lib/roles";

const NAV = {
  root: "/analyst",
  items: [
    { label: "Overview", icon: LayoutDashboard, path: "/analyst" },
    { label: "Assessment requests", icon: FileText, path: "/analyst/requests" },
    { label: "MSME records", icon: Building2, path: "/analyst/msmes" },
    { label: "Risk analytics", icon: BarChart3, path: "/analyst/analytics" },
    { label: "Review history", icon: History, path: "/analyst/reviews" },
  ],
};

// Admins can open the analyst workspace too. The label comes from the account's real role
// (it used to be hard-coded "Credit analyst", which made admins look like analysts).
const ADMIN_EXTRAS = [{ label: "Back to admin console", icon: ArrowLeft, path: "/console" }];

export default function AnalystLayout(props) {
  const user = layoutUser(props.user);
  const role = roleOf(user);
  const isAdmin = role === "admin";
  return (
    <Sidebar
      {...props}
      user={user}
      nav={NAV}
      extras={isAdmin ? ADMIN_EXTRAS : undefined}
      roleLabel={roleLabel(role)}
      notice={isAdmin ? "You are viewing the analyst workspace as an administrator." : null}
      brandNote="Credit scoring for MSMEs"
    />
  );
}
