// Usage: router.post('/x', validate(schema), handler) -> parsed body/query in req.valid, params in req.validParams
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) return next(result.error);
  if (source === 'params') req.validParams = result.data;
  else req.valid = result.data;
  return next();
};
