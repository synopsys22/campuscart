process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
// An empty value stops the project's .env from pointing the tests at a real database,
// because dotenv never replaces a variable that is already set.
process.env.MONGODB_URI = '';
