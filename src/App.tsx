import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import OrdersPage from "@/pages/OrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import InventoryPage from "@/pages/InventoryPage";
import ShipmentsPage from "@/pages/ShipmentsPage";
import UploadsPage from "@/pages/UploadsPage";
import ExceptionsPage from "@/pages/ExceptionsPage";
import ExportsPage from "@/pages/ExportsPage";
import StockMovementsPage from "@/pages/StockMovementsPage";
import AdjustmentsPage from "@/pages/AdjustmentsPage";
import SupplierManifestsPage from "@/pages/SupplierManifestsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/shipments" element={<ShipmentsPage />} />
            <Route path="/uploads" element={<UploadsPage />} />
            <Route path="/stock-movements" element={<StockMovementsPage />} />
            <Route path="/adjustments" element={<AdjustmentsPage />} />
            <Route path="/supplier-manifests" element={<SupplierManifestsPage />} />
            <Route path="/exceptions" element={<ExceptionsPage />} />
            <Route path="/exports" element={<ExportsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
