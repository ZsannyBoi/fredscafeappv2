require('dotenv').config();
const mysql = require('mysql2/promise');

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  port: parseInt(process.env.DB_PORT) || 3306 // Default to 3306 if not set
});

// Optional: Test the connection
pool.getConnection()
  .then(connection => {
    console.log('Successfully connected to the database!');
    connection.release(); // Release the connection back to the pool
  })
  .catch(err => {
    console.error('Error connecting to the database:', err.stack);
  });

// Export the pool to be used in other files
module.exports = pool; 