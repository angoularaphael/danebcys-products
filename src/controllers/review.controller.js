const reviewService = require('../services/review.service');
const authClient = require('../services/authClient');

async function enrichReviewsWithUserNames(reviews) {
  const userIds = [...new Set(reviews.map(r => r.userId).filter(Boolean))];
  const userMap = {};
  await Promise.all(userIds.map(async (uid) => {
    try {
      const res = await authClient.getUserById(uid);
      const u = res.user || res;
      userMap[uid] = u.username || (u.first_name && u.last_name ? `${u.first_name} ${u.last_name}`.trim() : null) || u.email || `Utilisateur ${uid.slice(0, 8)}`;
    } catch (_e) {
      userMap[uid] = `Utilisateur ${uid.slice(0, 8)}`;
    }
  }));
  return reviews.map(r => ({ ...r, userName: userMap[r.userId] || 'Anonyme' }));
}

async function listReviews(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await reviewService.listReviews(req.params.id, page, limit);
    result.reviews = await enrichReviewsWithUserNames(result.reviews);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function addReview(req, res, next) {
  try {
    const review = await reviewService.addReview(req.params.id, req.user.id, req.body);
    res.status(201).json({ review, message: 'Avis ajouté' });
  } catch (err) {
    next(err);
  }
}

async function listMyReviews(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const result = await reviewService.listReviewsByUser(req.user.id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function checkEligibility(req, res, next) {
  try {
    const result = await reviewService.checkEligibility(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { listReviews, addReview, listMyReviews, checkEligibility };
