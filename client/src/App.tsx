import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Invoices from "@/pages/invoices";
import InvoiceView from "@/pages/invoice-view";
import PackingList from "@/pages/packing-list";
import Inventory from "@/pages/inventory";
import Schemes from "@/pages/schemes";
import QuickBooksAuth from "@/pages/quickbooks-auth";
import QuickBooksSync from "@/pages/quickbooks-sync";
import LegalEULA from "@/pages/legal-eula";
import LegalPrivacy from "@/pages/legal-privacy";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();
  const isInvoiceView = (location.startsWith("/invoices/") && location !== "/invoices");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-secondary/20 flex flex-col">
      {!isInvoiceView && <Navbar />}
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/invoices/:id" component={InvoiceView} />
          <Route path="/invoices/:id/packing-list" component={PackingList} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/schemes" component={Schemes} />
          <Route path="/auth/quickbooks" component={QuickBooksAuth} />
          <Route path="/quickbooks/sync" component={QuickBooksSync} />
          <Route path="/legal/eula" component={LegalEULA} />
          <Route path="/legal/privacy-policy" component={LegalPrivacy} />
          <Route component={NotFound} />
        </Switch>
      </main>
      {!isInvoiceView && <Footer />}
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
