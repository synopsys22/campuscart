# CampusCart REST API

Base URL when running locally: `http://localhost:5000/api`

To try every endpoint, import the collection in [postman/](postman/) and run it in order. It logs in first, then reuses the saved tokens and ids.

## Conventions

**Authentication.** Send the token from login or registration as a header:

```
Authorization: Bearer <token>
```

| Access | Meaning |
|---|---|
| Public | No token needed |
| User | Any logged-in, active account |
| Admin | An account with the admin role |

**Success response**

```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 12, "total": 59, "pages": 5 } }
```

`meta` appears only on paginated lists.

**Error response**

```json
{
  "success": false,
  "message": "Please check the highlighted fields.",
  "errors": { "pincode": "Enter a 6-digit pincode." }
}
```

`errors` appears only for field problems.

| Status | Meaning |
|---|---|
| 200, 201 | Success, and created |
| 400 | Invalid input, or a business rule refused it (for example, not enough stock) |
| 401 | Not logged in, or the session expired |
| 403 | Logged in, but not allowed |
| 404 | Not found. Also returned for another user's order or build, so ids can't be probed |
| 409 | Conflict, such as an email that's already registered |

Money is in whole rupees. Prices include tax.

## Health

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | Server status, and which database mode is active |

## Auth

| Method | Path | Access | Body |
|---|---|---|---|
| POST | `/auth/register` | Public | `name`, `email`, `password` (8+ characters), optional `college`, `branch`, `semester` |
| POST | `/auth/login` | Public | `email`, `password` |
| POST | `/auth/logout` | Public | None. The client discards its token |
| GET | `/auth/me` | User | None |

Login and registration return `{ token, user }`.

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@campuscart.dev","password":"Student@123"}'
```

## Profile

| Method | Path | Access | Body |
|---|---|---|---|
| PATCH | `/users/me` | User | Any of `name`, `phone`, `college`, `branch`, `semester` |
| PATCH | `/users/me/password` | User | `currentPassword`, `newPassword` |
| POST | `/users/me/addresses` | User | `label`, `line1`, `line2`, `city`, `state`, `pincode`, optional `isDefault` |
| PATCH | `/users/me/addresses/:id` | User | The same fields |
| DELETE | `/users/me/addresses/:id` | User | None |

Address routes return the full updated address list.

## Products

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/products` | Public | List, with the filters below |
| GET | `/products/filters` | Public | Categories with counts, brands, price range, semesters |
| GET | `/products/suggest?q=` | Public | Up to 6 quick-search matches |
| GET | `/products/compare?ids=a,b` | Public | Up to 4 products, in the order requested |
| GET | `/products/:slug` | Public | One product. Admins can also see hidden products |
| GET | `/products/:slug/related` | Public | Up to 4 from the same category |
| POST | `/products` | Admin | Create |
| PATCH | `/products/:id` | Admin | Update any fields |
| PATCH | `/products/:id/stock` | Admin | Body: `stock` |
| DELETE | `/products/:id` | Admin | Hide from the store. Past orders are unaffected |
| POST | `/uploads` | Admin | Upload an image: multipart field `image`, JPG, PNG or WebP, up to 2 MB. Returns `{ url }` |

**Filters for `GET /products`**

| Parameter | Example | Notes |
|---|---|---|
| `q` | `rasp` | Matches parts of words, in name, brand, tags and SKU |
| `category` | `dev-hardware,laptops` | Category slugs, comma-separated |
| `brand` | `Anker,Logitech` | Comma-separated |
| `minPrice`, `maxPrice` | `500` | Rupees |
| `rating` | `4` | Minimum average rating |
| `inStock` | `true` | |
| `semester` | `5` | 1 to 8 |
| `sort` | `price_asc` | `featured`, `newest`, `popular`, `rating`, `price_asc`, `price_desc` |
| `page`, `limit` | `2`, `12` | `limit` is at most 100 |
| `includeInactive`, `lowStock` | `true` | Admin only |

**Create product body**

```json
{
  "name": "ESP32 Dev Board",
  "brand": "Espressif",
  "sku": "ESP-32",
  "description": "A Wi-Fi and Bluetooth microcontroller board.",
  "category": "<category id>",
  "price": 449,
  "mrp": 699,
  "stock": 85,
  "highlights": ["Built-in Wi-Fi and Bluetooth"],
  "tags": ["iot"],
  "images": ["/uploads/photo.png"],
  "specs": [{ "group": "Connectivity", "key": "Wi-Fi", "value": "802.11 b/g/n" }],
  "setupSlot": null,
  "semesters": [3, 5],
  "isFeatured": false,
  "isActive": true
}
```

