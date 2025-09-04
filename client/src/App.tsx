import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Invoices from "@/pages/invoices";
import InvoiceView from "@/pages/invoice-view";
import Inventory from "@/pages/inventory";
import Schemes from "@/pages/schemes";
import QuickBooksAuth from "@/pages/quickbooks-auth";
import QuickBooksSync from "@/pages/quickbooks-sync";
import Navbar from "@/components/layout/navbar";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-secondary/20">
      <Navbar />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/invoices/:id" component={InvoiceView} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/schemes" component={Schemes} />
        <Route path="/auth/quickbooks" component={QuickBooksAuth} />
        <Route path="/quickbooks/sync" component={QuickBooksSync} />
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
