import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Users, Warehouse, Headphones } from "lucide-react";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    current: true,
    features: [
      "Up to 3 team members",
      "1 stock location",
      "Basic inventory tracking",
      "CSV / XLSX imports",
    ],
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    current: false,
    popular: true,
    features: [
      "Up to 15 team members",
      "Unlimited stock locations",
      "Advanced analytics",
      "Priority support",
      "API access",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    current: false,
    features: [
      "Unlimited team members",
      "Unlimited everything",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
];

export default function BillingPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Plans & Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a plan that fits your team's needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`border-border bg-card relative ${
              plan.popular ? "ring-2 ring-primary" : ""
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                  <Crown className="w-3 h-3" /> Most Popular
                </Badge>
              </div>
            )}
            <CardHeader className="text-center pt-6">
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                {plan.period && (
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.current ? (
                <Button variant="outline" disabled className="w-full">
                  Current Plan
                </Button>
              ) : plan.name === "Enterprise" ? (
                <Button variant="outline" className="w-full" onClick={() => window.open("mailto:support@distrohub.app", "_blank")}>
                  <Headphones className="w-4 h-4 mr-1" /> Contact Sales
                </Button>
              ) : (
                <Button className="w-full gap-1.5">
                  <Crown className="w-4 h-4" /> Upgrade to {plan.name}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
          ← Back to Settings
        </Button>
      </div>
    </div>
  );
}
