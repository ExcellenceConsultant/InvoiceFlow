import { Link, useLocation } from "wouter";
import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import kitchenXpressLogo from "@assets/WhatsApp Image 2025-10-08 at 12.47.38 AM_1760212885421.jpeg";

export default function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const isQuickBooksConnected = !!user?.quickbooksCompanyId;

  return (
    <nav className="bg-card/80 glass-effect border-b border-border backdrop-blur-lg sticky top-0 z-50" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2" data-testid="link-home">
              <img src={kitchenXpressLogo} alt="Kitchen Xpress" className="h-10 w-auto object-contain" />
              <span className="text-xl font-bold text-foreground">InvoiceFlow</span>
            </Link>
            
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/">
                <Button 
                  variant={location === "/" ? "default" : "ghost"} 
                  size="sm"
                  data-testid="link-dashboard"
                >
                  Dashboard
                </Button>
              </Link>
              <Link href="/invoices">
                <Button 
                  variant={location === "/invoices" ? "default" : "ghost"} 
                  size="sm"
                  data-testid="link-invoices"
                >
                  Invoices
                </Button>
              </Link>
              <Link href="/accounts">
                <Button 
                  variant={location === "/accounts" ? "default" : "ghost"} 
                  size="sm"
                  data-testid="link-accounts"
                >
                  Accounts
                </Button>
              </Link>
              <Link href="/inventory">
                <Button 
                  variant={location === "/inventory" ? "default" : "ghost"} 
                  size="sm"
                  data-testid="link-inventory"
                >
                  Inventory
                </Button>
              </Link>
              <Link href="/schemes">
                <Button 
                  variant={location === "/schemes" ? "default" : "ghost"} 
                  size="sm"
                  data-testid="link-schemes"
                >
                  Schemes
                </Button>
              </Link>
              <Link href="/quickbooks/sync">
                <Button 
                  variant={location === "/quickbooks/sync" ? "default" : "ghost"} 
                  size="sm"
                  data-testid="link-quickbooks-sync"
                >
                  QB Sync
                </Button>
              </Link>
              <Link href="/users">
                <Button 
                  variant={location === "/users" ? "default" : "ghost"} 
                  size="sm"
                  data-testid="link-users"
                >
                  Users
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* QuickBooks Connection Status */}
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
              isQuickBooksConnected 
                ? "bg-accent/10 text-accent-foreground" 
                : "bg-destructive/10 text-destructive-foreground"
            }`} data-testid="quickbooks-status">
              <div className={`w-2 h-2 rounded-full ${
                isQuickBooksConnected 
                  ? "bg-accent animate-pulse" 
                  : "bg-destructive"
              }`} />
              <span className="text-sm font-medium">
                {isQuickBooksConnected ? "QB Connected" : "QB Disconnected"}
              </span>
            </div>
            
            <Button variant="ghost" size="sm" data-testid="button-notifications">
              <Bell size={18} />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut size={18} />
            </Button>
            
            <div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center" data-testid="user-avatar">
              <span className="text-xs font-medium text-white">
                {user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
