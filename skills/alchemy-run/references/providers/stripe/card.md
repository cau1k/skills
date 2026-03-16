# Card

The Card resource lets you create and manage [Stripe Cards](https://stripe.com/docs/api/cards) attached to customers for payment processing.

## Minimal Example

Create a card using raw card details:

```ts


const customerCard = await Card("customer-card", {
  customer: "cus_xyz123",
  number: "4242424242424242",
  expMonth: 12,
  expYear: 2025,
  cvc: "123",
  name: "John Doe",
});
```

## Card with Address

Create a card with full billing address information:

```ts


const cardWithAddress = await Card("card-with-address", {
  customer: "cus_xyz123",
  number: "4242424242424242",
  expMonth: 12,
  expYear: 2025,
  cvc: "123",
  name: "John Doe",
  addressLine1: "123 Main St",
  addressCity: "San Francisco",
  addressState: "CA",
  addressZip: "94105",
  addressCountry: "US",
});
```

## Card from Token

Create a card using a Stripe token:

```ts


const tokenCard = await Card("token-card", {
  customer: "cus_xyz123",
  source: "tok_visa",
  metadata: {
    type: "primary",
    source: "mobile_app",
  },
});
```
