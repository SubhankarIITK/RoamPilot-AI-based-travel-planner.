export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';
  let errors = err.errors || [];

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map(error => error.message);
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'A record with that value already exists';
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};
