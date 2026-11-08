import { LayoutDashboard, FileText, Building2, BarChart3, History } from "lucide-react";
import Sidebar from "./Sidebar";

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

export default function AnalystLayout(props) {
  return <Sidebar {...props} nav={NAV} roleLabel="Credit analyst" brandNote="Credit scoring for MSMEs" />;
}
