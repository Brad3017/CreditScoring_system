import { LayoutDashboard, Cpu, Scale, Users, ClipboardList, Database } from "lucide-react";
import Sidebar from "./Sidebar";

const NAV = {
  root: "/console",
  items: [
    { label: "Overview", icon: LayoutDashboard, path: "/console" },
    { label: "Model monitor", icon: Cpu, path: "/console/model" },
    { label: "Fairness check", icon: Scale, path: "/console/fairness" },
    { label: "Users", icon: Users, path: "/console/users" },
  ],
};

const EXTRAS = [
  { label: "Review queue", icon: ClipboardList, path: "/analyst/requests" },
  { label: "Data admin (Django)", icon: Database, href: "/admin/" },
];

export default function AdminLayout(props) {
  return <Sidebar {...props} nav={NAV} extras={EXTRAS} roleLabel="Administrator" brandNote="Administration" />;
}
