import { Router } from 'express';
import mongoose from 'mongoose';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as authController from '../controllers/auth.controller.js';
import * as cartController from '../controllers/cart.controller.js';
import * as categoryController from '../controllers/category.controller.js';
import * as couponController from '../controllers/coupon.controller.js';
import * as deliveryController from '../controllers/delivery.controller.js';
import * as kitController from '../controllers/kit.controller.js';
import * as orderController from '../controllers/order.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import * as setupController from '../controllers/setup.controller.js';
import * as userController from '../controllers/user.controller.js';
import * as wishlistController from '../controllers/wishlist.controller.js';
import { auth, optionalAuth, requireAdmin } from '../middleware/auth.js';
import { imageUploaded, uploadImage } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import * as authV from '../validators/auth.validators.js';
import * as catalogV from '../validators/catalog.validators.js';
import { addressSchema, idParams } from '../validators/common.js';
import * as extrasV from '../validators/extras.validators.js';
import * as paymentV from '../validators/payment.validators.js';
import * as shopV from '../validators/shop.validators.js';

const router = Router();
const admin = [auth, requireAdmin];

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      databaseMode: req.app.locals.databaseMode || 'unknown',
    },
  });
});

// Auth
router.post('/auth/register', validate({ body: authV.registerSchema }), authController.register);
router.post('/auth/login', validate({ body: authV.loginSchema }), authController.login);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', auth, authController.me);

// Profile. These come before /users/:id so "me" is not read as an id.
router.patch('/users/me', auth, validate({ body: authV.updateProfileSchema }), userController.updateProfile);
router.patch('/users/me/password', auth, validate({ body: authV.changePasswordSchema }), userController.changePassword);
router.post('/users/me/addresses', auth, validate({ body: addressSchema }), userController.addAddress);
router.patch('/users/me/addresses/:id', auth, validate({ params: idParams, body: addressSchema }), userController.updateAddress);
router.delete('/users/me/addresses/:id', auth, validate({ params: idParams }), userController.deleteAddress);

// Admin: users
router.get('/users', admin, validate({ query: authV.listUsersQuery }), userController.listUsers);
router.get('/users/:id', admin, validate({ params: idParams }), userController.getUser);
router.patch('/users/:id', admin, validate({ params: idParams, body: authV.adminUpdateUserSchema }), userController.adminUpdateUser);

// Products. Fixed paths come before /products/:slug.
router.get('/products', optionalAuth, validate({ query: catalogV.listProductsQuery }), productController.listProducts);
router.get('/products/filters', productController.filterOptions);
router.get('/products/suggest', validate({ query: catalogV.suggestQuery }), productController.suggestProducts);
router.get('/products/compare', validate({ query: catalogV.compareQuery }), productController.compareProducts);
router.post('/products', admin, validate({ body: catalogV.createProductSchema }), productController.createProduct);
router.patch('/products/:id/stock', admin, validate({ params: idParams, body: catalogV.updateStockSchema }), productController.updateStock);
router.patch('/products/:id', admin, validate({ params: idParams, body: catalogV.updateProductSchema }), productController.updateProduct);
router.delete('/products/:id', admin, validate({ params: idParams }), productController.deleteProduct);

// Reviews on a product. The id routes use the validated 24-character id.
router.get('/products/:id/reviews/eligibility', auth, validate({ params: idParams }), reviewController.reviewEligibility);
router.get('/products/:id/reviews', validate({ params: idParams, query: shopV.listReviewsQuery }), reviewController.listProductReviews);
router.post('/products/:id/reviews', auth, validate({ params: idParams, body: shopV.createReviewSchema }), reviewController.createReview);

router.get('/products/:slug/related', optionalAuth, productController.relatedProducts);
router.get('/products/:slug', optionalAuth, productController.getProduct);

// Reviews
router.get('/reviews', admin, validate({ query: shopV.listReviewsQuery }), reviewController.listAllReviews);
router.get('/reviews/my', auth, reviewController.myReviews);
router.patch('/reviews/:id', auth, validate({ params: idParams, body: shopV.updateReviewSchema }), reviewController.updateReview);
router.delete('/reviews/:id', auth, validate({ params: idParams }), reviewController.deleteReview);

// Categories
router.get('/categories', optionalAuth, categoryController.listCategories);
router.post('/categories', admin, validate({ body: catalogV.createCategorySchema }), categoryController.createCategory);
router.patch('/categories/:id', admin, validate({ params: idParams, body: catalogV.updateCategorySchema }), categoryController.updateCategory);
router.delete('/categories/:id', admin, validate({ params: idParams }), categoryController.deleteCategory);

// Cart
router.get('/cart', auth, cartController.getCart);
router.delete('/cart', auth, cartController.clearCart);
router.post('/cart/items', auth, validate({ body: shopV.addCartItemSchema }), cartController.addItem);
router.patch('/cart/items/:productId', auth, validate({ params: shopV.productIdParams, body: shopV.updateCartItemSchema }), cartController.updateItem);
router.delete('/cart/items/:productId', auth, validate({ params: shopV.productIdParams }), cartController.removeItem);
router.post('/cart/coupon', auth, validate({ body: shopV.applyCouponSchema }), cartController.applyCoupon);
router.delete('/cart/coupon', auth, cartController.removeCoupon);

