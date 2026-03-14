import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import CompanyGate from "@/components/CompanyGate";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import OrdersPage from "@/pages/OrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import InventoryPage from "@/pages/InventoryPage";
import ShipmentsPage from "@/pages/ShipmentsPage";
import ExceptionsPage from "@/pages/ExceptionsPage";
import StockMovementsPage from "@/pages/StockMovementsPage";
import SupplierManifestsPage from "@/pages/SupplierManifestsPage";
import ReturnsPage from "@/pages/ReturnsPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import OnboardingPage from "@/pages/OnboardingPage";
import AcceptInvitePage from "@/pages/AcceptInvitePage";
import ProductsPage from "@/pages/ProductsPage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import AIAgentPage from "@/pages/AIAgentPage";
import BillingPage from "@/pages/BillingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry failed requests up to 2 times with exponential back-off (1s → 2s → 4s)
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      // Keep data fresh for 30 s before triggering a background refetch
      staleTime: 30_000,
    },
  },
});

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <CompanyProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accept-invite"
                element={
                  <ProtectedRoute>
                    <AcceptInvitePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <CompanyGate>
                      <AppLayout>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/orders" element={<OrdersPage />} />
                          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                          <Route path="/inventory" element={<InventoryPage />} />
                          <Route path="/shipments" element={<ShipmentsPage />} />
                          <Route path="/stock-movements" element={<StockMovementsPage />} />
                          <Route path="/supplier-manifests" element={<SupplierManifestsPage />} />
                          <Route path="/returns" element={<ReturnsPage />} />
                          <Route path="/exceptions" element={<ExceptionsPage />} />
                          <Route path="/products" element={<ProductsPage />} />
                          <Route path="/profile" element={<ProfilePage />} />
                          <Route path="/settings" element={<SettingsPage />} />
                          <Route path="/ai-agent" element={<AIAgentPage />} />
                          <Route path="/billing" element={<BillingPage />} />
                          {/* Redirects for old standalone routes */}
                          <Route path="/uploads" element={<Navigate to="/settings?tab=data-intake" replace />} />
                          <Route path="/exports" element={<Navigate to="/settings?tab=exports" replace />} />
                          <Route path="/integrations" element={<Navigate to="/settings?tab=integrations" replace />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AppLayout>
                    </CompanyGate>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
