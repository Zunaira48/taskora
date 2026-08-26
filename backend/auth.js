const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '7d';

async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

function signToken(userId, email) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET); // throws if invalid/expired
}

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,                          // JS on the page can never read this cookie — key XSS protection
  secure: isProduction,                    // HTTPS-only in production; false locally since 127.0.0.1 isn't HTTPS
  sameSite: isProduction ? 'none' : 'lax', // cross-site (Vercel → Render) needs 'none'; same-machine dev is fine with 'lax'
  maxAge: 7 * 24 * 60 * 60 * 1000          // 7 days, matches token expiry
};

module.exports = { hashPassword, comparePassword, signToken, verifyToken, COOKIE_OPTIONS };