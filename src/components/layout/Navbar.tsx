import { CreditCard, List, Brain, User, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  activeTab: "payments" | "transactions" | "rytmind" | "insights";
  onTabChange: (tab: "payments" | "transactions" | "rytmind" | "insights") => void;
}

const Navbar = ({ activeTab, onTabChange }: NavbarProps) => {
  const tabs = [
    { id: "payments" as const, label: "Payments", icon: CreditCard },
    { id: "transactions" as const, label: "Transactions", icon: List },
    { id: "rytmind" as const, label: "RytMind", icon: Brain },
    { id: "insights" as const, label: "Insights", icon: TrendingUp },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-ryt flex items-center justify-center shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse"></div>
              <span className="text-primary-foreground font-bold text-sm relative z-10">R</span>
            </div>
            <span className="font-bold text-foreground text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Ryt Bank
            </span>
          </div>

          {/* Center Tabs */}
          <div className="flex items-center bg-muted rounded-full p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Profile */}
          <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
            <User className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
