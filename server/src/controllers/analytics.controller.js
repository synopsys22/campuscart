import * as analytics from '../services/analytics.service.js';
import { ok } from '../utils/http.js';

export async function summary(req, res) {
  ok(res, await analytics.summary());
}

export async function revenue(req, res) {
  ok(res, await analytics.revenueByDay(Number.parseInt(req.validated.query.range, 10)));
}

export async function categorySales(req, res) {
  ok(res, await analytics.categorySales());
}

export async function topProducts(req, res) {
  ok(res, await analytics.topProducts());
}

export async function orderStatus(req, res) {
  ok(res, await analytics.orderStatusBreakdown());
}

export async function lowStock(req, res) {
  ok(res, await analytics.lowStockProducts());
}
