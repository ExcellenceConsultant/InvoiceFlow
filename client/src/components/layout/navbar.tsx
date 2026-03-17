import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import kitchenXpressLogo from "@assets/logo png _1762639803507.png";
import { Bell, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const isQuickBooksConnected = !!user?.quickbooksCompanyId;

  return (
    <nav
      className="bg-card/80 glass-effect border-b border-border backdrop-blur-lg sticky top-0 z-50"
      data-testid="navbar"
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center min-w-0">
            <Link
              href="/"
              className="flex items-center space-x-2 mr-4 flex-shrink-0"
              data-testid="link-home"
            >
              <img
                src={kitchenXpressLogo}
                alt="Kitchen Xpress"
                className="h-10 w-auto object-contain max-w-[100px]"
              />
              <span className="text-lg font-bold text-foreground whitespace-nowrap">
                InvoiceFlow
              </span>
            </Link>

            <div className="hidden md:flex items-center space-x-1">
              <Link href="/">
                <Button
                  variant={location === "/" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs px-3"
                  data-testid="link-dashboard"
                >
                  Dashboard
                </Button>
              </Link>
              <Link href="/invoices">
                <Button
                  variant={location === "/invoices" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs px-3"
                  data-testid="link-invoices"
                >
                  Invoices
                </Button>
              </Link>
              <Link href="/sales-orders">
                <Button
                  variant={location === "/sales-orders" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs px-3"
                  data-testid="link-sales-orders"
                >
                  Sales Orders
                </Button>
              </Link>
              <Link href="/credit-memos">
                <Button
                  variant={location === "/credit-memos" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs px-3"
                  data-testid="link-credit-memos"
                >
                  Credit Memos
                </Button>
              </Link>
              <Link href="/accounts">
                <Button
                  variant={location === "/accounts" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs px-3"
                  data-testid="link-accounts"
                >
                  Accounts
                </Button>
              </Link>
              <Link href="/inventory">
                <Button
                  variant={location === "/inventory" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs px-3"
                  data-testid="link-inventory"
                >
                  Inventory
                </Button>
              </Link>
              <Link href="/price-rules">
                <Button
                  variant={location === "/price-rules" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs px-3"
                  data-testid="link-price-rules"
                >
                  Price Rule
                </Button>
              </Link>
              <Link href="/schemes">
                <Button
                  variant={location === "/schemes" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs px-3"
                  data-testid="link-schemes"
                >
                  Schemes
                </Button>
              </Link>
              <Link href="/quickbooks/sync">
                <Button
                  variant={
                    location === "/quickbooks/sync" ? "default" : "ghost"
                  }
                  size="sm"
                  className="text-xs px-3"
                  data-testid="link-quickbooks-sync"
                >
                  QB Sync
                </Button>
              </Link>
              <Link href="/users">
                <Button
                  variant={location === "/users" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs px-3"
                  data-testid="link-users"
                >
                  User/Development
                </Button>
              </Link>
              {user?.role === "super_admin" && (
                <Link href="/profitability">
                  <Button
                    variant={location === "/profitability" ? "default" : "ghost"}
                    size="sm"
                    className="text-xs px-3"
                    data-testid="link-profitability"
                  >
                    Profit
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* QuickBooks Connection Status — dot only */}
            <div
              title={isQuickBooksConnected ? "QB Connected" : "QB Disconnected"}
              data-testid="quickbooks-status"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isQuickBooksConnected
                    ? "bg-green-500 animate-pulse"
                    : "bg-destructive"
                }`}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              data-testid="button-notifications"
            >
              <Bell size={16} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut size={16} />
            </Button>

            <div
              className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center"
              data-testid="user-avatar"
            >
              <span className="text-xs font-medium text-white">
                {user?.username?.[0]?.toUpperCase() ||
                  user?.email?.[0]?.toUpperCase() ||
                  "U"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
