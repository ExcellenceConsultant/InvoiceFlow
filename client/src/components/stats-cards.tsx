import { DollarSign, FileText, Package, Gift, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="stats-card animate-pulse" data-testid={`stats-card-skeleton-${i}`}>
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-muted rounded w-1/2 mb-4"></div>
              <div className="h-3 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = [
    {
      title: "Total Revenue",
      value: `$${stats?.totalRevenue || "0.00"}`,
      change: "+12.5%",
      changeText: "from last month",
      icon: DollarSign,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      testId: "stats-revenue",
    },
    {
      title: "Active Invoices",
      value: stats?.activeInvoices || 0,
      change: stats?.activeInvoices ? "All up to date" : "No active invoices",
      changeText: "",
      icon: FileText,
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
      testId: "stats-invoices",
    },
    {
      title: "Products in Stock",
      value: stats?.productsInStock || 0,
      change: stats?.lowStockCount ? `${stats.lowStockCount} low stock` : "All stocked well",
      changeText: "",
      icon: Package,
      iconBg: "bg-chart-3/10",
      iconColor: "text-chart-3",
      changeColor: stats?.lowStockCount ? "text-destructive" : "text-muted-foreground",
      testId: "stats-inventory",
    },
    {
      title: "Active Schemes",
      value: stats?.activeSchemes || 0,
      change: stats?.activeSchemes ? `${stats.activeSchemes} scheme${stats.activeSchemes === 1 ? '' : 's'} active` : "No active schemes",
      changeText: "",
      icon: Gift,
      iconBg: "bg-chart-4/10",
      iconColor: "text-chart-4",
      testId: "stats-schemes",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsData.map((stat, index) => (
        <Card 
          key={stat.testId} 
          className="stats-card animate-slide-in"
          style={{ animationDelay: `${index * 0.1}s` }}
          data-testid={stat.testId}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium" data-testid={`${stat.testId}-title`}>
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-foreground" data-testid={`${stat.testId}-value`}>
                  {stat.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
                <stat.icon className={stat.iconColor} size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className={`font-medium ${stat.changeColor || "text-accent"}`} data-testid={`${stat.testId}-change`}>
                {stat.change}
              </span>
              {stat.changeText && (
                <span className="text-muted-foreground ml-1">{stat.changeText}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
