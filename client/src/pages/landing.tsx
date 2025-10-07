import { Button } from "@/components/ui/button";
import { FileText, Package, Users, TrendingUp, Bolt } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-secondary/20 flex flex-col">
      <nav className="bg-card/80 glass-effect border-b border-border backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-lg flex items-center justify-center">
                <Bolt className="text-white" size={16} />
              </div>
              <span className="text-xl font-bold text-foreground">InvoiceFlow</span>
            </div>
            <Button onClick={handleLogin} data-testid="button-login">
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Invoice Management Made Simple
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Streamline your invoicing workflow with powerful tools for inventory management, customer tracking, and QuickBooks integration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <FileText className="text-primary" size={24} />
              </div>
              <h3 className="font-semibold">Smart Invoicing</h3>
              <p className="text-sm text-muted-foreground">Create and manage invoices with automatic calculations and PDF export</p>
            </div>

            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-3">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto">
                <Package className="text-accent" size={24} />
              </div>
              <h3 className="font-semibold">Inventory Tracking</h3>
              <p className="text-sm text-muted-foreground">Real-time inventory management with automatic stock updates</p>
            </div>

            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <Users className="text-primary" size={24} />
              </div>
              <h3 className="font-semibold">Customer Management</h3>
              <p className="text-sm text-muted-foreground">Organize customers and vendors in one central location</p>
            </div>

            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-3">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto">
                <TrendingUp className="text-accent" size={24} />
              </div>
              <h3 className="font-semibold">QuickBooks Sync</h3>
              <p className="text-sm text-muted-foreground">Seamless integration with QuickBooks Online for accounting</p>
            </div>
          </div>

          <div className="pt-8">
            <Button 
              size="lg" 
              onClick={handleLogin}
              className="text-lg px-8"
              data-testid="button-get-started"
            >
              Get Started
            </Button>
          </div>
        </div>
      </main>

      <footer className="bg-card/50 border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          © 2025 InvoiceFlow. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
