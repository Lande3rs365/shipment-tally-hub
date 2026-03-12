import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plug, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useWooIntegration } from "@/hooks/useSupabaseData";
import { testWooConnection, fetchAllWooOrders } from "@/lib/woocommerceApi";
import { previewWooCommerceImport, importWooCommerceOrders } from "@/lib/importHelpers";

// ── Types ──────────────────────────────────────────────────────────────────

interface SyncStatus {
  state: "idle" | "testing" | "fetching" | "importing" | "done" | "error";
  message: string;
  orderCount?: number;
}

// ── Component ──────────────────────────────────────────────────────────────

const IntegrationsPage = () => {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const { data: integration, isLoading } = useWooIntegration();

  // Form state
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Sync options
  const [syncAfter, setSyncAfter] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0]; // default: last 30 days
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "idle", message: "" });

  // Populate form from saved integration when loaded
  const editingExisting = !!integration;
  const displayUrl = integration?.store_url ?? "";
  const formStoreUrl = storeUrl || (editingExisting ? integration?.store_url ?? "" : "");
  const formKey = consumerKey || (editingExisting ? integration?.consumer_key ?? "" : "");
  const formSecret = consumerSecret || (editingExisting ? integration?.consumer_secret ?? "" : "");

  // ── Save credentials ──

  const handleSave = async () => {
    if (!currentCompany || !user) return;
    const url = (storeUrl || displayUrl).trim();
    const key = (consumerKey || (integration?.consumer_key ?? "")).trim();
    const secret = (consumerSecret || (integration?.consumer_secret ?? "")).trim();

    if (!url || !key || !secret) {
      toast.error("Please fill in all three fields.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_id: currentCompany.id,
        store_url: url.replace(/\/+$/, ""),
        consumer_key: key,
        consumer_secret: secret,
        is_active: true,
      };

      const { error } = editingExisting
        ? await (supabase as any).from("woocommerce_integrations").update(payload).eq("company_id", currentCompany.id)
        : await (supabase as any).from("woocommerce_integrations").insert(payload);

      if (error) throw error;

      toast.success("WooCommerce credentials saved.");
      queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
      setStoreUrl("");
      setConsumerKey("");
      setConsumerSecret("");
    } catch (err: any) {
      toast.error(`Failed to save: ${err?.message ?? "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Test connection ──

  const handleTest = async () => {
    const url = (storeUrl || displayUrl).trim();
    const key = (consumerKey || (integration?.consumer_key ?? "")).trim();
    const secret = (consumerSecret || (integration?.consumer_secret ?? "")).trim();

    if (!url || !key || !secret) {
      toast.error("Please fill in all three fields first.");
      return;
    }

    setTesting(true);
    try {
      await testWooConnection({ storeUrl: url, consumerKey: key, consumerSecret: secret });
      toast.success("Connection successful! Credentials are valid.");
    } catch (err: any) {
      toast.error(`Connection failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setTesting(false);
    }
  };

  // ── Sync orders ──

  const handleSync = async () => {
    if (!integration || !currentCompany || !user) return;

    setSyncStatus({ state: "fetching", message: "Fetching orders from WooCommerce..." });

    try {
      // 1. Fetch from WooCommerce API
      const { orders, totalFetched } = await fetchAllWooOrders(
        {
          storeUrl: integration.store_url,
          consumerKey: integration.consumer_key,
          consumerSecret: integration.consumer_secret,
        },
        { after: syncAfter ? new Date(syncAfter).toISOString() : undefined },
      );

      if (totalFetched === 0) {
        setSyncStatus({ state: "done", message: "No orders found for the selected date range.", orderCount: 0 });
        return;
      }

      setSyncStatus({ state: "importing", message: `Importing ${totalFetched} orders…` });

      // 2. Preview then import
      await previewWooCommerceImport(orders, currentCompany.id);
      const result = await importWooCommerceOrders(orders, currentCompany.id, user.id);

      // 3. Update last_sync metadata
      await (supabase as any)
        .from("woocommerce_integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_order_count: result.processed,
          last_sync_status: result.errors > 0 ? "error" : "success",
          last_sync_error: result.errors > 0 ? result.errorMessages.slice(0, 3).join("; ") : null,
        })
        .eq("company_id", currentCompany.id);

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
      queryClient.invalidateQueries({ queryKey: ["exceptions"] });

      setSyncStatus({
        state: "done",
        message: `Sync complete — ${result.processed} orders imported, ${result.errors} errors.`,
        orderCount: result.processed,
      });

      if (result.errors === 0) {
        toast.success(`Synced ${result.processed} orders from WooCommerce.`);
      } else {
        toast.warning(`Synced with ${result.errors} error(s). Check the sync log below.`);
      }
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      setSyncStatus({ state: "error", message: msg });

      // Persist error state
      if (currentCompany) {
        await (supabase as any)
          .from("woocommerce_integrations")
          .update({ last_sync_status: "error", last_sync_error: msg })
          .eq("company_id", currentCompany.id);
        queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
      }

      toast.error(`Sync failed: ${msg}`);
    }
  };

  // ── Render helpers ──

  const syncStateIcon = () => {
    if (syncStatus.state === "fetching" || syncStatus.state === "importing") {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }
    if (syncStatus.state === "done") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (syncStatus.state === "error") return <XCircle className="w-4 h-4 text-red-500" />;
    return null;
  };

  const lastSyncBadge = () => {
    if (!integration?.last_sync_status) return null;
    if (integration.last_sync_status === "success") {
      return <Badge variant="outline" className="text-green-600 border-green-300">Last sync: success</Badge>;
    }
    return <Badge variant="outline" className="text-red-600 border-red-300">Last sync: error</Badge>;
  };

  const isSyncing = syncStatus.state === "fetching" || syncStatus.state === "importing";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your WooCommerce store to sync orders directly without uploading CSV files.
        </p>
      </div>

      {/* ── CORS notice ── */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 space-y-1">
              <p className="font-semibold">Browser CORS requirement</p>
              <p>
                Your WooCommerce store must allow cross-origin requests from this app.
                Add the following to your theme's <code className="bg-amber-100 px-1 rounded">functions.php</code>:
              </p>
              <pre className="bg-amber-100 p-2 rounded text-xs overflow-x-auto mt-1">{`add_filter('rest_pre_serve_request', function($s,$r,$req) {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: GET, OPTIONS');
  header('Access-Control-Allow-Headers: Authorization, Content-Type');
  return $s;
}, 10, 3);`}</pre>
              <p className="text-xs">
                Alternatively, install the "WP REST API - CORS" plugin from the WordPress plugin repository.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Credentials card ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plug className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">WooCommerce Store</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {integration?.is_active && (
                <Badge variant="outline" className="text-green-600 border-green-300">Connected</Badge>
              )}
              {lastSyncBadge()}
            </div>
          </div>
          <CardDescription>
            Enter your WooCommerce store URL and REST API keys (Consumer Key + Consumer Secret).
            Generate them under <strong>WooCommerce → Settings → Advanced → REST API</strong>.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading saved credentials…
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="storeUrl">Store URL</Label>
                <Input
                  id="storeUrl"
                  placeholder="https://yourstore.com"
                  value={storeUrl || (integration?.store_url ?? "")}
                  onChange={(e) => setStoreUrl(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="consumerKey">Consumer Key</Label>
                <Input
                  id="consumerKey"
                  placeholder="ck_••••••••••••••••••••••••••••••••••••••••"
                  value={consumerKey || (integration?.consumer_key ?? "")}
                  onChange={(e) => setConsumerKey(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="consumerSecret">Consumer Secret</Label>
                <div className="relative">
                  <Input
                    id="consumerSecret"
                    type={showSecret ? "text" : "password"}
                    placeholder="cs_••••••••••••••••••••••••••••••••••••••••"
                    value={consumerSecret || (integration?.consumer_secret ?? "")}
                    onChange={(e) => setConsumerSecret(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing || saving}
                >
                  {testing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Test Connection
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || testing}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editingExisting ? "Update Credentials" : "Save Credentials"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Sync card — only shown when credentials exist ── */}
      {integration && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Sync Orders</CardTitle>
            </div>
            <CardDescription>
              Pull orders directly from your WooCommerce store into this app.
              {integration.last_sync_at && (
                <span className="block mt-0.5 text-xs text-muted-foreground">
                  Last synced: {new Date(integration.last_sync_at).toLocaleString()} —{" "}
                  {integration.last_sync_order_count ?? 0} orders
                </span>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="syncAfter">Sync orders created after</Label>
              <Input
                id="syncAfter"
                type="date"
                value={syncAfter}
                onChange={(e) => setSyncAfter(e.target.value)}
                className="w-44"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to sync all orders (may be slow for large stores).
              </p>
            </div>

            <Button onClick={handleSync} disabled={isSyncing} className="w-full sm:w-auto">
              {isSyncing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isSyncing ? "Syncing…" : "Sync Now"}
            </Button>

            {syncStatus.state !== "idle" && (
              <>
                <Separator />
                <div className="flex items-start gap-2 text-sm">
                  {syncStateIcon()}
                  <p className={syncStatus.state === "error" ? "text-red-600" : "text-foreground"}>
                    {syncStatus.message}
                  </p>
                </div>
              </>
            )}

            {integration.last_sync_error && syncStatus.state === "idle" && (
              <>
                <Separator />
                <div className="flex items-start gap-2 text-sm text-red-600">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>Last sync error: {integration.last_sync_error}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IntegrationsPage;
