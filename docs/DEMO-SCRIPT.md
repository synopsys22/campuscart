# CampusCart review script

A 10-minute walkthrough for the project review, followed by questions an examiner is likely to ask.

## Before the review

1. Open a terminal in the project folder.
2. Run `npm run db:reset -- --force` for fresh demo data in Atlas. Do this on the day of the review: the demo orders are dated relative to today, so the order out for delivery and the order that can still be returned stay current. This wipes any orders placed since the last reset.
3. Run `npm start` and wait for "CampusCart is running".
4. Open <http://localhost:5000>.
5. Press F11 for a full-screen browser, and zoom to 100%.

The app uses MongoDB Atlas, so the laptop needs internet. If the network fails, rename `.env` to `offline.env` and run `npm start` again: the app falls back to its built-in database, which fills itself with the same demo data.

## The walkthrough

### 1. The idea (1 minute)

**Show:** the home page. Hover over the circuit board so the traces light up.

**Say:** "CampusCart is an online store for Computer Science students. General stores don't know that a CS student needs a Raspberry Pi, the CLRS textbook and a laptop bag, so this one is built around them. It's built with React, Node, Express and MongoDB."

### 2. Finding products (1.5 minutes)

1. Press **Ctrl+K** and type `rasp`. Results appear from a partial word. Press Esc.
2. Click **Shop**. Tick **CS Textbooks**, then sort by **Price: low to high**. Point out that the filters are in the URL, so a filtered page can be shared.
3. Click **For semester: 5** to show the CS-specific filter.
4. Open **Raspberry Pi 5**. Show the specs table, ratings and verified reviews.

### 3. Buying as a student (2.5 minutes)

1. Click **Log in**, then **Log in as Student**.
2. Open **Project Kits**, then **IoT Starter Kit**, and click **Add all to cart**. Point out that one item is low on stock.
3. Open the **cart**. Enter `EXPIRED20` to show the clear error, then `STUDENT10` to show the discount.
4. Click **Go to checkout**. Point out the three delivery options with their fees and dates, and pick **Campus pickup** to show the pickup points and time slots. Switch back to **Standard delivery**.
5. Choose **Card (demo)**, then **Pay**. In the payment window, click **Use** on the *declined* test card first: the payment fails cleanly and nothing is charged. Click **Try again**, use the first Visa card, and enter the OTP `123456`.
6. On the success page, click **Track this order** to show the timeline.
7. Open **My orders**, filter by **Out for Delivery**, and open that order. Show the **delivery code** and the tracking number. Click **Tracking page**: anyone with the number can follow the parcel, with no personal details shown.
8. Open **Wallet** to show the balance and statement.

**Optional, with a phone:** at step 5 choose **UPI (demo)** instead. Scan the QR code with a phone and tap **Approve**: the laptop moves on by itself. This works on the deployed site; on localhost, use **Approve on this device**.

### 4. CS features (1 minute)

1. Open **Build Your Setup**. Enter a budget of `15000`, then pick a keyboard, a mouse and a monitor. The total and budget meter update live.
2. Go to **Shop**, click the compare button on two laptops, then **Compare**. Tick **Show differences only**.

### 5. Running the store as an admin (2.5 minutes)

1. Log out, then use **Log in as Admin**. The dashboard opens. Point out the orange **Admin mode** strip and colour: it is the same application, and the role decides what you see and can do.
2. Explain the revenue chart, sales by category, order status and low-stock alerts. Switch the range from 30 to 90 days.
3. Open **Orders**, find the order you just placed, and click **Mark as Confirmed**. Say that the server refuses skipped steps. For an order that is out for delivery, **Mark as Delivered** asks for the customer's delivery code, which the admin cannot see.
4. On the dashboard, click **Returns to review**, open a request and click **Approve and refund**. Stock goes back and the refund is issued.
5. Open **Payments** to show every attempt, including failed ones and refunds, then the **Wallet activity** tab.
6. Open **Inventory**. Change a product's stock and save.
7. Open **Products**, click **Add product**, and enter a price above the MRP to show the validation.

### 6. How it was checked (1 minute)

**Show:** run `npm test` in a second terminal.

**Say:** "There are automated tests for the API and for the browser, including accessibility checks in both themes." Click the theme toggle at the end to show the light theme.

## Likely questions

**Why MongoDB rather than SQL?**
Products have very different specs: a laptop has RAM, and a book has an author. A document database stores those naturally, and Mongoose still gives validation and structure.

**What stops two students buying the last unit?**
Stock is reduced with one conditional database update: "reduce by this quantity only if at least this quantity remains". MongoDB applies each update atomically, so only one order can win. There's an automated test for exactly this.

**You don't use transactions. What happens if something fails midway?**
MongoDB transactions need a replica set, and this runs on a single server. So `placeOrder` tracks each step it completes and undoes them on failure: stock and coupon use go back, and the cart is restored.

**How does login work?**
Passwords are hashed with bcrypt. Logging in returns a JWT, which the client sends in the `Authorization` header. Middleware verifies it on each protected route, and a second middleware checks the admin role.

**Can a student reach admin features by changing the URL?**
They see an "admin only" page, but the real protection is on the server: every admin API route checks the role, and returns 403 otherwise.

**Why is the order's product data copied rather than referenced?**
So old orders stay correct. If a product's price or name changes later, past orders still show what the customer actually bought.

**How are reviews kept genuine?**
A review needs a delivered order containing that product, and a unique database index allows one review per user and product.

**Where is the database? I don't see MongoDB installed.**
The project uses `mongodb-memory-server` to run a real `mongod` process with no separate install, saving its data to disk. It also supports a normal local MongoDB or Atlas through `MONGODB_URI`, with no code change. The startup message prints the address, so the MongoDB extension can browse it live.

**Why are the product images illustrations?**
They're generated SVGs, so the demo works offline and there are no licensing issues. Admins can upload real photos.

**Is real payment supported?**
No, and that's a deliberate scope decision. CampusCart has its own practice gateway that behaves like a real one: a payment is opened on the server, then the card details and bank OTP, or the UPI approval, decide whether it succeeds. The order is created only after the payment has gone through, so a failed payment never leaves a half-made order. Only the published test cards are accepted, and a real card number is refused in the browser before it is sent anywhere.

**What if the order fails after the money was taken?**
The payment is refunded automatically, and the error message says so. For example, if the last unit sells out while the student is typing the OTP, they see "Only 1 left in stock. Your payment of ₹X has been refunded."

**How does the QR code work without the phone being logged in?**
The QR code holds a link with a random 32-character token that only that payment knows. The phone page sends the token back, and the server compares it in constant time. The laptop checks the payment every 1.5 seconds and moves on once it succeeds.

**Why does delivery need a code?**
It proves the parcel reached the right person. The 4-digit code is generated when the order goes out for delivery and only the customer's own order page shows it. The server hides it from the admin, so the admin must ask for it.

**How can the wallet balance never go negative?**
Like stock, the balance is changed with one conditional update: "take ₹X only if the balance is at least ₹X". There's a test that races two payments against one balance.

**What would you add next?**
A seller role so students can resell used books, a real payment provider in place of the practice gateway, email notifications, and password reset.

## If something goes wrong

| Problem | Fix |
|---|---|
| "Port 5000 is already in use" | Close the other program, or set `PORT=5001` in a `.env` file |
| Demo data looks messy | Stop the app, then run `npm run db:reset -- --force` and `npm start` |
| Page looks out of date | Press Ctrl+F5 |
