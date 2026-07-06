process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_DAYS = '30';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/fiora_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
