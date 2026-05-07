/**
 * Validates req.body against a Joi schema.
 * Usage: router.post('/path', validate(schema), controller)
 */
module.exports = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: error.details.map(d => d.message) });
  }
  next();
};