// Wishlist
router.get('/wishlist', auth, wishlistController.getWishlist);
router.post('/wishlist/:productId', auth, validate({ params: shopV.productIdParams }), wishlistController.addToWishlist);
router.delete('/wishlist/:productId', auth, validate({ params: shopV.productIdParams }), wishlistController.removeFromWishlist);

// Coupons
router.get('/coupons/available', auth, couponController.availableCoupons);
router.get('/coupons', admin, couponController.listCoupons);
router.post('/coupons', admin, validate({ body: shopV.createCouponSchema }), couponController.createCoupon);
router.patch('/coupons/:id', admin, validate({ params: idParams, body: shopV.updateCouponSchema }), couponController.updateCoupon);
router.delete('/coupons/:id', admin, validate({ params: idParams }), couponController.deleteCoupon);

// Orders
router.post('/orders', auth, validate({ body: shopV.placeOrderSchema }), orderController.createOrder);
router.get('/orders/my', auth, validate({ query: shopV.myOrdersQuery }), orderController.myOrders);
router.get('/orders', admin, validate({ query: shopV.listOrdersQuery }), orderController.listOrders);
router.get('/orders/:id', auth, validate({ params: idParams }), orderController.getOrder);
router.post('/orders/:id/cancel', auth, validate({ params: idParams, body: shopV.cancelOrderSchema }), orderController.cancelMyOrder);
router.post('/orders/:id/return', auth, validate({ params: idParams, body: shopV.requestReturnSchema }), orderController.requestMyReturn);
router.patch('/orders/:id/status', admin, validate({ params: idParams, body: shopV.updateOrderStatusSchema }), orderController.updateOrderStatus);
router.patch('/orders/:id/return', admin, validate({ params: idParams, body: shopV.resolveReturnSchema }), orderController.decideReturn);

// Delivery and public tracking
router.get('/delivery/options', deliveryController.options);
router.get('/delivery/estimate', validate({ query: shopV.deliveryEstimateQuery }), deliveryController.estimate);
router.get('/track/:trackingNumber', validate({ params: shopV.trackingParams }), orderController.trackShipment);

// The demo payment gateway. The approval routes are public: a phone that scanned the
// UPI QR code proves itself with the token inside the code, not with a login.
router.get('/payments/test-details', paymentController.testDetails);
router.post('/payments', auth, validate({ body: paymentV.createPaymentSchema }), paymentController.create);
router.get('/payments/:id', auth, validate({ params: idParams }), paymentController.show);
router.post('/payments/:id/card', auth, validate({ params: idParams, body: paymentV.cardSchema }), paymentController.card);
router.post('/payments/:id/otp', auth, validate({ params: idParams, body: paymentV.otpSchema }), paymentController.otp);
router.post('/payments/:id/upi', auth, validate({ params: idParams, body: paymentV.upiSchema }), paymentController.upi);
router.post('/payments/:id/cancel', auth, validate({ params: idParams }), paymentController.cancel);
router.get('/payments/:id/approval', validate({ params: idParams, query: paymentV.approvalSchema }), paymentController.approvalDetails);
router.post('/payments/:id/approve', validate({ params: idParams, body: paymentV.approvalSchema }), paymentController.approve);

// Wallet
router.get('/wallet', auth, validate({ query: paymentV.walletQuery }), paymentController.myWallet);

// Project Kits
router.get('/kits', optionalAuth, kitController.listKits);
router.post('/kits', admin, validate({ body: extrasV.createKitSchema }), kitController.createKit);
router.post('/kits/:id/add-to-cart', auth, validate({ params: idParams }), kitController.addKitToCart);
router.patch('/kits/:id', admin, validate({ params: idParams, body: extrasV.updateKitSchema }), kitController.updateKit);
router.delete('/kits/:id', admin, validate({ params: idParams }), kitController.deleteKit);
router.get('/kits/:slug', optionalAuth, kitController.getKit);

// Build Your Setup
router.get('/setups/slots', setupController.listSlots);
router.get('/setups', auth, setupController.listSetups);
router.post('/setups', auth, validate({ body: extrasV.createSetupSchema }), setupController.createSetup);
router.patch('/setups/:id', auth, validate({ params: idParams, body: extrasV.updateSetupSchema }), setupController.updateSetup);
router.delete('/setups/:id', auth, validate({ params: idParams }), setupController.deleteSetup);
router.post('/setups/:id/add-to-cart', auth, validate({ params: idParams }), setupController.addSetupToCart);

// Admin: analytics and uploads
router.get('/admin/analytics/summary', admin, analyticsController.summary);
router.get('/admin/analytics/revenue', admin, validate({ query: extrasV.revenueQuery }), analyticsController.revenue);
router.get('/admin/analytics/category-sales', admin, analyticsController.categorySales);
router.get('/admin/analytics/top-products', admin, analyticsController.topProducts);
router.get('/admin/analytics/order-status', admin, analyticsController.orderStatus);
router.get('/admin/analytics/low-stock', admin, analyticsController.lowStock);
router.get('/admin/payments', admin, validate({ query: paymentV.listPaymentsQuery }), paymentController.adminList);
router.get('/admin/wallet-transactions', admin, validate({ query: paymentV.listWalletQuery }), paymentController.adminWallet);
router.post('/uploads', admin, uploadImage, imageUploaded);

export default router;
