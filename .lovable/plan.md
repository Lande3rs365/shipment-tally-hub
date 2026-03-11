

## Micro-Payment Add-Ons: Extra Invites and Premium Access Areas

### Concept

Add a "Buy Me a Coffee"-style one-time payment system where users can:
1. **Purchase extra invite slots** beyond the free 3-member limit (e.g., $5 per additional seat)
2. **Unlock premium access areas** (e.g., Advanced Analytics, API Access, Priority Support) via small one-off payments

### How It Works

We'll use the Stripe integration to handle one-time payments. Each purchase is recorded in a new `purchased_addons` table so the app knows what a company has unlocked.

### Database Changes

New table: `purchased_addons`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| company_id | uuid | FK |
| addon_type | text | `extra_seat`, `analytics`, `api_access`, etc. |
| quantity | int | For seats: how many extra; for features: 1 |
| stripe_payment_id | text | Reference to Stripe payment |
| purchased_by | uuid | User who bought it |
| created_at | timestamptz | |

RLS: company members can read; owners/admins can insert (via edge function).

### Seat Limit Logic Change

Current: hard limit of 3.
New: `FREE_MEMBER_LIMIT + purchased extra seats`. The Settings Team tab queries `purchased_addons` where `addon_type = 'extra_seat'` and sums the quantity.

### UI Changes

| Location | Change |
|----------|--------|
| **Settings > Team tab** | When at limit, show "Buy Extra Seat — $5" button instead of (or alongside) the upgrade prompt. Clicking triggers Stripe Checkout for a one-time $5 payment. |
| **Billing Page** | Add an "Add-Ons" section below the plans grid showing purchasable extras: Extra Seat ($5), Advanced Analytics ($19), API Access ($29). Each with a buy button. |
| **Sidebar / Nav** | Premium-locked pages (e.g., future Analytics page) show a lock icon and redirect to the add-on purchase if not unlocked. |

### Implementation Steps

1. **Enable Stripe** via the Stripe tool (collects secret key)
2. **Create migration** for `purchased_addons` table with RLS
3. **Create edge function** `purchase-addon` that creates a Stripe Checkout session for the selected add-on, returns the checkout URL
4. **Create edge function** `stripe-addon-webhook` that listens for `checkout.session.completed`, inserts into `purchased_addons`
5. **Update `SettingsPage.tsx`** Team tab to factor in purchased seats
6. **Update `BillingPage.tsx`** with an Add-Ons section
7. **Add a helper hook** `usePurchasedAddons` to query what a company has unlocked

### Stripe Flow

```text
User clicks "Buy Extra Seat"
  → calls purchase-addon edge function
  → creates Stripe Checkout Session (one-time $5)
  → redirects user to Stripe
  → user pays
  → Stripe webhook fires
  → edge function inserts into purchased_addons
  → user returns to Settings, sees new seat available
```

