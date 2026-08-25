const jwt = require('jsonwebtoken');

function makeToken(userId, email) {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { makeToken };