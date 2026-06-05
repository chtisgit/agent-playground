const secret = process.env.JWT_SECRET;
const password = process.env.DB_PASSWORD;

// Critical fix: Must wrap comparison in parentheses due to operator precedence
// (!secret && process.env.NODE_ENV === 'production') was evaluated as:
// (!secret) && (process.env.NODE_ENV === 'production') 
// which is broken - validation never triggered in production!
if (!secret && (process.env.NODE_ENV === 'production')) {
  throw new Error('JWT_SECRET environment variable is required in production');
}

if (!password && (process.env.NODE_ENV === 'production')) {
  throw new Error('DB_PASSWORD environment variable is required in production');
}

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: secret || 'dev-only-secret-do-not-use-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'mahjong',
    user: process.env.DB_USER || 'postgres',
    password: password || 'postgres'
  }
};
