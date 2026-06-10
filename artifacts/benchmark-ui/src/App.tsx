import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import NotFound from "@/pages/not-found";
import { Home } from "@/pages/home";
import { Landing } from "@/pages/landing";
import { RunDetail } from "@/pages/run-detail";
import { Results } from "@/pages/results";
import { Questions } from "@/pages/questions";
import { Arena } from "@/pages/arena";
import { Contact } from "@/pages/contact";
import { ADMIN_TOKEN_KEY } from "@/lib/admin";

// Attach the admin password (when present) as a Bearer token on every request.
// Only the write endpoints (launch / delete) enforce it server-side; reads stay
// public. The token lives in sessionStorage so it clears when the tab closes.
setAuthTokenGetter(() => sessionStorage.getItem(ADMIN_TOKEN_KEY));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/resultats" component={Results} />
      <Route path="/console" component={Home} />
      <Route path="/questions" component={Questions} />
      <Route path="/arena" component={Arena} />
      <Route path="/contact" component={Contact} />
      <Route path="/runs/:id" component={RunDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