## Categories

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/categories` | Public | None |
| POST | `/categories` | Admin | `name`, optional `description`, `icon`, `sortOrder`, `isActive` |
| PATCH | `/categories/:id` | Admin | The same fields |
| DELETE | `/categories/:id` | Admin | Refused with 409 while the category has products |

## Cart

Every cart route returns the full cart view, with live prices and totals:

```json
{
  "items": [
    { "product": { }, "qty": 2, "lineTotal": 1298, "available": true, "issue": null }
  ],
  "couponCode": "STUDENT10",
  "couponError": null,
  "pricing": {
    "subtotal": 1298, "discount": 129, "shippingFee": 0, "total": 1169,
    "itemCount": 2, "savings": 629, "freeShippingThreshold": 999, "amountToFreeShipping": 0
  },
  "canCheckout": true
}
```

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/cart` | User | None |
| DELETE | `/cart` | User | None. Clears the cart |
| POST | `/cart/items` | User | `productId`, optional `qty` (adds to any quantity already there) |
| PATCH | `/cart/items/:productId` | User | `qty` |
| DELETE | `/cart/items/:productId` | User | None |
| POST | `/cart/coupon` | User | `code` |
| DELETE | `/cart/coupon` | User | None |

Shipping is free from ₹999, and ₹49 below that.

## Wishlist

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/wishlist` | User | Saved products |
| POST | `/wishlist/:productId` | User | Save. Saving twice changes nothing |
| DELETE | `/wishlist/:productId` | User | Remove |

## Orders

| Method | Path | Access | Body or query |
|---|---|---|---|
| POST | `/orders` | User | `address` and `paymentMethod`: `COD`, `MOCK_UPI` or `MOCK_CARD`. Uses the current cart |
| GET | `/orders/my` | User | Query: `status`, `page`, `limit` |
| GET | `/orders/:id` | Owner or admin | None |
| POST | `/orders/:id/cancel` | Owner or admin | Optional `reason`. Only while Pending or Confirmed |
| GET | `/orders` | Admin | Query: `status`, `search` (order number or customer), `from`, `to`, `page`, `limit` |
| PATCH | `/orders/:id/status` | Admin | `status`, optional `note` |

**Status flow:** `Pending → Confirmed → Shipped → Delivered`. An order moves one step at a time. `Cancelled` is possible from Pending or Confirmed, and it restores stock and coupon use.

## Reviews

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/products/:id/reviews` | Public | Paginated, plus `summary.distribution` of star counts |
| GET | `/products/:id/reviews/eligibility` | User | `{ canReview, reason, existingReview, orderId }` |
| POST | `/products/:id/reviews` | User | Needs a delivered order containing the product. Body: `rating`, `title`, `body` |
| PATCH | `/reviews/:id` | Author | Any of those fields |
| DELETE | `/reviews/:id` | Author or admin | Recalculates the product's rating |
| GET | `/reviews/my` | User | My reviews |
| GET | `/reviews` | Admin | All reviews |

## Project Kits

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/kits` | Public | With live `totalPrice`, `mrpTotal`, `itemCount` and `inStock` |
| GET | `/kits/:slug` | Public | One kit |
| POST | `/kits/:id/add-to-cart` | User | Returns `{ cart, added, skipped }`. Unavailable items are skipped and reported |
| POST | `/kits` | Admin | `name`, `description`, `items: [{ product, qty }]`, optional `audience`, `semester`, `image`, `isFeatured`, `isActive` |
| PATCH | `/kits/:id` | Admin | The same fields |
| DELETE | `/kits/:id` | Admin | The products stay in the store |

## Build Your Setup

Slots: `laptop`, `mouse`, `keyboard`, `monitor`, `headset`, `storage`, `bag`.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/setups/slots` | Public | Every slot with its in-stock options |
| GET | `/setups` | User | My builds, with `total` and `overBudget` |
| POST | `/setups` | User | `name`, optional `budget`, `slots: [{ slot, product }]`. A product must fit its slot |
| PATCH | `/setups/:id` | Owner | The same fields |
| DELETE | `/setups/:id` | Owner | |
| POST | `/setups/:id/add-to-cart` | Owner | Returns `{ cart, added, skipped }` |

## Coupons

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/coupons/available` | User | Coupons usable right now |
| GET | `/coupons` | Admin | All coupons |
| POST | `/coupons` | Admin | `code`, `type` (`percent` or `flat`), `value`, optional `description`, `minOrder`, `maxDiscount`, `startsAt`, `expiresAt`, `usageLimit`, `perUserLimit`, `isActive` |
| PATCH | `/coupons/:id` | Admin | The same fields |
| DELETE | `/coupons/:id` | Admin | |

## Users (admin)

| Method | Path | Description |
|---|---|---|
| GET | `/users` | Query: `search`, `role`, `page`, `limit` |
| GET | `/users/:id` | Profile, order count and last 5 orders |
| PATCH | `/users/:id` | Body: `role`, `isActive`. Admins can't demote or deactivate themselves |

## Analytics (admin)

Cancelled orders are excluded from revenue.

| Method | Path | Returns |
|---|---|---|
| GET | `/admin/analytics/summary` | `revenue`, `orders`, `averageOrderValue`, `customers`, `pendingOrders`, `lowStockCount` |
| GET | `/admin/analytics/revenue?range=30d` | One row per day: `date`, `revenue`, `orders`. Ranges: `7d`, `30d`, `90d` |
| GET | `/admin/analytics/category-sales` | `category`, `revenue`, `units` |
| GET | `/admin/analytics/top-products` | Top 5: `name`, `units`, `revenue` |
| GET | `/admin/analytics/order-status` | `status`, `count`, for all five statuses |
| GET | `/admin/analytics/low-stock` | Products at or below their alert level |
