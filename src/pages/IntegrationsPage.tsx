import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useWooIntegration, useShipStationIntegration, useTawkSettings } from "@/hooks/useSupabaseData";
import { testWooConnection, fetchAllWooOrders } from "@/lib/woocommerceApi";
import { testShipStationConnection, fetchShipStationOrders, fetchShipStationShipments } from "@/lib/shipstationApi";
import { importWooCommerceOrders } from "@/lib/importHelpers";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Eye, EyeOff, Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Plug, Calendar, Clock,
  Anchor, MessageCircle,
} from "lucide-react";
import { format } from "date-fns";

// ── Shared status badge helper ──
function SyncStatusBadge({ status }: { status: string | null }) {
  if (!status || status === "never") return <Badge variant="outline">Not synced</Badge>;
  if (status === "success") return <Badge variant="default">Connected</Badge>;
  if (status === "error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="secondary">Partial</Badge>;
}

export default function IntegrationsPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: wooIntegration, isLoading: wooLoading } = useWooIntegration();
  const { data: ssIntegration, isLoading: ssLoading } = useShipStationIntegration();
  const { data: tawkSettings, isLoading: tawkLoading } = useTawkSettings();

  // WooCommerce state
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [wooTesting, setWooTesting] = useState(false);
  const [wooSaving, setWooSaving] = useState(false);
  const [wooSyncing, setWooSyncing] = useState(false);
  const [wooProgress, setWooProgress] = useState("");
  const [syncAfter, setSyncAfter] = useState("");

  // ShipStation state
  const [ssApiKey, setSsApiKey] = useState("");
  const [ssApiSecret, setSsApiSecret] = useState("");
  const [showSsKey, setShowSsKey] = useState(false);
  const [showSsSecret, setShowSsSecret] = useState(false);
  const [ssTesting, setSsTesting] = useState(false);
  const [ssSaving, setSsSaving] = useState(false);
  const [ssSyncing, setSsSyncing] = useState(false);
  const [ssProgress, setSsProgress] = useState("");

  // Tawk state
  const [tawkPropertyId, setTawkPropertyId] = useState("");
  const [tawkWidgetId, setTawkWidgetId] = useState("");
  const [tawkSaving, setTawkSaving] = useState(false);

  const hasWoo = !!wooIntegration;
  const hasSS = !!ssIntegration;
  const hasTawk = !!tawkSettings;

  // ── WooCommerce handlers ──
  const handleWooTest = async () => {
    if (!currentCompany) return;
    setWooTesting(true);
    try {
      if (storeUrl || consumerKey || consumerSecret) {
        await saveWooCredentials(true);
      }
      await testWooConnection(currentCompany.id);
      toast.success("WooCommerce connection successful!");
    } catch (err: any) {
      toast.error("Connection failed", { description: err?.message });
    } finally {
      setWooTesting(false);
    }
  };

  const saveWooCredentials = async (silent = false) => {
    if (!currentCompany) return;
    const url = (storeUrl || wooIntegration?.store_url || "").trim();
    const key = (consumerKey || wooIntegration?.consumer_key || "").trim();
    const secret = (consumerSecret || wooIntegration?.consumer_secret || "").trim();

    if (!url || !key || !secret) { toast.error("Please fill in all credential fields"); return; }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") { toast.error("Store URL must use HTTPS"); return; }
    } catch { toast.error("Invalid store URL format"); return; }
    if (!key.startsWith("ck_") || key.length < 10) { toast.error("Consumer Key should start with 'ck_'"); return; }
    if (!secret.startsWith("cs_") || secret.length < 10) { toast.error("Consumer Secret should start with 'cs_'"); return; }

    setWooSaving(true);
    try {
      const payload = { company_id: currentCompany.id, store_url: url.replace(/\/+$/, ""), consumer_key: key, consumer_secret: secret };
      if (hasWoo) {
        const { error } = await supabase.from("woocommerce_integrations").update(payload).eq("company_id", currentCompany.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("woocommerce_integrations").insert(payload);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
      if (!silent) toast.success("WooCommerce credentials saved");
    } catch (err: any) {
      toast.error("Failed to save", { description: err?.message });
    } finally { setWooSaving(false); }
  };

  const handleWooSync = async () => {
    if (!currentCompany || !user) return;
    setWooSyncing(true);
    setWooProgress("Fetching orders from WooCommerce...");
    try {
      const after = syncAfter ? new Date(syncAfter).toISOString() : wooIntegration?.last_sync_at || undefined;
      const orders = await fetchAllWooOrders(currentCompany.id, after, (fetched, total) => {
        setWooProgress(`Fetched ${fetched} of ${total} orders...`);
      });
      if (orders.length === 0) {
        toast.info("No new orders found");
        await supabase.from("woocommerce_integrations").update({ last_sync_at: new Date().toISOString(), last_sync_order_count: 0, last_sync_status: "success", last_sync_error: null }).eq("company_id", currentCompany.id);
        queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
        setWooSyncing(false); setWooProgress(""); return;
      }
      setWooProgress(`Importing ${orders.length} orders...`);
      const result = await importWooCommerceOrders(orders, currentCompany.id, user.id, (p, e) => {
        setWooProgress(`Imported ${p} orders (${e} errors)...`);
      });
      await supabase.from("woocommerce_integrations").update({
        last_sync_at: new Date().toISOString(), last_sync_order_count: result.processed,
        last_sync_status: result.errors > 0 ? "partial" : "success",
        last_sync_error: result.errors > 0 ? result.errorMessages.slice(0, 3).join("; ") : null,
      }).eq("company_id", currentCompany.id);
      queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
      toast.success(`Synced ${result.processed} orders${result.errors > 0 ? ` with ${result.errors} errors` : ""}`);
    } catch (err: any) {
      toast.error("Sync failed", { description: err?.message });
      await supabase.from("woocommerce_integrations").update({ last_sync_status: "error", last_sync_error: err?.message || "Unknown error" }).eq("company_id", currentCompany.id);
      queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
    } finally { setWooSyncing(false); setWooProgress(""); }
  };

  // ── ShipStation handlers ──
  const handleSSTest = async () => {
    if (!currentCompany) return;
    setSsTesting(true);
    try {
      if (ssApiKey || ssApiSecret) await saveSSCredentials(true);
      await testShipStationConnection(currentCompany.id);
      toast.success("ShipStation connection successful!");
    } catch (err: any) {
      toast.error("Connection failed", { description: err?.message });
    } finally { setSsTesting(false); }
  };

  const saveSSCredentials = async (silent = false) => {
    if (!currentCompany) return;
    const key = (ssApiKey || ssIntegration?.api_key || "").trim();
    const secret = (ssApiSecret || ssIntegration?.api_secret || "").trim();

    if (!key || !secret) { toast.error("Please fill in both API Key and API Secret"); return; }

    setSsSaving(true);
    try {
      const payload = { company_id: currentCompany.id, api_key: key, api_secret: secret };
      if (hasSS) {
        const { error } = await supabase.from("shipstation_integrations").update(payload).eq("company_id", currentCompany.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shipstation_integrations").insert(payload);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["shipstation_integration"] });
      if (!silent) toast.success("ShipStation credentials saved");
    } catch (err: any) {
      toast.error("Failed to save", { description: err?.message });
    } finally { setSsSaving(false); }
  };

  const handleSSSync = async () => {
    if (!currentCompany || !user) return;
    setSsSyncing(true);
    setSsProgress("Fetching from ShipStation...");
    try {
      const since = ssIntegration?.last_sync_at || undefined;

      // Fetch orders
      setSsProgress("Fetching orders...");
      const orders = await fetchShipStationOrders(currentCompany.id, since, (f, t) => {
        setSsProgress(`Fetched ${f} of ${t} orders...`);
      });

      // Fetch shipments
      setSsProgress("Fetching shipments...");
      const shipments = await fetchShipStationShipments(currentCompany.id, since, (f, t) => {
        setSsProgress(`Fetched ${f} of ${t} shipments...`);
      });

      // Import orders
      let orderCount = 0;
      if (orders.length > 0) {
        setSsProgress(`Importing ${orders.length} orders...`);
        const BATCH = 50;
        for (let i = 0; i < orders.length; i += BATCH) {
          const batch = orders.slice(i, i + BATCH).map((o: any) => ({
            company_id: currentCompany.id,
            order_number: String(o.orderNumber || ""),
            order_date: o.orderDate || null,
            status: mapSSOrderStatus(o.orderStatus),
            customer_name: o.shipTo?.name || o.billTo?.name || null,
            customer_email: o.customerEmail || null,
            shipping_address: [o.shipTo?.street1, o.shipTo?.street2, o.shipTo?.city, o.shipTo?.state, o.shipTo?.postalCode, o.shipTo?.country].filter(Boolean).join(", ") || null,
            total_amount: parseFloat(o.orderTotal) || null,
            currency: "USD",
            source: "shipstation_api",
          })).filter((r: any) => r.order_number);

          if (orderRows.length > 0) {
            await supabase.from("orders").upsert(orderRows, { onConflict: "company_id,order_number", ignoreDuplicates: false });
          }
          orderCount += batch.length;
        }
      }

      // Import shipments
      let shipmentCount = 0;
      if (shipments.length > 0) {
        setSsProgress(`Importing ${shipments.length} shipments...`);
        const BATCH = 50;
        for (let i = 0; i < shipments.length; i += BATCH) {
          const batch = shipments.slice(i, i + BATCH);
          for (const s of batch) {
            const orderNum = String(s.orderNumber || "");
            if (!orderNum) continue;

            // Find order by number
            const { data: order } = await supabase
              .from("orders")
              .select("id")
              .eq("company_id", currentCompany.id)
              .eq("order_number", orderNum)
              .maybeSingle();

            if (!order) {
              // Create placeholder order
              const { data: newOrder } = await supabase
                .from("orders")
                .insert({ company_id: currentCompany.id, order_number: orderNum, source: "shipstation_api" })
                .select("id")
                .single();
              if (!newOrder) continue;

              await upsertShipment(currentCompany.id, newOrder.id, s);
            } else {
              await upsertShipment(currentCompany.id, order.id, s);
            }
            shipmentCount++;
          }
        }
      }

      await supabase.from("shipstation_integrations").update({
        last_sync_at: new Date().toISOString(),
        last_sync_order_count: orderCount,
        last_sync_shipment_count: shipmentCount,
        last_sync_status: "success",
        last_sync_error: null,
      }).eq("company_id", currentCompany.id);

      queryClient.invalidateQueries({ queryKey: ["shipstation_integration"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });

      toast.success(`Synced ${orderCount} orders and ${shipmentCount} shipments from ShipStation`);
    } catch (err: any) {
      toast.error("Sync failed", { description: err?.message });
      await supabase.from("shipstation_integrations").update({ last_sync_status: "error", last_sync_error: err?.message || "Unknown error" }).eq("company_id", currentCompany.id);
      queryClient.invalidateQueries({ queryKey: ["shipstation_integration"] });
    } finally { setSsSyncing(false); setSsProgress(""); }
  };

  // ── Tawk.to handlers ──
  const saveTawkSettings = async () => {
    if (!currentCompany) return;
    const propId = (tawkPropertyId || tawkSettings?.property_id || "").trim();
    const wId = (tawkWidgetId || tawkSettings?.widget_id || "default").trim();

    if (!propId) { toast.error("Please enter your Tawk.to Property ID"); return; }

    setTawkSaving(true);
    try {
      const payload = { company_id: currentCompany.id, property_id: propId, widget_id: wId || "default" };
      if (hasTawk) {
        const { error } = await supabase.from("tawk_settings").update(payload).eq("company_id", currentCompany.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tawk_settings").insert(payload);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["tawk_settings"] });
      toast.success("Tawk.to settings saved — chat widget will appear shortly");
    } catch (err: any) {
      toast.error("Failed to save", { description: err?.message });
    } finally { setTawkSaving(false); }
  };

  const toggleTawk = async (enabled: boolean) => {
    if (!currentCompany) return;
    const { error } = await supabase.from("tawk_settings").update({ is_enabled: enabled }).eq("company_id", currentCompany.id);
    if (error) toast.error("Failed to update");
    else {
      queryClient.invalidateQueries({ queryKey: ["tawk_settings"] });
      toast.success(enabled ? "Chat widget enabled" : "Chat widget disabled");
    }
  };

  const isLoading = wooLoading || ssLoading || tawkLoading;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external platforms to automatically sync data.
        </p>
      </div>

      {/* ── WooCommerce ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Plug className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-lg">WooCommerce</CardTitle>
                <CardDescription>Import orders directly from your WooCommerce store</CardDescription>
              </div>
            </div>
            {hasWoo && <SyncStatusBadge status={wooIntegration.last_sync_status} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store-url">Store URL</Label>
              <Input id="store-url" placeholder="https://yourstore.com" value={storeUrl || wooIntegration?.store_url || ""} onChange={(e) => setStoreUrl(e.target.value)} />
              <p className="text-xs text-muted-foreground">Your WooCommerce store URL (without trailing slash)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumer-key">Consumer Key</Label>
              <div className="relative">
                <Input id="consumer-key" type={showKey ? "text" : "password"} placeholder="ck_xxxx..." value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} />
                <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumer-secret">Consumer Secret</Label>
              <div className="relative">
                <Input id="consumer-secret" type={showSecret ? "text" : "password"} placeholder="cs_xxxx..." value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} />
                <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Generate API keys in WooCommerce → Settings → Advanced → REST API</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleWooTest} disabled={wooTesting || wooSyncing} variant="outline" size="sm">
                {wooTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Test Connection
              </Button>
              <Button onClick={() => saveWooCredentials(false)} disabled={wooSaving || wooSyncing} size="sm">
                {wooSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Credentials
              </Button>
            </div>
          </div>

          {hasWoo && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Order Sync</h3>
                {wooIntegration.last_sync_at && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Last sync: {format(new Date(wooIntegration.last_sync_at), "PPp")}
                      {wooIntegration.last_sync_order_count > 0 && <span className="ml-1">({wooIntegration.last_sync_order_count} orders)</span>}
                    </p>
                    {wooIntegration.last_sync_status === "error" && wooIntegration.last_sync_error && (
                      <div className="flex items-start gap-2 text-destructive"><XCircle className="w-4 h-4 mt-0.5 shrink-0" /><p className="text-xs">{wooIntegration.last_sync_error}</p></div>
                    )}
                  </div>
                )}
                <div className="flex items-end gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sync-after" className="text-xs">Sync orders after (optional)</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="sync-after" type="date" className="pl-9 w-48" value={syncAfter} onChange={(e) => setSyncAfter(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleWooSync} disabled={wooSyncing || wooTesting} size="sm">
                    {wooSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Sync Now
                  </Button>
                </div>
                {wooProgress && <p className="text-sm text-muted-foreground animate-pulse">{wooProgress}</p>}
              </div>
              <Separator />
              <AutoSyncSelect
                label="WooCommerce"
                value={wooIntegration.sync_interval_minutes ?? 0}
                lastSyncAt={wooIntegration.last_sync_at}
                onChange={async (minutes) => {
                  const { error } = await supabase.from("woocommerce_integrations").update({ sync_interval_minutes: minutes }).eq("company_id", currentCompany!.id);
                  if (error) toast.error("Failed to update", { description: error.message });
                  else { queryClient.invalidateQueries({ queryKey: ["woo_integration"] }); toast.success(minutes === 0 ? "Auto-sync disabled" : `Auto-sync set to every ${minutes} minutes`); }
                }}
              />
            </>
          )}

          <Separator />
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">Optional: Direct Browser Access (CORS)</h4>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              The default sync uses a secure backend proxy and works out of the box.
              If you want to enable direct browser-to-store API calls as a fallback,
              add this to your theme's <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 rounded">functions.php</code>:
            </p>
            <pre className="text-xs bg-amber-100 dark:bg-amber-900/50 rounded p-3 overflow-x-auto text-amber-900 dark:text-amber-200">
{`add_action('init', function() {
  if (strpos($_SERVER['REQUEST_URI'], '/wp-json/wc/') !== false) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
      status_header(200);
      exit();
    }
  }
});`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* ── ShipStation ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Anchor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg">ShipStation</CardTitle>
                <CardDescription>Sync orders and shipments from ShipStation</CardDescription>
              </div>
            </div>
            {hasSS && <SyncStatusBadge status={ssIntegration.last_sync_status} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ss-api-key">API Key</Label>
              <div className="relative">
                <Input id="ss-api-key" type={showSsKey ? "text" : "password"} placeholder="Your ShipStation API Key" value={ssApiKey} onChange={(e) => setSsApiKey(e.target.value)} />
                <button type="button" onClick={() => setShowSsKey(!showSsKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showSsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ss-api-secret">API Secret</Label>
              <div className="relative">
                <Input id="ss-api-secret" type={showSsSecret ? "text" : "password"} placeholder="Your ShipStation API Secret" value={ssApiSecret} onChange={(e) => setSsApiSecret(e.target.value)} />
                <button type="button" onClick={() => setShowSsSecret(!showSsSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showSsSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Generate API keys in ShipStation → Settings → API Settings
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSSTest} disabled={ssTesting || ssSyncing} variant="outline" size="sm">
                {ssTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Test Connection
              </Button>
              <Button onClick={() => saveSSCredentials(false)} disabled={ssSaving || ssSyncing} size="sm">
                {ssSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Credentials
              </Button>
            </div>
          </div>

          {hasSS && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Order & Shipment Sync</h3>
                {ssIntegration.last_sync_at && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Last sync: {format(new Date(ssIntegration.last_sync_at), "PPp")}
                      {(ssIntegration.last_sync_order_count > 0 || ssIntegration.last_sync_shipment_count > 0) && (
                        <span className="ml-1">({ssIntegration.last_sync_order_count} orders, {ssIntegration.last_sync_shipment_count} shipments)</span>
                      )}
                    </p>
                    {ssIntegration.last_sync_status === "error" && ssIntegration.last_sync_error && (
                      <div className="flex items-start gap-2 text-destructive"><XCircle className="w-4 h-4 mt-0.5 shrink-0" /><p className="text-xs">{ssIntegration.last_sync_error}</p></div>
                    )}
                  </div>
                )}
                <Button onClick={handleSSSync} disabled={ssSyncing || ssTesting} size="sm">
                  {ssSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Sync Now
                </Button>
                {ssProgress && <p className="text-sm text-muted-foreground animate-pulse">{ssProgress}</p>}
              </div>
              <Separator />
              <AutoSyncSelect
                label="ShipStation"
                value={ssIntegration.sync_interval_minutes ?? 0}
                lastSyncAt={ssIntegration.last_sync_at}
                onChange={async (minutes) => {
                  const { error } = await supabase.from("shipstation_integrations").update({ sync_interval_minutes: minutes }).eq("company_id", currentCompany!.id);
                  if (error) toast.error("Failed to update", { description: error.message });
                  else { queryClient.invalidateQueries({ queryKey: ["shipstation_integration"] }); toast.success(minutes === 0 ? "Auto-sync disabled" : `Auto-sync set to every ${minutes} minutes`); }
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Tawk.to ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Tawk.to</CardTitle>
                <CardDescription>Add a live chat widget to your app</CardDescription>
              </div>
            </div>
            {hasTawk && (
              <Badge variant={tawkSettings.is_enabled ? "default" : "outline"}>
                {tawkSettings.is_enabled ? "Active" : "Disabled"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tawk-property-id">Property ID</Label>
              <Input id="tawk-property-id" placeholder="e.g. 6123456789abcdef01234567" value={tawkPropertyId || tawkSettings?.property_id || ""} onChange={(e) => setTawkPropertyId(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Find this in your Tawk.to dashboard → Administration → Chat Widget → Direct Chat Link
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tawk-widget-id">Widget ID (optional)</Label>
              <Input id="tawk-widget-id" placeholder="default" value={tawkWidgetId || tawkSettings?.widget_id || ""} onChange={(e) => setTawkWidgetId(e.target.value)} />
              <p className="text-xs text-muted-foreground">Usually "default" unless you have multiple widgets</p>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={saveTawkSettings} disabled={tawkSaving} size="sm">
                {tawkSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Settings
              </Button>
              {hasTawk && (
                <div className="flex items-center gap-2">
                  <Switch checked={tawkSettings.is_enabled} onCheckedChange={toggleTawk} />
                  <Label className="text-sm">{tawkSettings.is_enabled ? "Enabled" : "Disabled"}</Label>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shared Auto-Sync Select ──
function AutoSyncSelect({ label, value, lastSyncAt, onChange }: {
  label: string;
  value: number;
  lastSyncAt: string | null;
  onChange: (minutes: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Automatic Sync</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Automatically sync from {label} on a schedule.
      </p>
      <div className="flex items-center gap-3">
        <Label className="text-sm whitespace-nowrap">Sync every</Label>
        <Select value={String(value)} onValueChange={(val) => onChange(parseInt(val, 10))}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Disabled</SelectItem>
            <SelectItem value="5">5 minutes</SelectItem>
            <SelectItem value="15">15 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="60">1 hour</SelectItem>
            <SelectItem value="360">6 hours</SelectItem>
            <SelectItem value="720">12 hours</SelectItem>
            <SelectItem value="1440">24 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value > 0 && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Active</span> — Syncs every {value} minutes.
          {lastSyncAt && (
            <> Next sync due around {format(
              new Date(new Date(lastSyncAt).getTime() + value * 60_000),
              "PPp"
            )}.</>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──
function mapSSOrderStatus(ssStatus: string): string {
  const map: Record<string, string> = {
    awaiting_payment: "pending",
    awaiting_shipment: "processing",
    shipped: "shipped",
    on_hold: "processing",
    cancelled: "cancelled",
  };
  return map[ssStatus] || "pending";
}

async function upsertShipment(companyId: string, orderId: string, s: any) {
  const trackingNumber = s.trackingNumber || "";
  if (!trackingNumber) return;

  const carrierMap: Record<string, string> = {
    stamps_com: "USPS", usps: "USPS", fedex: "FedEx", ups: "UPS", dhl_express: "DHL",
  };

  const payload = {
    company_id: companyId,
    order_id: orderId,
    tracking_number: trackingNumber,
    carrier: carrierMap[s.carrierCode?.toLowerCase()] || s.carrierCode || null,
    shipped_date: s.shipDate || null,
    status: s.voided ? "cancelled" : "shipped",
    shipping_cost: parseFloat(s.shipmentCost) || null,
    weight_grams: s.weight ? Math.round((s.weight.value || 0) * (s.weight.units === "pounds" ? 453.592 : s.weight.units === "ounces" ? 28.3495 : 1)) : null,
  };

  // Check if shipment with this tracking number exists
  const { data: existing } = await supabase
    .from("shipments")
    .select("id")
    .eq("company_id", companyId)
    .eq("tracking_number", trackingNumber)
    .maybeSingle();

  if (existing) {
    await supabase.from("shipments").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("shipments").insert(payload);
  }
}
