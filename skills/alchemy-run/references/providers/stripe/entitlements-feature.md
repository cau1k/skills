# EntitlementsFeature

The EntitlementsFeature resource lets you create and manage [Stripe Entitlements Features](https://stripe.com/docs/api/entitlements/feature) for controlling access to product features.

## Minimal Example

Create a basic feature for API access:

```ts


const apiFeature = await EntitlementsFeature("api-access", {
  name: "API Access",
  lookupKey: "api_access_v1",
});
```

## Analytics Feature

Create a feature for advanced analytics:

```ts


const analyticsFeature = await EntitlementsFeature("advanced-analytics", {
  name: "Advanced Analytics",
  lookupKey: "analytics_advanced",
  metadata: {
    tier: "enterprise",
    category: "analytics",
  },
});
```

## Custom Integrations Feature

Create a feature for custom integrations:

```ts


const integrationsFeature = await EntitlementsFeature("custom-integrations", {
  name: "Custom Integrations",
  lookupKey: "integrations_custom",
  metadata: {
    tier: "enterprise",
    category: "integrations",
    limit: "unlimited",
  },
});
```
