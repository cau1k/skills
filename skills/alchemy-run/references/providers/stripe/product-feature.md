# ProductFeature

The ProductFeature resource lets you create and manage [Stripe Product Features](https://stripe.com/docs/api/product_features) for attaching entitlement features to products.

## Minimal Example

Attach an API access feature to a product:

```ts


const productApiFeature = await ProductFeature("product-api-access", {
  product: "prod_xyz123",
  entitlementFeature: "feat_abc456",
});
```

## Analytics Feature

Attach analytics feature to a premium product:

```ts


const productAnalytics = await ProductFeature("premium-analytics", {
  product: "prod_premium789",
  entitlementFeature: "feat_analytics123",
});
```

## Enterprise Integrations

Attach custom integrations to enterprise product:

```ts


const enterpriseIntegrations = await ProductFeature("enterprise-integrations", {
  product: "prod_enterprise456",
  entitlementFeature: "feat_integrations789",
});
```
