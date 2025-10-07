import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Invoices from "@/pages/invoices";
import InvoiceView from "@/pages/invoice-view";
import PackingList from "@/pages/packing-list";
import ShippingLabel from "@/pages/shipping-label";
import Inventory from "@/pages/inventory";
import Schemes from "@/pages/schemes";
import Accounts from "@/pages/accounts";
import QuickBooksAuth from "@/pages/quickbooks-auth";
import QuickBooksCallback from "@/pages/quickbooks-callback";
import QuickBooksSync from "@/pages/quickbooks-sync";
import UserManagement from "@/pages/user-management";
import Navbar from "@/components/layout/navbar";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();
  const isInvoiceView = (location.startsWith("/invoices/") && location !== "/invoices");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-secondary/20">
      {!isInvoiceView && <Navbar />}
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/invoices/:id" component={InvoiceView} />
        <Route path="/invoices/:id/packing-list" component={PackingList} />
        <Route path="/invoices/:id/shipping-label" component={ShippingLabel} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/schemes" component={Schemes} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/auth/quickbooks" component={QuickBooksAuth} />
        <Route path="/callback" component={QuickBooksCallback} />
        <Route path="/quickbooks/sync" component={QuickBooksSync} />
        <Route path="/users" component={UserManagement} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
