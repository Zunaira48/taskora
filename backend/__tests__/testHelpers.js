const jwt = require('jsonwebtoken');

function makeRequestMock(queryResult) {
  const reqObj = {};
  reqObj.input = jest.fn(() => reqObj);
  reqObj.query = jest.fn().mockResolvedValue(queryResult);
  return reqObj;
}

function makeToken(userId, email) {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { makeRequestMock, makeToken };