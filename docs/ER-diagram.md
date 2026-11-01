# CampusCart data model

CampusCart stores its data in MongoDB through Mongoose. There are 10 collections. MongoDB doesn't enforce foreign keys, so the relationships below are held as ObjectId references, with the rules enforced in the application.

![Entity relationship diagram](ER-diagram.png)

## Diagram source

```mermaid
erDiagram
    direction LR
    COUPON |o--o{ ORDER : "discounts, by code"
    USER ||--o{ SETUP : saves
    USER ||--o| CART : has
    USER ||--o{ ORDER : places
    USER ||--o{ REVIEW : writes
    USER }o--o{ PRODUCT : wishlists
    KIT }o--|{ PRODUCT : bundles
    CATEGORY ||--o{ PRODUCT : groups
    CART }o--o{ PRODUCT : holds
    SETUP }o--o{ PRODUCT : "fills a slot with"
    ORDER }o--|{ PRODUCT : "snapshots"
    PRODUCT ||--o{ REVIEW : receives
    ORDER ||--o{ REVIEW : "verifies"

    USER {
        ObjectId _id PK
        string name
        string email UK
        string passwordHash
        string role "student or admin"
        string college
        string branch
        number semester
        array addresses "embedded"
        array wishlist FK "Product ids"
        boolean isActive
    }
    CATEGORY {
        ObjectId _id PK
        string name
        string slug UK
        string icon
        number sortOrder
        boolean isActive
    }
    PRODUCT {
        ObjectId _id PK
        string name
        string slug UK
        string sku UK
        string brand
        ObjectId category FK
        number price "whole rupees"
        number mrp
        number stock
        number lowStockThreshold
        array specs "group, key, value"
        string setupSlot "optional"
        array semesters
        number ratingAvg
        number ratingCount
        number soldCount
        boolean isActive "soft delete"
    }
    CART {
        ObjectId _id PK
        ObjectId user FK,UK
        array items "product, qty"
        string couponCode
    }
    ORDER {
        ObjectId _id PK
        string orderNumber UK
        ObjectId user FK
        array items "snapshot of each product"
        object shippingAddress "snapshot"
        object payment "method, status, reference"
        number subtotal
        number discount
        string couponCode
        number shippingFee
        number total
        string status
        array statusHistory
        date estimatedDelivery
    }
    REVIEW {
        ObjectId _id PK
        ObjectId user FK
        ObjectId product FK
        ObjectId order FK
        number rating "1 to 5"
        string title
        string body
        boolean verified
    }
    KIT {
        ObjectId _id PK
        string name
        string slug UK
        string audience
        number semester
        array items "product, qty"
        boolean isActive
    }
    SETUP {
        ObjectId _id PK
        ObjectId user FK
        string name
        number budget
        array slots "slot, product"
    }
    COUPON {
        ObjectId _id PK
        string code UK
        string type "percent or flat"
        number value
        number minOrder
        number maxDiscount
        date expiresAt
        number usageLimit
        number usedCount
        number perUserLimit
        boolean isActive
    }
    COUNTER {
        string _id PK "for example order-2026"
        number value
    }
```

## Design decisions

| Decision | Reason |
|---|---|
| Order items and the address are copied onto the order | Later edits to a product or address can't change what an old order shows |
| Cart items store only a product and quantity | Prices are always calculated from the current product, so a cart can't show a stale price |
| Products are hidden, not deleted | Past orders and reviews keep working |
| Money is stored as whole rupees | Avoids decimal rounding errors |
| One review per user and product (a unique index) | The database itself blocks duplicates, even if two requests arrive together |
| `ratingAvg`, `ratingCount` and `soldCount` are stored on the product | Listing and sorting stay fast. They are recalculated whenever a review or order changes |
| `COUNTER` holds the running order number | Incremented atomically, so two orders can't get the same number |
