import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useWooIntegration } from "@/hooks/useSupabaseData";
import { testWooConnection, fetchAllWooOrders } from "@/lib/woocommerceApi";
import { importWooCommerceOrders } from "@/lib/importHelpers";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Eye, EyeOff, Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Plug, Calendar, Clock,
} from "lucide-react";
import { format } from "date-fns";

export default function IntegrationsPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: integration, isLoading } = useWooIntegration();

  // Form state
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Action states
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [syncAfter, setSyncAfter] = useState("");

  // Populate form from existing integration
  const hasExisting = !!integration;
  const displayUrl = storeUrl || integration?.store_url || "";
  const displayKey = consumerKey || (hasExisting ? "••••••••••" : "");
  const displaySecret = consumerSecret || (hasExisting ? "••••••••••" : "");

  const handleTest = async () => {
    if (!currentCompany) return;
    setTesting(true);
    try {
      // If user entered new credentials, save first
      if (storeUrl || consumerKey || consumerSecret) {
        await saveCredentials(true);
      }
      await testWooConnection(currentCompany.id);
      toast.success("Connection successful! WooCommerce credentials are valid.");
    } catch (err: any) {
      toast.error("Connection failed", { description: err?.message || "Check your credentials" });
    } finally {
      setTesting(false);
    }
  };

  const saveCredentials = async (silent = false) => {
    if (!currentCompany) return;
    const url = (storeUrl || integration?.store_url || "").trim();
    const key = (consumerKey || integration?.consumer_key || "").trim();
    const secret = (consumerSecret || integration?.consumer_secret || "").trim();

    if (!url || !key || !secret) {
      toast.error("Please fill in all credential fields");
      return;
    }

    // Validate URL format
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        toast.error("Store URL must use HTTPS");
        return;
      }
    } catch {
      toast.error("Invalid store URL format");
      return;
    }

    // Validate key formats
    if (!key.startsWith("ck_") || key.length < 10) {
      toast.error("Consumer Key should start with 'ck_'");
      return;
    }
    if (!secret.startsWith("cs_") || secret.length < 10) {
      toast.error("Consumer Secret should start with 'cs_'");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_id: currentCompany.id,
        store_url: url.replace(/\/+$/, ""),
        consumer_key: key,
        consumer_secret: secret,
      };

      if (hasExisting) {
        const { error } = await supabase
          .from("woocommerce_integrations")
          .update(payload)
          .eq("company_id", currentCompany.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("woocommerce_integrations")
          .insert(payload);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
      if (!silent) toast.success("Credentials saved");
    } catch (err: any) {
      toast.error("Failed to save", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!currentCompany || !user) return;
    setSyncing(true);
    setSyncProgress("Fetching orders from WooCommerce...");
    try {
      const after = syncAfter ? new Date(syncAfter).toISOString() : integration?.last_sync_at || undefined;

      const orders = await fetchAllWooOrders(currentCompany.id, after, (fetched, total) => {
        setSyncProgress(`Fetched ${fetched} of ${total} orders...`);
      });

      if (orders.length === 0) {
        toast.info("No new orders found");
        await supabase.from("woocommerce_integrations").update({
          last_sync_at: new Date().toISOString(),
          last_sync_order_count: 0,
          last_sync_status: "success",
          last_sync_error: null,
        }).eq("company_id", currentCompany.id);
        queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
        setSyncing(false);
        setSyncProgress("");
        return;
      }

      setSyncProgress(`Importing ${orders.length} orders into database...`);
      const result = await importWooCommerceOrders(orders, currentCompany.id, user.id, (p, e) => {
        setSyncProgress(`Imported ${p} orders (${e} errors)...`);
      });

      // Update sync metadata
      await supabase.from("woocommerce_integrations").update({
        last_sync_at: new Date().toISOString(),
        last_sync_order_count: result.processed,
        last_sync_status: result.errors > 0 ? "partial" : "success",
        last_sync_error: result.errors > 0 ? result.errorMessages.slice(0, 3).join("; ") : null,
      }).eq("company_id", currentCompany.id);

      queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });

      if (result.errors > 0) {
        toast.warning(`Synced ${result.processed} orders with ${result.errors} errors`);
      } else {
        toast.success(`Successfully synced ${result.processed} orders`);
      }
    } catch (err: any) {
      toast.error("Sync failed", { description: err?.message });
      await supabase.from("woocommerce_integrations").update({
        last_sync_status: "error",
        last_sync_error: err?.message || "Unknown error",
      }).eq("company_id", currentCompany.id);
      queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
    } finally {
      setSyncing(false);
      setSyncProgress("");
    }
  };

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

      {/* WooCommerce Card */}
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
            {hasExisting && (
              <Badge variant={
                integration.last_sync_status === "success" ? "default" :
                integration.last_sync_status === "error" ? "destructive" :
                integration.last_sync_status === "partial" ? "secondary" : "outline"
              }>
                {integration.last_sync_status === "never" ? "Not synced" :
                 integration.last_sync_status === "success" ? "Connected" :
                 integration.last_sync_status === "error" ? "Error" : "Partial"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Credentials */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store-url">Store URL</Label>
              <Input
                id="store-url"
                placeholder="https://yourstore.com"
                value={storeUrl || integration?.store_url || ""}
                onChange={(e) => setStoreUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your WooCommerce store URL (without trailing slash)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="consumer-key">Consumer Key</Label>
              <div className="relative">
                <Input
                  id="consumer-key"
                  type={showKey ? "text" : "password"}
                  placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="consumer-secret">Consumer Secret</Label>
              <div className="relative">
                <Input
                  id="consumer-secret"
                  type={showSecret ? "text" : "password"}
                  placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Generate API keys in WooCommerce → Settings → Advanced → REST API
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleTest} disabled={testing || syncing} variant="outline" size="sm">
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Test Connection
              </Button>
              <Button onClick={() => saveCredentials(false)} disabled={saving || syncing} size="sm">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Credentials
              </Button>
            </div>
          </div>

          {hasExisting && (
            <>
              <Separator />

              {/* Sync Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Order Sync</h3>

                {integration.last_sync_at && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      Last sync: {format(new Date(integration.last_sync_at), "PPp")}
                      {integration.last_sync_order_count > 0 && (
                        <span className="ml-1">({integration.last_sync_order_count} orders)</span>
                      )}
                    </p>
                    {integration.last_sync_status === "error" && integration.last_sync_error && (
                      <div className="flex items-start gap-2 text-destructive">
                        <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-xs">{integration.last_sync_error}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-end gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sync-after" className="text-xs">Sync orders after (optional)</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="sync-after"
                        type="date"
                        className="pl-9 w-48"
                        value={syncAfter}
                        onChange={(e) => setSyncAfter(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={handleSync} disabled={syncing || testing} size="sm">
                    {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Sync Now
                  </Button>
                </div>

                {syncProgress && (
                  <p className="text-sm text-muted-foreground animate-pulse">{syncProgress}</p>
                )}
              </div>

              <Separator />

              {/* Auto-Sync Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-foreground">Automatic Sync</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically sync new orders from WooCommerce on a schedule. The system checks every 5 minutes and syncs companies whose interval has elapsed.
                </p>

                <div className="flex items-center gap-3">
                  <Label htmlFor="sync-interval" className="text-sm whitespace-nowrap">Sync every</Label>
                  <Select
                    value={String(integration.sync_interval_minutes ?? 0)}
                    onValueChange={async (val) => {
                      const minutes = parseInt(val, 10);
                      const { error } = await supabase
                        .from("woocommerce_integrations")
                        .update({ sync_interval_minutes: minutes })
                        .eq("company_id", currentCompany!.id);
                      if (error) {
                        toast.error("Failed to update", { description: error.message });
                      } else {
                        queryClient.invalidateQueries({ queryKey: ["woo_integration"] });
                        toast.success(minutes === 0 ? "Auto-sync disabled" : `Auto-sync set to every ${minutes} minutes`);
                      }
                    }}
                  >
                    <SelectTrigger className="w-48" id="sync-interval">
                      <SelectValue />
                    </SelectTrigger>
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

                {integration.sync_interval_minutes > 0 && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Active</span> — Orders will be synced automatically every {integration.sync_interval_minutes} minutes.
                    {integration.last_sync_at && (
                      <> Next sync due around {format(
                        new Date(new Date(integration.last_sync_at).getTime() + integration.sync_interval_minutes * 60_000),
                        "PPp"
                      )}.</>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* CORS Instructions */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Optional: Direct Browser Access (CORS)
              </h4>
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
    </div>
  );
}
