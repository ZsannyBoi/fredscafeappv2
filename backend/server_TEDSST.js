require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db'); // Import the database connection pool
const { v4: uuidv4 } = require('uuid'); // Import uuid
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); // Add sync version for existsSync
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Configure multer for file uploads ---
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (err) {
            cb(err, null);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing for frontend requests
app.use(express.json({ limit: '50mb' })); // Parse JSON request bodies with increased size limit
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Parse URL-encoded bodies

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// --- Basic Routes ---
app.get('/', (req, res) => {
  res.send('EspressoLane Backend is Running!');
});

// --- User Search API (Moved to top level) ---
app.get('/api/users/search', authenticateToken, async (req, res) => {
  console.log('[GET /api/users/search] Endpoint hit, searchTerm:', req.query.q);
  
  // Only managers, employees and cashiers can search users
  if (req.user.role !== 'manager' && req.user.role !== 'employee' && req.user.role !== 'cashier') {
    console.log('[GET /api/users/search] Access denied for role:', req.user.role);
    return res.status(403).json({ message: 'Access denied. Only authorized staff can search users.' });
  }

  const searchTerm = req.query.q || '';
  if (searchTerm.length < 2) {
    console.log('[GET /api/users/search] Search term too short:', searchTerm);
    return res.status(400).json({ message: 'Search term must be at least 2 characters' });
  }

  let connection;
  try {
    console.log('[GET /api/users/search] Getting database connection');
    connection = await db.getConnection();
    
    const query = `
      SELECT user_id, name, email, role, avatar_url as avatar 
      FROM Users 
      WHERE (name LIKE ? OR email LIKE ?) 
      AND role = 'customer' 
      ORDER BY name
      LIMIT 20
    `;
    const params = [`%${searchTerm}%`, `%${searchTerm}%`];
    
    console.log('[GET /api/users/search] Executing query:', query);
    console.log('[GET /api/users/search] With params:', params);
    
    // Search users by name or email - Using query instead of execute and verified column names
    const [users] = await connection.query(query, params);
    
    console.log('[GET /api/users/search] Found users:', users.length);
    
    // Map database user_id to internalId for frontend compatibility
    const mappedUsers = users.map(user => ({
      internalId: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar
    }));
    
    console.log('[GET /api/users/search] Sending response with users:', mappedUsers.length);
    res.json(mappedUsers);
  } catch (error) {
    console.error('[GET /api/users/search] Database error:', error);
    res.status(500).json({ message: 'Failed to search users' });
  } finally {
    if (connection) {
      console.log('[GET /api/users/search] Releasing connection');
      connection.release();
    }
  }
});

// --- Authentication Verification Endpoint (NEW) ---
// This endpoint is called by the frontend after login or on initial load
// to verify the token and fetch the full, up-to-date user profile.
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    // If we reach here, authenticateToken middleware has successfully verified the token,
    // and req.user contains the payload from the token.
    const userId = req.user.userId; // Assuming your token payload has a userId field
    const userEmail = req.user.email; // Assuming your token payload has an email field

    // We need to fetch the *full* user data from the database, not just use the token payload,
    // because the database might have more up-to-date information (like phone_number, address, etc.)
    // and the frontend expects specific field names (like user.id, user.avatar).

    if (!userId && !userEmail) {
        console.error('[GET /api/auth/verify] Token payload is missing userId and email.', req.user);
        return res.status(400).json({ message: 'Invalid token payload: User identifier missing.' });
    }

    // Use either userId or userEmail to query the database
    const identifier = userId || userEmail;
    const whereClause = userId ? 'user_id = ?' : 'email = ?';

    try {
        // Fetch the user from the database, selecting all necessary fields
        // Ensure column names match what frontend User type expects (or map them)
        const [users] = await db.query(
            `SELECT 
                user_id, 
                name, 
                email, 
                role, 
                avatar_url, 
                referral_code, 
                phone_number,
                address
             FROM Users 
             WHERE ${whereClause}`,
            [identifier]
        );

        if (users.length === 0) {
            // This could happen if a user was deleted but their token is still valid
            console.warn('[GET /api/auth/verify] User not found in DB for token payload:', req.user);
            return res.status(404).json({ message: 'User not found.' });
        }

        const fetchedUser = users[0];
        console.log('[GET /api/auth/verify] Fetched user data from DB:', fetchedUser);

        // Return the user data in the format the frontend expects
        res.status(200).json({
            message: 'Token valid and user data fetched.',
            user: {
                internalId: String(fetchedUser.user_id), // Use backend user_id (as string) for frontend User.internalId
                email: fetchedUser.email,
                name: fetchedUser.name,
                role: fetchedUser.role,
                avatar: fetchedUser.avatar_url || undefined,
                referralCode: fetchedUser.referral_code || undefined,
                phone_number: fetchedUser.phone_number || undefined,
                address: fetchedUser.address || undefined,
                // Include other fields from User type if available in DB and needed
            }
        });

    } catch (error) {
        console.error('[GET /api/auth/verify] Database error fetching user:', error);
        res.status(500).json({ message: 'Error fetching user data', error: error.message });
    }
});

// Example route to test DB connection (optional)
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS solution');
    res.json({ message: 'Database connection successful!', result: rows[0].solution });
  } catch (error) {
    console.error("Database test query failed:", error);
    res.status(500).json({ message: 'Database connection failed', error: error.message });
  }
});

// --- API Routes ---

// GET all categories
app.get('/api/categories', async (req, res) => {
  try {
    const [categories] = await db.query('SELECT category_id, name, image_url FROM Categories ORDER BY name');
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// GET all products (including category name)
app.get('/api/products', async (req, res) => {
  try {
    // Join with Categories table to get the category name
    const sql = `
      SELECT 
        p.*, 
        c.name AS category_name 
      FROM Products p
      JOIN Categories c ON p.category_id = c.category_id
      ORDER BY p.name
    `;
    const [products] = await db.query(sql);
    res.json(products); // availability is already included with p.*
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// POST - Create a new category
app.post('/api/categories', authenticateToken, upload.single('image'), async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  const { name } = req.body;
  let image_url = null;

  if (!name) {
    return res.status(400).json({ message: 'Missing required field: name' });
  }

  if (req.file) {
    image_url = getUploadedFileUrl(req.file);
  }

  try {
    const sql = `INSERT INTO Categories (name, image_url) VALUES (?, ?)`;
    const [result] = await db.query(sql, [name, image_url]);

    // Get the ID of the inserted category
    const insertedId = result.insertId;
    if (!insertedId) {
        throw new Error("Failed to get ID for new category.");
    }

    // Fetch the newly created category
    const [newCategory] = await db.query('SELECT * FROM Categories WHERE category_id = ?', [insertedId]);

    if (newCategory.length > 0) {
      res.status(201).json(newCategory[0]);
    } else {
      res.status(500).json({ message: 'Category created but could not be retrieved.' });
    }

  } catch (error) {
    console.error("Error creating category:", error);
    // Handle potential unique constraint violation for category name
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: `Category name '${name}' already exists.` });
    }
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
});

// DELETE - Delete a category
app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  const { id } = req.params;
  const categoryId = parseInt(id);

  if (isNaN(categoryId)) {
    return res.status(400).json({ message: 'Invalid category ID format.' });
  }

  let connection; // Define connection outside try block
  try {
    connection = await db.getConnection(); // Get a connection for transaction
    await connection.beginTransaction();

    // 1. Check if any products reference this category
    const [products] = await connection.query('SELECT 1 FROM Products WHERE category_id = ? LIMIT 1', [categoryId]);

    if (products.length > 0) {
      await connection.rollback(); // Rollback transaction
      return res.status(400).json({ message: 'Cannot delete category: It is currently assigned to one or more products.' });
    }

    // 2. If no products reference it, proceed with deletion
    const [result] = await connection.query('DELETE FROM Categories WHERE category_id = ?', [categoryId]);

    if (result.affectedRows === 0) {
      await connection.rollback(); // Rollback transaction
      return res.status(404).json({ message: 'Category not found.' });
    }

    await connection.commit(); // Commit transaction
    res.status(200).json({ message: 'Category deleted successfully.' });

  } catch (error) {
    if (connection) await connection.rollback(); // Rollback on any other error
    console.error(`Error deleting category ${id}:`, error);
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  } finally {
    if (connection) connection.release(); // Always release connection
  }
});

// PUT - Update an existing category
app.put('/api/categories/:id', authenticateToken, upload.single('image'), async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  const { id } = req.params;
  const categoryId = parseInt(id);
  const { name } = req.body;

  if (isNaN(categoryId)) {
    return res.status(400).json({ message: 'Invalid category ID format.' });
  }

  try {
    // Get current category data to check for existing image
    const [currentCategory] = await db.query('SELECT image_url FROM Categories WHERE category_id = ?', [categoryId]);
    
    if (currentCategory.length === 0) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    let setClauses = [];
    let values = [];

    if (name !== undefined) {
      setClauses.push('name = ?');
      values.push(name.trim());
    }

    // Handle image update
    if (req.file) {
      const newImageUrl = getUploadedFileUrl(req.file);
      setClauses.push('image_url = ?');
      values.push(newImageUrl);
      
      // Delete old image if it exists
      if (currentCategory[0].image_url) {
        await deleteUnusedImage(currentCategory[0].image_url);
      }
    } else if (req.body.image_url === null) {
      // If image_url is explicitly set to null, remove the image
      setClauses.push('image_url = NULL');
      if (currentCategory[0].image_url) {
        await deleteUnusedImage(currentCategory[0].image_url);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ message: 'No valid update fields to apply.' });
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(categoryId);

    const sql = `UPDATE Categories SET ${setClauses.join(', ')} WHERE category_id = ?`;
    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Category not found or no changes made.' });
    }

    // Fetch the updated category to return
    const [updatedCategory] = await db.query('SELECT * FROM Categories WHERE category_id = ?', [categoryId]);
    if (updatedCategory.length === 0) {
      return res.status(404).json({ message: 'Category updated but could not be retrieved.' });
    }
    res.json(updatedCategory[0]);

  } catch (error) {
    console.error(`Error updating category ${categoryId}:`, error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: `Category name '${name.trim()}' already exists.` });
    }
    res.status(500).json({ message: 'Error updating category', error: error.message });
  }
});

// --- Product Routes ---

// POST - Create a new product
app.post('/api/products', authenticateToken, async (req, res) => {
  // Role-based authorization
  console.log('[POST /api/products] Checking role for req.user:', req.user);
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  // Destructure expected fields from request body, including availability
  const { name, description, base_price, image_url, category_id, availability, tags, option_group_ids } = req.body;

  // Basic validation
  if (!name || base_price === undefined || category_id === undefined) {
    return res.status(400).json({ message: 'Missing required fields: name, base_price, category_id' });
  }
  // Validate availability if provided
  if (availability && !['available', 'unavailable'].includes(availability)) { // Removed 'limited'
    return res.status(400).json({ message: 'Invalid availability status.' });
  }

  let connection;
  try {
    const productId = uuidv4(); // Generate a unique ID for the new product
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Insert into Products table
    const productSql = `INSERT INTO Products
                        (product_id, name, description, base_price, image_url, category_id, availability, tags)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const productValues = [
      productId,
      name,
      description || null,
      base_price,
      image_url || null,
      category_id,
      availability || 'available', // Use provided availability or default to 'available'
      tags || null
    ];
    await connection.query(productSql, productValues);

    // 2. Insert into Product_OptionGroups if option_group_ids are provided
    if (option_group_ids && Array.isArray(option_group_ids) && option_group_ids.length > 0) {
        const optionGroupSql = 'INSERT INTO Product_OptionGroups (product_id, option_group_id) VALUES ?';
        // Ensure IDs are numbers and filter out invalid ones
        const validOptionGroupIds = option_group_ids.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (validOptionGroupIds.length > 0) {
           const optionGroupValues = validOptionGroupIds.map(groupId => [productId, groupId]);
           await connection.query(optionGroupSql, [optionGroupValues]);
        } else {
           console.warn(`Received option_group_ids for product ${productId}, but none were valid numbers.`);
        }
    }

    await connection.commit(); // Commit transaction

    // Fetch the newly created product to return it (no need for transaction here)
    const [newProduct] = await db.query('SELECT * FROM Products WHERE product_id = ?', [productId]);

    if (newProduct.length > 0) {
      res.status(201).json(newProduct[0]); // Return the created product
    } else {
      // This case should ideally not happen if insert was successful
      res.status(500).json({ message: 'Product created but could not be retrieved.' });
    }
  } catch (error) {
    if (connection) await connection.rollback(); // Rollback on error
    console.error("Error creating product:", error);
    // Check for specific errors like foreign key constraint
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
       return res.status(400).json({ message: 'Invalid category_id provided.' });
    }
    res.status(500).json({ message: 'Error creating product', error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection
  }
});

// PUT - Update an existing product
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  const { id } = req.params; // Get product ID from URL parameter
  // Destructure fields that can be updated, including availability
  const { name, description, base_price, image_url, category_id, availability, tags, option_group_ids } = req.body;

  // Basic validation - ensure at least one updatable field is present
  if (name === undefined && description === undefined && base_price === undefined && image_url === undefined && category_id === undefined && availability === undefined && tags === undefined && option_group_ids === undefined) {
    return res.status(400).json({ message: 'No update fields provided.' });
  }
  if (category_id !== undefined && typeof category_id !== 'number') {
    return res.status(400).json({ message: 'Invalid category_id format.' });
  }
  // Validate availability if provided
  if (availability && !['available', 'unavailable'].includes(availability)) { // Removed 'limited'
    return res.status(400).json({ message: 'Invalid availability status.' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Update Products table (if any product fields changed)
    let productFieldsUpdated = false;
    let setClauses = [];
    let productValues = [];
    if (name !== undefined) { setClauses.push('name = ?'); productValues.push(name); productFieldsUpdated = true; }
    if (description !== undefined) { setClauses.push('description = ?'); productValues.push(description === null ? null : description); productFieldsUpdated = true; }
    if (base_price !== undefined) { setClauses.push('base_price = ?'); productValues.push(base_price); productFieldsUpdated = true; }
    if (image_url !== undefined) { setClauses.push('image_url = ?'); productValues.push(image_url === null ? null : image_url); productFieldsUpdated = true; }
    if (category_id !== undefined) { setClauses.push('category_id = ?'); productValues.push(category_id); productFieldsUpdated = true; }
    if (availability !== undefined) { setClauses.push('availability = ?'); productValues.push(availability); productFieldsUpdated = true; }
    if (tags !== undefined) { 
        setClauses.push('tags = ?'); 
        // Convert tags array to JSON string, or null if empty/undefined
        productValues.push(Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null); 
        productFieldsUpdated = true; 
    }

    if (productFieldsUpdated) {
        productValues.push(id); // Add id for WHERE clause
        const productSql = `UPDATE Products SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?`;
        const [productResult] = await connection.query(productSql, productValues);
        // Optional: Check productResult.affectedRows if needed, though subsequent fetch handles not found
    }

    // 2. Update Product_OptionGroups if option_group_ids were provided
    if (option_group_ids !== undefined && Array.isArray(option_group_ids)) {
        // Delete existing associations for this product
        const deleteSql = 'DELETE FROM Product_OptionGroups WHERE product_id = ?';
        await connection.query(deleteSql, [id]);

        // Insert new associations if the array is not empty
        if (option_group_ids.length > 0) {
            const insertSql = 'INSERT INTO Product_OptionGroups (product_id, option_group_id) VALUES ?';
            // Ensure IDs are numbers and filter out invalid ones
            const validOptionGroupIds = option_group_ids.map(groupId => parseInt(groupId)).filter(num => !isNaN(num));
             if (validOptionGroupIds.length > 0) {
               const insertValues = validOptionGroupIds.map(groupId => [id, groupId]);
               await connection.query(insertSql, [insertValues]);
             } else {
                 console.warn(`Received non-empty option_group_ids for product ${id} update, but none were valid numbers.`);
             }
        }
    }

    await connection.commit(); // Commit transaction

    // Fetch the updated product to return it
    const [updatedProduct] = await db.query('SELECT * FROM Products WHERE product_id = ?', [id]);

    if (updatedProduct.length > 0) {
        res.json(updatedProduct[0]); // Return the updated product
    } else {
        // Should not happen if affectedRows was > 0
        res.status(404).json({ message: 'Product not found after update.' });
    }

  } catch (error) {
    if (connection) await connection.rollback(); // Rollback on error
    console.error(`Error updating product ${id}:`, error);
     // Check for specific errors like foreign key constraint
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
       return res.status(400).json({ message: 'Invalid category_id provided.' });
    }
    res.status(500).json({ message: 'Error updating product', error: error.message });
  } finally {
     if (connection) connection.release(); // Release connection
  }
});

// DELETE - Delete a product
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  const { id } = req.params;

  try {
    // TODO: Add check for related OrderLineItems? Or handle via FK constraint?
    const [result] = await db.query('DELETE FROM Products WHERE product_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.status(200).json({ message: 'Product deleted successfully.' }); // Or status 204 (No Content)

  } catch (error) {
    console.error(`Error deleting product ${id}:`, error);
    // Handle potential foreign key constraint errors if Orders reference Products
    if (error.code === 'ER_ROW_IS_REFERENCED_2') { // Check specific error code for FK violation
       return res.status(400).json({ message: 'Cannot delete product as it is referenced in existing orders.' });
    }
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
});

// GET - Options for a specific product
app.get('/api/products/:productId/options', async (req, res) => {
  const { productId } = req.params;
  try {
    const sql = `
      SELECT 
        og.option_group_id, 
        og.name AS group_name,
        og.selection_type, 
        og.is_required, /* Added is_required */
        o.option_id, 
        o.label AS option_label,
        o.price_modifier
      FROM Product_OptionGroups pog
      JOIN OptionGroups og ON pog.option_group_id = og.option_group_id
      JOIN Options o ON og.option_group_id = o.option_group_id
      WHERE pog.product_id = ?
      ORDER BY og.option_group_id, o.option_id;
    `;
    const [results] = await db.query(sql, [productId]);
    const optionCategoriesMap = new Map();
    results.forEach(row => {
      if (!optionCategoriesMap.has(row.option_group_id)) {
        optionCategoriesMap.set(row.option_group_id, {
          id: row.option_group_id.toString(),
          name: row.group_name,
          selectionType: row.selection_type,
          is_required: !!row.is_required, // Ensure boolean value
          options: []
        });
      }
      optionCategoriesMap.get(row.option_group_id).options.push({
        id: row.option_id.toString(),
        label: row.option_label,
        priceModifier: parseFloat(row.price_modifier)
      });
    });
    const optionCategoriesArray = Array.from(optionCategoriesMap.values());
    if (optionCategoriesArray.length === 0) {
        // If a product has no assigned option groups, or those groups have no options,
        // this will be empty. It's also possible Product_OptionGroups is empty for the product.
        // Return 200 with empty array rather than 404, as the product itself exists.
        return res.status(200).json([]);
    }
    res.json(optionCategoriesArray);
  } catch (error) {
    console.error(`Error fetching options for product ${productId}:`, error);
    res.status(500).json({ message: 'Error fetching product options', error: error.message });
  }
});

// --- TODO: Add API routes for Users, Orders, Rewards etc. here ---

// --- OptionGroup Routes ---

// GET all option groups
app.get('/api/option-groups', async (req, res) => {
  try {
    // Added is_required to the selection
    const [groups] = await db.query('SELECT option_group_id, name, selection_type, is_required FROM OptionGroups ORDER BY name');
    res.json(groups);
  } catch (error) {
    console.error("Error fetching option groups:", error);
    res.status(500).json({ message: 'Error fetching option groups', error: error.message });
  }
});

// POST - Create a new option group
app.post('/api/option-groups', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }
  // Added is_required, defaulting to false if not provided
  const { name, selection_type, is_required = false } = req.body;

  if (!name || !selection_type) {
    return res.status(400).json({ message: 'Name and selection_type are required for an option group.' });
  }
  if (!['radio', 'checkbox'].includes(selection_type)) {
    return res.status(400).json({ message: 'Invalid selection_type. Must be \'radio\' or \'checkbox\'.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO OptionGroups (name, selection_type, is_required) VALUES (?, ?, ?)', 
      [name, selection_type, !!is_required] // Ensure is_required is boolean
    );
    const newGroupId = result.insertId;
    // Return the newly created group including is_required
    res.status(201).json({ option_group_id: newGroupId, name, selection_type, is_required: !!is_required });
  } catch (error) {
    console.error("Error creating option group:", error);
    // Check for unique constraint violation on 'name' if you have one
    if (error.code === 'ER_DUP_ENTRY' || error.sqlState === '23000') {
        return res.status(409).json({ message: `Option group name '${name}' already exists.` });
    }
    res.status(500).json({ message: 'Error creating option group', error: error.message });
  }
});

// PUT - Update an existing option group
app.put('/api/option-groups/:groupId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }
  const { groupId } = req.params;
  const { name, selection_type, is_required } = req.body;

  console.log(`[PUT /api/option-groups/${groupId}] Received raw body:`, req.body);
  console.log(`[PUT /api/option-groups/${groupId}] Destructured is_required:`, is_required, `(type: ${typeof is_required})`);

  if (!name && !selection_type && is_required === undefined) {
    return res.status(400).json({ message: 'No update information provided (name, selection_type, or is_required).' });
  }
  if (selection_type && !['radio', 'checkbox'].includes(selection_type)) {
    return res.status(400).json({ message: 'Invalid selection_type.' });
  }

  try {
    const fieldsToUpdate = {};
    if (name) fieldsToUpdate.name = name;
    if (selection_type) fieldsToUpdate.selection_type = selection_type;
    if (is_required !== undefined) {
        fieldsToUpdate.is_required = !!is_required; // Ensure boolean
        console.log(`[PUT /api/option-groups/${groupId}] 'is_required' is defined. Adding to fieldsToUpdate as:`, fieldsToUpdate.is_required);
    } else {
        console.log(`[PUT /api/option-groups/${groupId}] 'is_required' is undefined in request body.`);
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
        return res.status(400).json({ message: 'No valid fields to update provided.'});
    }
    console.log(`[PUT /api/option-groups/${groupId}] fieldsToUpdate object for DB:`, fieldsToUpdate);

    const [result] = await db.query('UPDATE OptionGroups SET ? WHERE option_group_id = ?', [fieldsToUpdate, groupId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Option group not found or no changes made.' });
    }
    // Fetch and return the updated group
    const [updatedGroupRows] = await db.query('SELECT option_group_id, name, selection_type, is_required FROM OptionGroups WHERE option_group_id = ?', [groupId]);
    if (updatedGroupRows.length === 0) {
        // Should not happen if affectedRows was > 0
        return res.status(404).json({ message: 'Updated option group could not be retrieved.'});
    }
    res.json(updatedGroupRows[0]);
  } catch (error) {
    console.error(`Error updating option group ${groupId}:`, error);
    if (error.code === 'ER_DUP_ENTRY' || error.sqlState === '23000') {
        return res.status(409).json({ message: `Option group name '${name}' already exists.` });
    }
    res.status(500).json({ message: 'Error updating option group', error: error.message });
  }
});

// DELETE - Delete an option group
app.delete('/api/option-groups/:groupId', authenticateToken, async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  const { groupId } = req.params;

  try {
    // Assuming ON DELETE CASCADE is set for Options table referencing OptionGroups
    const [result] = await db.query('DELETE FROM OptionGroups WHERE option_group_id = ?', [groupId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Option group not found.' });
    }

    res.status(200).json({ message: 'Option group and its associated options deleted successfully.' });

  } catch (error) {
    console.error(`Error deleting option group ${groupId}:`, error);
    res.status(500).json({ message: 'Error deleting option group', error: error.message });
  }
});

// --- Option Routes ---

// GET all options for a specific option group
app.get('/api/option-groups/:groupId/options', async (req, res) => {
  const { groupId } = req.params;
  const optionGroupId = parseInt(groupId);

  if (isNaN(optionGroupId)) {
    return res.status(400).json({ message: 'Invalid option group ID format.' });
  }

  try {
    const [options] = await db.query('SELECT option_id, label, price_modifier FROM Options WHERE option_group_id = ? ORDER BY label', [optionGroupId]);
    res.json(options);
  } catch (error) {
    console.error(`Error fetching options for group ${groupId}:`, error);
    res.status(500).json({ message: 'Error fetching options', error: error.message });
  }
});

// POST - Create a new option for an option group
app.post('/api/options', authenticateToken, async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  const { option_group_id, label, price_modifier } = req.body;

  if (option_group_id === undefined || !label) {
    return res.status(400).json({ message: 'Missing required fields: option_group_id, label' });
  }
  const optionGroupIdNum = parseInt(option_group_id);
  if (isNaN(optionGroupIdNum)) {
      return res.status(400).json({ message: 'Invalid option_group_id format. Must be a number.'});
  }

  try {
    const sql = 'INSERT INTO Options (option_group_id, label, price_modifier) VALUES (?, ?, ?)';
    const [result] = await db.query(sql, [optionGroupIdNum, label, price_modifier || 0.00]);
    const insertedId = result.insertId;

    const [newOption] = await db.query('SELECT * FROM Options WHERE option_id = ?', [insertedId]);
    if (newOption.length > 0) {
      res.status(201).json(newOption[0]);
    } else {
      res.status(500).json({ message: 'Option created but could not be retrieved.' });
    }
  } catch (error) {
    console.error("Error creating option:", error);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ message: `Option group with ID '${option_group_id}' does not exist.` });
    }
    // Add more specific error handling if needed (e.g., unique constraint on label within group)
    res.status(500).json({ message: 'Error creating option', error: error.message });
  }
});

// PUT - Update an existing option
app.put('/api/options/:id', authenticateToken, async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  const { id } = req.params;
  const optionId = parseInt(id);
  const { label, price_modifier, value } = req.body;

  if (isNaN(optionId)) {
    return res.status(400).json({ message: 'Invalid option ID format.' });
  }
  if (label === undefined && price_modifier === undefined && value === undefined) {
    return res.status(400).json({ message: 'No update fields provided (label, price_modifier, or value).' });
  }

  try {
    let setClauses = [];
    let values = [];
    if (label !== undefined) { setClauses.push('label = ?'); values.push(label); }
    if (price_modifier !== undefined) { setClauses.push('price_modifier = ?'); values.push(price_modifier); }
    if (value !== undefined) { setClauses.push('value = ?'); values.push(value); }

    if (setClauses.length === 0) {
        return res.status(400).json({ message: 'No valid fields to update.' });
    }

    values.push(optionId);
    const sql = `UPDATE Options SET ${setClauses.join(', ')} WHERE option_id = ?`;
    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Option not found.' });
    }

    const [updatedOption] = await db.query('SELECT * FROM Options WHERE option_id = ?', [optionId]);
    res.json(updatedOption[0]);

  } catch (error) {
    console.error(`Error updating option ${id}:`, error);
    // Add specific error handling if needed
    res.status(500).json({ message: 'Error updating option', error: error.message });
  }
});

// DELETE - Delete an option
app.delete('/api/options/:id', authenticateToken, async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  const { id } = req.params;
  const optionId = parseInt(id);

  if (isNaN(optionId)) {
    return res.status(400).json({ message: 'Invalid option ID format.' });
  }

  try {
    // TODO: Consider if there are direct dependencies on Options (e.g., in OrderLineItem_SelectedOptions)
    // If so, a check might be needed here before deletion, or rely on DB constraints.
    const [result] = await db.query('DELETE FROM Options WHERE option_id = ?', [optionId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Option not found.' });
    }

    res.status(200).json({ message: 'Option deleted successfully.' });

  } catch (error) {
    console.error(`Error deleting option ${id}:`, error);
    // Handle potential FK constraints if this option is used in past orders, etc.
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({ message: 'Cannot delete option: It is referenced in existing order line items or other records.' });
    }
    res.status(500).json({ message: 'Error deleting option', error: error.message });
  }
});

// --- Authentication Routes ---

// POST /api/register - Register a new user
app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  const userRole = role || 'customer'; // Default to customer if role not provided

  // Basic validation
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  try {
    // Check if user already exists (using email column)
    const [existingUsers] = await db.query('SELECT user_id FROM Users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Email already in use.' });
    }

    // Hash the password
    const saltRounds = 10; // Standard practice
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // --- Generate a unique referral code ---
    let referralCode;
    let codeExists = true;
    let retries = 0;
    const maxRetries = 5; // Limit retries to prevent infinite loops

    while (codeExists && retries < maxRetries) {
        // Generate a code (e.g., first 8 chars of a UUID)
        referralCode = uuidv4().substring(0, 8).toUpperCase();

        // Check if this code already exists in the database
        const [existingCodes] = await db.query('SELECT 1 FROM Users WHERE referral_code = ?', [referralCode]);
        codeExists = existingCodes.length > 0;

        if (codeExists) {
            console.warn(`Generated duplicate referral code: ${referralCode}. Retrying...`);
            retries++;
        }
    }

    if (codeExists) {
        // If after max retries, we still generate duplicates (highly unlikely for 8+ chars)
        console.error('Failed to generate a unique referral code after multiple retries.');
        // Proceed without referral code or return an error
        referralCode = null; // Assign null if unable to generate unique code
    }
    // --- End Referral Code Generation ---

    // Insert the new user (user_id is auto-increment)
    // Include the generated referral_code
    const newUserSql = `
      INSERT INTO Users (email, name, password_hash, role, avatar_url, join_date, referral_code)
      VALUES (?, ?, ?, ?, ?, NOW(), ?)
    `;
    // Inserting minimal required fields + join_date + referral_code
    const defaultAvatar = '/src/assets/avatar.png';
    const [insertResult] = await db.query(newUserSql, [email, name, passwordHash, userRole, defaultAvatar, referralCode]);
    const newUserId = insertResult.insertId; // Get the auto-incremented integer user_id

    // Fetch the newly created user data (excluding password hash) to return
    // Ensure referral_code is selected
    const [newUserRows] = await db.query('SELECT user_id, name, email, role, avatar_url, referral_code FROM Users WHERE user_id = ?', [newUserId]);

    if (newUserRows.length > 0) {
        const newUser = newUserRows[0];
        // Structure the response consistently with login
        res.status(201).json({
            user: {
                id: newUser.user_id.toString(), // Send integer id as string
                name: newUser.name,
                // email: newUser.email, // Optionally include email if needed by frontend state beyond id
                role: newUser.role,
                avatar: newUser.avatar_url,
                referralCode: newUser.referral_code // Include the generated referral code
            }
        });
    } else {
      // This shouldn't typically happen if the insert succeeded without error
      res.status(500).json({ message: 'User registered but could not be retrieved.' });
    }

  } catch (error) {
    console.error("Error registering user:", error);
    // Handle potential unique constraint violation for email
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes("for key 'email'")) { // Fixed string formatting
        return res.status(409).json({ message: 'Email address is already registered.' });
    }
     // Handle potential unique constraint violation for referral_code (less likely with retry logic, but possible)
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes("for key 'referral_code'")) { // Fixed string formatting
         console.error('Database unique constraint violated for referral_code after retries.');
         return res.status(500).json({ message: 'Error generating unique referral code. Please try again.' });
    }
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
});

// POST /api/login - Log in a user
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  try {
    // Get user from database
    const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    const user = users[0];
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.user_id, 
        email: user.email,
        role: user.role,
        internalId: user.user_id // Using user_id as internalId for consistency
      }, 
      process.env.JWT_SECRET || 'your_jwt_secret', 
      { expiresIn: '24h' }
    );
    
    // Return token and user info
    res.json({
      token,
      user: {
        internalId: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        referralCode: user.referral_code,
        phone_number: user.phone_number,
        address: user.address
      }
    });
    
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// GET /api/auth/verify - Verify token and return user data
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    // Get user data from database using user ID from token
    const [users] = await db.query('SELECT * FROM Users WHERE user_id = ?', [req.user.userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = users[0];
    
    // Return user info
    res.json({
      user: {
        internalId: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        referralCode: user.referral_code,
        phone_number: user.phone_number,
        address: user.address
      }
    });
    
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({ message: 'Server error during token verification' });
  }
});

// POST /api/auth/forgot-password - Initiate password reset process
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  
  try {
    // Check if user exists
    const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      // Don't reveal that the email doesn't exist for security reasons
      return res.status(200).json({ message: 'If your email is in our system, you will receive a password reset link' });
    }
    
    const user = users[0];
    
    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);
    
    // Store the token in the database with expiration time (1 hour)
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 1);
    
    // Check if a reset token already exists for this user
    const [existingTokens] = await db.query('SELECT * FROM PasswordResetTokens WHERE user_id = ?', [user.user_id]);
    
    if (existingTokens.length > 0) {
      // Update existing token
      await db.query(
        'UPDATE PasswordResetTokens SET token = ?, expires_at = ? WHERE user_id = ?',
        [hashedToken, expiryTime, user.user_id]
      );
    } else {
      // Create new token record
      await db.query(
        'INSERT INTO PasswordResetTokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.user_id, hashedToken, expiryTime]
      );
    }
    
    // In a real application, send an email with the reset link
    // For this demo, we'll just return the token
    console.log(`Password reset token for ${email}: ${resetToken}`);
    
    // Return success message
    res.json({ 
      message: 'Password reset initiated. Check your email for instructions.',
      // In a development environment, return the token for testing
      ...(process.env.NODE_ENV === 'development' && { resetToken })
    });
    
  } catch (error) {
    console.error('Error initiating password reset:', error);
    res.status(500).json({ message: 'Server error during password reset initiation' });
  }
});

// POST /api/auth/reset-password - Complete password reset process
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }
  
  try {
    // Find the token in the database
    const [tokenRecords] = await db.query(
      'SELECT * FROM PasswordResetTokens WHERE expires_at > NOW()'
    );
    
    let validToken = false;
    let userId;
    
    // Check each token by comparing with bcrypt
    for (const record of tokenRecords) {
      const isValid = await bcrypt.compare(token, record.token);
      if (isValid) {
        validToken = true;
        userId = record.user_id;
        break;
      }
    }
    
    if (!validToken || !userId) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the user's password
    await db.query('UPDATE Users SET password = ? WHERE user_id = ?', [hashedPassword, userId]);
    
    // Remove the used token
    await db.query('DELETE FROM PasswordResetTokens WHERE user_id = ?', [userId]);
    
    // Return success message
    res.json({ message: 'Password reset successful. You can now log in with your new password.' });
    
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
});

// --- User Profile Routes ---

// PUT /api/users/:userId - Update user profile
app.put('/api/users/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { name, avatar_url, phone_number, address } = req.body;
  
  console.log(`[PUT /api/users/${userId}] Received update request:`, req.body);
  console.log(`[PUT /api/users/${userId}] Auth user ID: ${req.user.userId}, role: ${req.user.role}`);
  
  // Convert authenticated user ID to string for comparison
  const authenticatedUserId = req.user.userId ? String(req.user.userId) : null;
  const authenticatedUserRole = req.user.role;

  // Authorization check: User can only update their own profile, unless they are a manager
  if (authenticatedUserId !== userId && authenticatedUserRole !== 'manager') {
    console.log(`[PUT /api/users/${userId}] Forbidden - auth ID: ${authenticatedUserId}, requested ID: ${userId}`);
    return res.status(403).json({ message: 'Forbidden: You can only update your own profile.' });
  }

  let updateFields = [];
  let queryParams = [];

  if (name !== undefined) {
    updateFields.push('name = ?');
    queryParams.push(name);
  }

  if (avatar_url !== undefined) {
    updateFields.push('avatar_url = ?');
    queryParams.push(avatar_url);
  }

  if (phone_number !== undefined) {
    updateFields.push('phone_number = ?');
    queryParams.push(phone_number);
  }

  if (address !== undefined) {
    updateFields.push('address = ?');
    queryParams.push(address);
  }

  // Only proceed if there are fields to update
  if (updateFields.length === 0) {
    return res.status(400).json({ message: 'No valid fields provided for update.' });
  }

  try {
    // Construct the SQL query dynamically
    const sql = `UPDATE Users SET ${updateFields.join(', ')} WHERE user_id = ?`;
    queryParams.push(userId);
    
    console.log(`[PUT /api/users/${userId}] Executing query:`, sql, 'with params:', queryParams);
    
    const [result] = await db.query(sql, queryParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Fetch the updated user to return in the response
    const [updatedUserRows] = await db.query(
      'SELECT user_id, name, email, role, avatar_url, referral_code, phone_number, address FROM Users WHERE user_id = ?',
      [userId]
    );

    if (updatedUserRows.length === 0) {
      return res.status(500).json({ message: 'User updated but failed to fetch updated data.' });
    }

    const updatedUser = updatedUserRows[0];
    
    // Format the response to match the frontend User type
    res.json({
      internalId: updatedUser.user_id.toString(), // Use internalId to match frontend User type
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar: updatedUser.avatar_url,
      referralCode: updatedUser.referral_code,
      phone_number: updatedUser.phone_number,
      address: updatedUser.address
    });
    
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error);
    res.status(500).json({ message: 'Error updating user profile', error: error.message });
  }
});

// --- Order Routes ---

// GET /api/orders/customer/:customerId - Fetch orders for a specific customer
app.get('/api/orders/customer/:customerId', authenticateToken, async (req, res) => {
  const { customerId } = req.params;
  const limit = parseInt(req.query.limit) || null; // Get optional limit from query string
  
  // Log authentication info
  console.log(`[GET /api/orders/customer/${customerId}] Auth Info - User ID: ${req.user.userId}, Internal ID: ${req.user.internalId}, role: ${req.user.role}`);
  
  // Authorization: only allow customers to see their own orders, or staff to see any customer's orders
  const isStaffRole = ['manager', 'employee', 'cashier', 'cook'].includes(req.user.role);
  if (req.user.role === 'customer' && String(req.user.userId) !== String(customerId) && String(req.user.internalId) !== String(customerId)) {
    return res.status(403).json({ message: 'Forbidden: You can only view your own orders' });
  }
  
  console.log(`[GET /api/orders/customer/${customerId}] Authorization passed`);

  try {
    // 1. Fetch orders for the specific customer
    let ordersSql = `
      SELECT
        order_id,
        customer_id,
        customer_name_snapshot AS customer_name,
        total_amount AS total,
        status,
        order_timestamp AS timestamp,
        ticket_number
      FROM Orders
      WHERE customer_id = ?
      AND is_archived = FALSE
      ORDER BY order_timestamp DESC
    `;
    
    console.log(`[GET /api/orders/customer/${customerId}] Running SQL with customerId:`, customerId);
    let queryParams = [customerId];
    
    if (limit && limit > 0) {
        ordersSql += ` LIMIT ?`;
        queryParams.push(limit);
    }
    ordersSql += ';';

    const [orders] = await db.query(ordersSql, queryParams);
    console.log(`[GET /api/orders/customer/${customerId}] Fetched ${orders.length} orders.`);

    // 2. Fetch line items for all these orders efficiently
    const orderIds = orders.map(o => o.order_id);
    let lineItems = [];
    if (orderIds.length > 0) {
      const lineItemsSql = `
        SELECT
          order_line_item_id,
          order_id,
          product_id,
          product_name_snapshot AS product_name,
          quantity
        FROM OrderLineItems
        WHERE order_id IN (?)
        ORDER BY order_line_item_id ASC;
      `;
      [lineItems] = await db.query(lineItemsSql, [orderIds]);
      console.log(`[GET /api/orders/customer/${customerId}] Fetched ${lineItems.length} line items.`);
    }

    // Fetch selected options for all relevant line items in one go
    let selectedOptionsData = [];
    const lineItemIds = lineItems.map(li => li.order_line_item_id);
    if (lineItemIds.length > 0) {
      const selectedOptionsSql = `
        SELECT
          olso.order_line_item_id,
          olso.selected_option_label_snapshot,
          og.name AS group_name
        FROM OrderLineItem_SelectedOptions olso
        JOIN Options o ON olso.option_id = o.option_id
        JOIN OptionGroups og ON o.option_group_id = og.option_group_id
        WHERE olso.order_line_item_id IN (?)
        ORDER BY olso.order_line_item_id, og.option_group_id;
      `;
      [selectedOptionsData] = await db.query(selectedOptionsSql, [lineItemIds]);
      console.log(`[GET /api/orders/customer/${customerId}] Fetched ${selectedOptionsData.length} selected options.`);
    }

    // Create a map for easy lookup of selected options per line item
    const selectedOptionsMap = new Map();
    selectedOptionsData.forEach(opt => {
      if (!selectedOptionsMap.has(opt.order_line_item_id)) {
        selectedOptionsMap.set(opt.order_line_item_id, []);
      }
      selectedOptionsMap.get(opt.order_line_item_id).push({ 
        group: opt.group_name, 
        option: opt.selected_option_label_snapshot 
      });
    });

    // 3. Structure the data to match frontend OrderItem type
    const results = orders.map(order => {
      const itemsForOrder = lineItems
        .filter(item => item.order_id === order.order_id)
        .map(item => {
          const customizations = selectedOptionsMap.get(item.order_line_item_id) || [];
          return {
            name: item.product_name,
            quantity: item.quantity,
            customizations: customizations,
          };
        });

      return {
        id: order.order_id,
        customerId: order.customer_id,
        customerName: order.customer_name,
        items: itemsForOrder,
        total: parseFloat(order.total),
        status: order.status,
        timestamp: order.timestamp,
        ticketNumber: order.ticket_number,
      };
    });

    res.json(results);

  } catch (error) {
    console.error(`Error fetching orders for customer ${customerId}:`, error);
    res.status(500).json({ message: 'Error fetching customer orders', error: error.message });
  }
});

// GET /api/orders - Fetch all orders with their line items (Added limit query param)
app.get('/api/orders', authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || null; // Get optional limit from query string
  
  // Log authentication info
  console.log(`[GET /api/orders] User ID: ${req.user.userId}, role: ${req.user.role}`);

  try {
    // 1. Fetch all orders (adjust columns as needed)
    let ordersSql = `
      SELECT
        order_id,
        customer_id,
        customer_name_snapshot AS customer_name,
        total_amount AS total,
        status,
        order_timestamp AS timestamp,
        ticket_number
      FROM Orders
      WHERE is_archived = FALSE
      ORDER BY order_timestamp DESC
    `;
    let queryParams = [];
    if (limit && limit > 0) {
        ordersSql += ` LIMIT ?`;
        queryParams.push(limit);
    }
    ordersSql += ';';

    const [orders] = await db.query(ordersSql, queryParams);
    console.log(`[GET /api/orders] Fetched ${orders.length} orders.`); // Log after orders query

    // 2. Fetch line items for all these orders efficiently
    const orderIds = orders.map(o => o.order_id);
    let lineItems = [];
    if (orderIds.length > 0) {
      const lineItemsSql = `
        SELECT
          order_line_item_id,
          order_id,
          product_id,
          product_name_snapshot AS product_name,
          quantity
        FROM OrderLineItems
        WHERE order_id IN (?)
        ORDER BY order_line_item_id ASC;
      `;
      [lineItems] = await db.query(lineItemsSql, [orderIds]);
      console.log(`[GET /api/orders] Fetched ${lineItems.length} line items.`); // Log after line items query
    }

    // Fetch selected options for all relevant line items in one go
    let selectedOptionsData = [];
    const lineItemIds = lineItems.map(li => li.order_line_item_id);
    if (lineItemIds.length > 0) {
      const selectedOptionsSql = `
        SELECT
          olso.order_line_item_id,
          olso.selected_option_label_snapshot,
          og.name AS group_name -- Fetch the group name
        FROM OrderLineItem_SelectedOptions olso
        JOIN Options o ON olso.option_id = o.option_id -- Join to get option_group_id
        JOIN OptionGroups og ON o.option_group_id = og.option_group_id -- Join to get group name
        WHERE olso.order_line_item_id IN (?)
        ORDER BY olso.order_line_item_id, og.option_group_id; -- Order for potential grouping later
      `;
      [selectedOptionsData] = await db.query(selectedOptionsSql, [lineItemIds]);
      console.log(`[GET /api/orders] Fetched ${selectedOptionsData.length} selected options.`); // Log after selected options query
    }

    // Create a map for easy lookup of selected options per line item
    const selectedOptionsMap = new Map();
    selectedOptionsData.forEach(opt => {
      if (!selectedOptionsMap.has(opt.order_line_item_id)) {
        selectedOptionsMap.set(opt.order_line_item_id, []);
      }
      // Store object with group and option label
      selectedOptionsMap.get(opt.order_line_item_id).push({ 
        group: opt.group_name, 
        option: opt.selected_option_label_snapshot 
      });
    });

    // 3. Structure the data to match frontend OrderItem type
    const results = orders.map(order => {
      const itemsForOrder = lineItems
        .filter(item => item.order_id === order.order_id)
        .map(item => {
          // Get customizations from the map
          const customizations = selectedOptionsMap.get(item.order_line_item_id) || [];
          return {
            // Map DB fields to frontend fields
            name: item.product_name,
            quantity: item.quantity,
            customizations: customizations, // Populate with fetched and mapped selected option labels
          };
        });

      // Map order DB fields to frontend OrderItem fields
      return {
        id: order.order_id, // Assuming OrderItem uses 'id'
        customerId: order.customer_id,
        customerName: order.customer_name, // Corrected: Use the aliased 'customer_name' from the SQL query
        items: itemsForOrder,
        total: parseFloat(order.total), // Ensure 'total' is a number
        status: order.status,
        timestamp: order.timestamp, // Ensure format matches frontend expectation if needed
        ticketNumber: order.ticket_number,
      };
    });

    // Log the final structure before sending
    console.log('[GET /api/orders] Final results structure:', JSON.stringify(results, null, 2));

    res.json(results);

  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
});

// POST /api/orders - Create a new order
app.post('/api/orders', authenticateToken, async (req, res) => {
  const { customerName, items, redeemedRewards } = req.body;
  
  // Validate required fields
  if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Invalid order data. Customer name and at least one item are required." });
  }

  // Validate at least product ID, quantity for each item
  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({ message: "Each item must have a valid productId and positive quantity." });
    }
  }

  let connection;
  try {
    connection = await db.getConnection();
    
    // Begin transaction for order operations
    await connection.beginTransaction();
    
    // Generate order ID and ticket number
    const orderId = uuidv4();
    const ticketNumber = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Calculate order total on the server side for security
    let orderTotal = 0;
    
    // Track any reward discounts applied
    let discountTotal = 0;
    
    // First, fetch all products and calculate prices
    let itemsToProcess = [];
    for (const item of items) {
      // Fetch product details from the database to verify pricing
      const [productRows] = await connection.execute(
        'SELECT product_id, name, base_price, availability FROM products WHERE product_id = ?',
        [item.productId]
      );
      
      if (productRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
      }
      
      const product = productRows[0];
      
      // Check if product is available
      if (product.availability === 'unavailable') {
        await connection.rollback();
        return res.status(400).json({ message: `Product "${product.name}" is currently unavailable.` });
      }
      
      // Calculate item price (base price + options)
      let itemPrice = parseFloat(product.base_price);
      let selectedOptions = [];
      
      // Process options if any
      if (item.selectedOptionIds && Object.keys(item.selectedOptionIds).length > 0) {
        for (const [categoryId, optionIds] of Object.entries(item.selectedOptionIds)) {
          if (!optionIds) continue;
          
          const optionIdArray = Array.isArray(optionIds) ? optionIds : [optionIds];
          
          for (const optionId of optionIdArray) {
            if (!optionId) continue;
            
            // Fetch option price modifier
            const [optionRows] = await connection.execute(
              'SELECT option_id, label, price_modifier FROM options WHERE option_id = ?',
              [optionId]
            );
            
            if (optionRows.length > 0) {
              selectedOptions.push(optionRows[0]);
              if (optionRows[0].price_modifier) {
                itemPrice += parseFloat(optionRows[0].price_modifier);
              }
            }
          }
        }
      }
      
      // Set the price to 0, and don't add to the total, if this is a reward free item
      if (item.isRewardItem && item.rewardId) {
        itemPrice = 0;
      } else {
        // Add to order total (price * quantity)
        orderTotal += itemPrice * item.quantity;
      }
      
      // Store item data for later processing
      itemsToProcess.push({
        item,
        product,
        itemPrice,
        selectedOptions
      });
    }

    // Process rewards if any
    if (redeemedRewards && Array.isArray(redeemedRewards) && redeemedRewards.length > 0) {
      for (const reward of redeemedRewards) {
        // Apply discount to order total if applicable
        if (reward.appliedDiscount) {
          if (reward.appliedDiscount.type === 'percentage') {
            discountTotal += (orderTotal * (reward.appliedDiscount.value / 100));
          } else if (reward.appliedDiscount.type === 'fixed') {
            discountTotal += reward.appliedDiscount.value;
          }
        }
      }
    }

    // Apply discount cap to ensure we don't go negative
    discountTotal = Math.min(discountTotal, orderTotal);
    const finalTotal = Math.max(0, orderTotal - discountTotal);

    // IMPORTANT: First insert the parent order record BEFORE any child records
    await connection.execute(
      'INSERT INTO orders (order_id, customer_id, customer_name_snapshot, total_amount, status, ticket_number, discount_amount, original_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        orderId, 
        req.user.role === 'customer' ? req.user.internalId : null, 
        customerName, 
        finalTotal, 
        'pending', 
        ticketNumber,
        discountTotal,
        orderTotal
      ]
    );

    // Now that the order exists, we can insert the child line items
    for (const { item, product, itemPrice, selectedOptions } of itemsToProcess) {
      // Skip items with missing required fields
      if (!item || !item.productId || !item.name) {
        console.warn('Skipping item with missing required fields:', item);
        continue;
      }
      
      // Ensure quantity is a valid number
      const quantity = typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 1;
      
      try {
        // For reward items, validate that the reward_id exists to prevent foreign key errors
        let rewardIdToUse = null;
        if (item.isRewardItem && item.rewardId) {
          try {
            // Check if the reward exists in the rewards table
            const [rewardCheck] = await connection.execute(
              'SELECT 1 FROM rewards WHERE reward_id = ?',
              [item.rewardId]
            );
            
            if (rewardCheck.length > 0) {
              rewardIdToUse = item.rewardId;
            } else {
              console.warn(`Warning: Reward ID ${item.rewardId} not found in rewards table. Setting to null.`);
            }
          } catch (rewardCheckErr) {
            console.error('Error checking reward existence:', rewardCheckErr);
          }
        }
        
        // Insert order line item
        const [orderLineItemResult] = await connection.execute(
          'INSERT INTO orderlineitems (order_id, product_id, product_name_snapshot, quantity, unit_price_snapshot, total_line_price, is_reward_item, reward_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            orderId, 
            item.productId,
            item.name, 
            quantity, 
            itemPrice || 0, // Ensure not undefined
            (itemPrice || 0) * quantity,
            item.isRewardItem ? 1 : 0,
            rewardIdToUse
          ]
        );
        
        // Get the inserted order line item ID
        const orderLineItemId = orderLineItemResult.insertId;
        
        // Insert selected options
        for (const option of selectedOptions) {
          // Skip options with missing required fields
          if (!option || !option.option_id) {
            console.warn('Skipping option with missing option_id:', option);
            continue;
          }
          
          await connection.execute(
            'INSERT INTO orderlineitem_selectedoptions (order_line_item_id, option_id, selected_option_label_snapshot, price_modifier_snapshot) VALUES (?, ?, ?, ?)',
            [
              orderLineItemId,
              option.option_id,
              option.label || 'Unknown option', // Provide default if label is undefined
              option.price_modifier || 0
            ]
          );
        }
      } catch (err) {
        console.error('Error inserting order line item:', err);
        throw err; // Re-throw to trigger rollback
      }
    }

          // Process rewards if any (now that order and line items exist)
if (redeemedRewards && Array.isArray(redeemedRewards) && redeemedRewards.length > 0) {
  // Insert into order_rewards table
  const rewardValues = redeemedRewards.map(reward => [
    orderId,
    reward.rewardId || null, // Ensure null if undefined
    reward.voucherId || null, // Ensure null if undefined
    reward.appliedDiscount ? 
      (reward.appliedDiscount.type === 'percentage' ? 
        (orderTotal * (reward.appliedDiscount.value / 100)) : reward.appliedDiscount.value) : 0,
    reward.freeItems && reward.freeItems.length > 0 ? JSON.stringify(reward.freeItems) : null // Ensure null if undefined or empty
  ]);
  
  if (rewardValues.length > 0) {
    await connection.query(
      'INSERT INTO order_rewards (order_id, reward_id, voucher_id, discount_amount, free_items_json) VALUES ?',
      [rewardValues]
    );
  }
  
  for (const reward of redeemedRewards) {
    // Mark reward as claimed in the database
    if (reward.rewardId) {
          // If it's a voucher, update the customervouchers table
          if (reward.voucherId) {
            await connection.execute(
              'UPDATE customervouchers SET status = "claimed", claimed_date = NOW(), order_id = ? WHERE voucher_instance_id = ? AND reward_id = ?',
              [orderId, reward.voucherId, reward.rewardId]
            );
          } else {
            // For general rewards, add to customer_claimed_rewards table
            const customerId = req.user.internalId;
            // Check if already claimed
            const [existingClaim] = await connection.execute(
              'SELECT id FROM customer_claimed_rewards WHERE customer_id = ? AND reward_id = ?',
              [customerId, reward.rewardId]
            );
            
            // Only insert if not already claimed
            if (existingClaim.length === 0) {
              await connection.execute(
                'INSERT INTO customer_claimed_rewards (customer_id, reward_id, claimed_date, order_id) VALUES (?, ?, NOW(), ?)',
                [customerId, reward.rewardId, orderId]
              );
            }
          }
          
          // Track reward usage in the reward_usage table
          await connection.execute(
            'INSERT INTO reward_usage (reward_id, order_id, user_id, usage_type, discount_amount, free_items_json) VALUES (?, ?, ?, ?, ?, ?)',
            [
              reward.rewardId,
              orderId,
              req.user.internalId,
              reward.appliedDiscount ? 'discount' : (reward.freeItems && reward.freeItems.length > 0 ? 'free_items' : 'other'),
              reward.appliedDiscount ? (reward.appliedDiscount.type === 'percentage' ? 
                (orderTotal * (reward.appliedDiscount.value / 100)) : reward.appliedDiscount.value) : 0,
              // Store voucher info in the free_items_json if it's a voucher
              reward.voucherId ? 
                JSON.stringify({ 
                  freeItems: reward.freeItems || [], 
                  voucherId: reward.voucherId 
                }) : 
                (reward.freeItems ? JSON.stringify(reward.freeItems) : null)
            ]
          );
        }
      }
    }
    
    // Increment customer purchases and loyalty points
    if (req.user.role === 'customer') {
      // Add loyalty points (1 point per dollar spent, rounded down)
      const pointsEarned = Math.floor(finalTotal);
      
      if (pointsEarned > 0) {
        await connection.execute(
          'UPDATE users SET loyalty_points = loyalty_points + ?, lifetime_total_spend = lifetime_total_spend + ?, purchases_this_month = purchases_this_month + 1 WHERE user_id = ?',
          [pointsEarned, finalTotal, req.user.internalId]
        );
        
        // Record points transaction
        await connection.execute(
          'INSERT INTO loyalty_points_transactions (user_id, points, transaction_type, order_id) VALUES (?, ?, ?, ?)',
          [req.user.internalId, pointsEarned, 'earned', orderId]
        );
      }
    }
    
    // Commit the transaction
    await connection.commit();
    
    // Return success response
    res.status(201).json({
      message: "Order created successfully",
      order: {
        id: orderId,
        ticketNumber,
        status: 'pending',
        totalAmount: finalTotal,
        originalAmount: orderTotal,
        discountAmount: discountTotal,
        customerName,
        timestamp: new Date().toISOString(),
        items: items.map(item => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          isRewardItem: item.isRewardItem || false
        }))
      }
    });
    
  } catch (error) {
    // Roll back the transaction on error
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }
    }
    
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Failed to create order. Please try again." });
  } finally {
    // Release the connection back to the pool
    if (connection) connection.release();
  }
});

// PATCH /api/orders/:id/status - Update an order's status
app.patch('/api/orders/:orderId/status', authenticateToken, async (req, res) => {
  const { orderId } = req.params;
  const { status: newStatus } = req.body;
  const { userId, role } = req.user; // Get user info from JWT

  // --- Validation ---
  const allowedStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!newStatus || !allowedStatuses.includes(newStatus)) {
    return res.status(400).json({ message: `Invalid status provided. Must be one of: ${allowedStatuses.join(', ')}` });
  }

  // --- Authorization ---
  // Basic check: Allow staff roles to update status. More granular checks could be added.
  // (e.g., only cooks move to 'ready', only cashiers to 'completed'/'cancelled'?)
  const allowedRoles = ['manager', 'employee', 'cook', 'cashier'];
  if (!allowedRoles.includes(role)) {
     return res.status(403).json({ message: 'Forbidden: You do not have permission to update order status.' });
  }

  // --- Database Update ---
  try {
    // Optional: Add logic to check if the status transition is valid
    // (e.g., cannot go from 'completed' back to 'preparing'). Fetch current status first if needed.
    // const [currentOrder] = await db.query('SELECT status FROM Orders WHERE order_id = ?', [orderId]);
    // if (currentOrder.length === 0) return res.status(404).json({ message: 'Order not found.' });
    // const currentStatus = currentOrder[0].status;
    // // Add transition validation logic here...

    const updateSql = `UPDATE Orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`;
    const [result] = await db.query(updateSql, [newStatus, orderId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Order not found or status unchanged.' });
    }

    // Optionally fetch and return the updated order
    const [updatedOrder] = await db.query('SELECT * FROM Orders WHERE order_id = ?', [orderId]);
    // Structure `updatedOrder[0]` similar to how GET /api/orders does, if you want to return the full item.
    // For now, just send success status.
    res.status(200).json({ message: `Order ${orderId} status updated to ${newStatus}` });
    // If returning the full order: res.status(200).json(structuredOrderData);

  } catch (error) {
    console.error(`Error updating status for order ${orderId}:`, error);
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
});

// --- NEW: Archive Order Route ---
app.patch('/api/orders/:orderId/archive', authenticateToken, async (req, res) => {
  const { orderId } = req.params;
  const { role } = req.user; // Get user role from token

  // Authorization: Allow managers and cashiers to archive orders
  if (role !== 'manager' && role !== 'cashier') {
    return res.status(403).json({ message: 'Forbidden: Only managers and cashiers can archive orders.' });
  }

  try {
    // Get the order to verify it's eligible for archiving
    const [orderResult] = await db.query(
      `SELECT status FROM Orders WHERE order_id = ?`,
      [orderId]
    );

    if (orderResult.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    // Cashiers can only archive completed orders
    if (role === 'cashier' && orderResult[0].status !== 'completed') {
      return res.status(403).json({ 
        message: 'Cashiers can only archive completed orders.'
      });
    }

    // Update the order to set is_archived to TRUE
    const archiveSql = `UPDATE Orders SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`;
    const [result] = await db.query(archiveSql, [orderId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Order not found or already archived.' });
    }

    res.status(200).json({ message: `Order ${orderId} archived successfully.` });

  } catch (error) {
    console.error(`Error archiving order ${orderId}:`, error);
    res.status(500).json({ message: 'Error archiving order', error: error.message });
  }
});

// Helper function to safely parse JSON - can be defined at the top of the file or inline
const safeJsonParse = (jsonString, defaultValue = {}) => {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to parse JSON string:", jsonString, e);
    return defaultValue; // Return default if parsing fails
  }
};

// --- Rewards/Voucher Claiming Route ---
app.post('/api/rewards/claim', authenticateToken, async (req, res) => {
  const { rewardId, voucherInstanceId } = req.body;
  const customerDbId = req.user.userId; // Assuming userId from token IS the integer user_id

  // Validate input
  if (!customerDbId) {
    return res.status(400).json({ message: 'Customer ID could not be determined from token.' });
  }
  if (!rewardId && !voucherInstanceId) {
    return res.status(400).json({ message: 'Missing required field: either rewardId or voucherInstanceId must be provided.' });
  }
  if (rewardId && voucherInstanceId) {
    return res.status(400).json({ message: 'Provide either rewardId or voucherInstanceId, not both.' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // --- 1. Fetch Comprehensive Customer Data ---
    const userSql = `
      SELECT user_id, loyalty_points, birth_date, join_date, membership_tier, referrals_made
      FROM Users WHERE user_id = ? FOR UPDATE; 
    `; // Use FOR UPDATE for pessimistic locking if needed
    const [customerRows] = await connection.query(userSql, [customerDbId]);
    if (customerRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Customer not found.' });
    }
    const customerData = customerRows[0];

    // Fetch Purchases This Month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const purchasesSql = `SELECT COUNT(*) AS count FROM Orders WHERE customer_id = ? AND order_timestamp >= ?`;
    const [purchaseRows] = await connection.query(purchasesSql, [customerDbId, startOfMonth]);
    customerData.purchasesThisMonth = purchaseRows[0].count || 0;

    // Fetch Lifetime Spend
    const spendSql = `SELECT SUM(total_amount) AS total FROM Orders WHERE customer_id = ?`;
    const [spendRows] = await connection.query(spendSql, [customerDbId]);
    customerData.lifetimeTotalSpend = parseFloat(spendRows[0].total) || 0;

    // --- 2. Fetch Reward/Voucher Details & Check Initial Status ---
    let rewardDefinition = null;
    let criteria = {};
    let pointsCost = 0;
    let isVoucherClaim = false;

    if (voucherInstanceId) {
      isVoucherClaim = true;
      const [voucherRows] = await connection.query(
        'SELECT * FROM CustomerVouchers WHERE instance_id = ? AND customer_id = ? FOR UPDATE', // Add FOR UPDATE
        [voucherInstanceId, customerDbId]
      );
      if (voucherRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Voucher not found or does not belong to this customer.' });
      }
      const voucher = voucherRows[0];
      if (voucher.status === 'claimed') {
        await connection.rollback();
        return res.status(400).json({ message: 'Voucher already claimed.' });
      }
      if (voucher.status === 'expired') {
        await connection.rollback();
        return res.status(400).json({ message: 'Voucher has expired.' });
      }
      const now = new Date();
      if (voucher.expiry_date && new Date(voucher.expiry_date) < now) {
         // Expire it now within the transaction
         await connection.query("UPDATE CustomerVouchers SET status = 'expired' WHERE instance_id = ?", [voucherInstanceId]);
         // No need to commit separately, it's part of the main transaction which will be rolled back here
         await connection.rollback();
         return res.status(400).json({ message: 'Voucher has expired.' });
      }
      // Fetch underlying reward only if its criteria/pointsCost apply to voucher usage (unlikely, but possible)
      // For now, assume voucher claim bypasses most criteria and has 0 points cost.

    } else if (rewardId) {
      // Fetch reward definition from Rewards table (assuming `criteria_json` column)
      const [rewardRows] = await connection.query('SELECT *, criteria_json FROM Rewards WHERE reward_id = ?', [rewardId]);
      if (rewardRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Reward definition not found.' });
      }
      rewardDefinition = rewardRows[0];
      criteria = safeJsonParse(rewardDefinition.criteria_json); // Parse criteria JSON
      pointsCost = rewardDefinition.points_cost || 0;

      // Check if already claimed
      const [claimedRows] = await connection.query(
        'SELECT 1 FROM customer_claimed_rewards WHERE customer_id = ? AND reward_id = ? LIMIT 1',
        [customerDbId, rewardId]
      );
      if (claimedRows.length > 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Reward already claimed by this customer.' });
      }
    }

    // --- 3. Perform Server-Side Eligibility Checks (Only for general rewards) ---
    let isEligible = true;
    let eligibilityFailReason = "Reward not claimable."; // Default reason

    if (!isVoucherClaim && rewardDefinition) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
        const currentTime = today.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
        const currentDayOfWeek = today.getDay(); // 0=Sun, 6=Sat

        // Check Criteria Systematically
        if (criteria.minPoints && customerData.loyalty_points < criteria.minPoints) {
            isEligible = false; eligibilityFailReason = `Eligibility requires ${criteria.minPoints} points.`;
        }
        if (isEligible && criteria.minPurchasesMonthly && customerData.purchasesThisMonth < criteria.minPurchasesMonthly) {
            isEligible = false; eligibilityFailReason = `Requires ${criteria.minPurchasesMonthly} purchases this month.`;
        }
        if (isEligible && criteria.cumulativeSpendTotal && customerData.lifetimeTotalSpend < criteria.cumulativeSpendTotal) {
            isEligible = false; eligibilityFailReason = `Requires total spend of $${criteria.cumulativeSpendTotal.toFixed(2)}.`;
        }
         if (isEligible && criteria.minReferrals && (customerData.referrals_made || 0) < criteria.minReferrals) {
            isEligible = false; eligibilityFailReason = `Requires ${criteria.minReferrals} referrals made.`;
        }
        if (isEligible && criteria.requiredCustomerTier && criteria.requiredCustomerTier.length > 0) {
            if (!customerData.membership_tier || !criteria.requiredCustomerTier.includes(customerData.membership_tier)) {
                isEligible = false; eligibilityFailReason = `Requires membership tier: ${criteria.requiredCustomerTier.join(' or ')}.`;
            }
        }
        if (isEligible && (criteria.isBirthMonthOnly || criteria.isBirthdayOnly) && customerData.birth_date) {
            try {
                const birthDate = new Date(customerData.birth_date);
                // Adjust for potential timezone issues if birth_date is just YYYY-MM-DD
                const birthMonth = birthDate.getUTCMonth() + 1;
                const birthDay = birthDate.getUTCDate();
                const currentMonth = today.getUTCMonth() + 1;
                const currentDay = today.getUTCDate();

                if (criteria.isBirthdayOnly && (birthMonth !== currentMonth || birthDay !== currentDay)) {
                    isEligible = false; eligibilityFailReason = "Only valid on your birthday.";
                }
                if (isEligible && criteria.isBirthMonthOnly && !criteria.isBirthdayOnly && birthMonth !== currentMonth) {
                    isEligible = false; eligibilityFailReason = "Only valid during your birth month.";
                }
            } catch(e) { console.error("Error parsing birth date:", customerData.birth_date, e); /* Ignore if parsing fails */ }
        }
        if (isEligible && criteria.allowedDaysOfWeek && criteria.allowedDaysOfWeek.length > 0) {
            if (!criteria.allowedDaysOfWeek.includes(currentDayOfWeek)) {
                isEligible = false; eligibilityFailReason = "Not valid on this day of the week.";
            }
        }
        if (isEligible && criteria.activeTimeWindows && criteria.activeTimeWindows.length > 0) {
             const appliesNow = criteria.activeTimeWindows.some(window => {
                 const daysMatch = !window.daysOfWeek || window.daysOfWeek.length === 0 || window.daysOfWeek.includes(currentDayOfWeek);
                 return daysMatch && currentTime >= window.startTime && currentTime <= window.endTime;
             });
             if (!appliesNow) {
                 isEligible = false; eligibilityFailReason = "Not valid at the current time.";
             }
        }
        if (isEligible && criteria.validDateRange) {
            if (criteria.validDateRange.startDate && todayStr < criteria.validDateRange.startDate) {
                isEligible = false; eligibilityFailReason = `Reward not active until ${criteria.validDateRange.startDate}.`;
            }
            if (isEligible && criteria.validDateRange.endDate && todayStr > criteria.validDateRange.endDate) {
                isEligible = false; eligibilityFailReason = `Reward expired on ${criteria.validDateRange.endDate}.`;
            }
        }
        if (isEligible && criteria.isSignUpBonus) {
            // Example: Sign up bonus only valid if claimed within 7 days of joining
            const joinDate = customerData.join_date ? new Date(customerData.join_date) : null;
            const daysSinceJoin = joinDate ? (today.getTime() - joinDate.getTime()) / (1000 * 3600 * 24) : Infinity;
            if (!joinDate /* || daysSinceJoin > 7 */) { // Add time limit if desired
                 isEligible = false; eligibilityFailReason = "Sign up bonus conditions not met.";
            }
        }

        // TODO: Add checks for product-related criteria (minSpendPerTransaction, requiredProductIds etc.)
        // These are complex for a generic claim and likely need different handling (e.g., at checkout).
        // For now, they won't block a claim here unless specifically implemented.

        // --- Check sufficient points for redemption AFTER checking eligibility ---
        if (isEligible && pointsCost > 0 && customerData.loyalty_points < pointsCost) {
            isEligible = false; // Not enough points *to redeem*, even if criteria met
            eligibilityFailReason = `Insufficient points. Need ${pointsCost}, have ${customerData.loyalty_points}.`;
        }
    }

    // --- 4. Check final eligibility ---
    if (!isEligible) {
        await connection.rollback();
        return res.status(400).json({ message: eligibilityFailReason });
    }

    // --- 5. Perform DB Updates ---
    if (isVoucherClaim && voucherInstanceId) {
      // Update voucher status
      const [updateVoucherResult] = await connection.query(
        "UPDATE CustomerVouchers SET status = 'claimed' WHERE instance_id = ? AND customer_id = ? AND status = 'active'",
        [voucherInstanceId, customerDbId]
      );
      if (updateVoucherResult.affectedRows === 0) {
        await connection.rollback(); // Rollback if status wasn't active or row locked
        return res.status(409).json({ message: 'Voucher could not be claimed (possibly already used or expired).' });
      }
    } else if (!isVoucherClaim && rewardId) {
      // Claiming a general reward
      // a. Deduct points if necessary
      if (pointsCost > 0) {
        const [updatePointsResult] = await connection.query(
          'UPDATE Users SET loyalty_points = loyalty_points - ? WHERE user_id = ? AND loyalty_points >= ?',
          [pointsCost, customerDbId, pointsCost]
        );
        if (updatePointsResult.affectedRows === 0) {
          await connection.rollback(); // Rollback if points became insufficient due to race condition
          return res.status(400).json({ message: 'Insufficient points for redemption (concurrent update?).' });
        }
      }
      // b. Mark reward as claimed (using customer_claimed_rewards table)
      try {
        await connection.query(
          'INSERT INTO customer_claimed_rewards (customer_id, reward_id, claimed_date) VALUES (?, ?, NOW())',
          [customerDbId, rewardId]
        );
      } catch (insertError) {
         if (insertError.code === 'ER_DUP_ENTRY') {
           await connection.rollback(); // Rollback because it was already claimed (concurrent request?)
           return res.status(409).json({ message: 'Reward already claimed (concurrent request?).' });
         } else {
           throw insertError; // Re-throw other DB errors
         }
      }
    }

    // --- 6. Commit Transaction ---
    await connection.commit();

    // TODO: Decide on response. Just success? Or updated customer points?
    // Fetching updated points might be good for frontend feedback.
    // const [updatedCustomer] = await db.query('SELECT loyalty_points FROM Users WHERE user_id = ?', [customerDbId]);
    // const currentPoints = updatedCustomer[0]?.loyalty_points;

    res.status(200).json({
       message: `Reward claimed successfully!`
       // optional: updatedPoints: currentPoints
    });

  } catch (error) {
    if (connection) await connection.rollback(); // Ensure rollback on any error
    console.error("Error claiming reward:", error);
    res.status(500).json({ message: 'Error claiming reward', error: error.message });
  } finally {
    if (connection) connection.release(); // Always release connection
  }
});

// --- Reward Definition Routes ---

// Validation middleware for reward data
const validateRewardData = (req, res, next) => {
  const { name, type, criteria_json, points_cost, discount_percentage, discount_fixed_amount } = req.body;
  
  // Required fields
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Name is required and cannot be empty" });
  }
  
  if (!type) {
    return res.status(400).json({ message: "Type is required" });
  }
  
  // Type validation
  const validTypes = ['standard', 'voucher', 'discount_coupon', 'loyalty_tier_perk', 'manual_grant'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ message: "Invalid reward type" });
  }
  
  // Validate numeric fields
  if (points_cost !== undefined && (isNaN(points_cost) || points_cost < 0)) {
    return res.status(400).json({ message: "Points cost must be a positive number" });
  }
  
  if (discount_percentage !== undefined && (isNaN(discount_percentage) || discount_percentage < 0 || discount_percentage > 100)) {
    return res.status(400).json({ message: "Discount percentage must be between 0 and 100" });
  }
  
  if (discount_fixed_amount !== undefined && (isNaN(discount_fixed_amount) || discount_fixed_amount < 0)) {
    return res.status(400).json({ message: "Fixed discount amount must be a positive number" });
  }
  
  // JSON validation for criteria
  if (criteria_json) {
    try {
      const criteria = typeof criteria_json === 'string' ? JSON.parse(criteria_json) : criteria_json;
      
      // Basic criteria validation
      if (criteria.minSpend !== undefined && (isNaN(criteria.minSpend) || criteria.minSpend < 0)) {
        return res.status(400).json({ message: "minSpend must be a positive number" });
      }
      
      if (criteria.minPoints !== undefined && (isNaN(criteria.minPoints) || criteria.minPoints < 0)) {
        return res.status(400).json({ message: "minPoints must be a positive number" });
      }
      
      if (criteria.activeTimeWindows && !Array.isArray(criteria.activeTimeWindows)) {
        return res.status(400).json({ message: "activeTimeWindows must be an array" });
      }
      
      // Store parsed criteria for later use
      req.parsedCriteria = criteria;
    } catch (error) {
      return res.status(400).json({ message: "Invalid criteria JSON format" });
    }
  }
  
  // Type-specific validations
  if (type === 'discount_coupon' && (!discount_percentage && !discount_fixed_amount)) {
    return res.status(400).json({ 
      message: "Discount coupons require either a percentage or fixed amount" 
    });
  }
  
  next();
};

// GET /api/rewards/definitions - Fetch all reward definitions
app.get('/api/rewards/definitions', async (req, res) => {
  // TODO: Consider adding authentication if rewards are sensitive
  try {
    // Modified SQL to include free menu item IDs and criteria - using GROUP_CONCAT
    const sql = `
      SELECT 
          r.reward_id,
          r.name,
          r.description,
          r.image_url,
          r.type,
          r.criteria_json, -- Select the criteria JSON
          r.points_cost, -- Select points cost
          r.discount_percentage,
          r.discount_fixed_amount,
          r.earning_hint,
          r.created_at,
          r.updated_at,
          -- Use GROUP_CONCAT for free menu items
          GROUP_CONCAT(DISTINCT rfmi.product_id) AS freeMenuItemIds -- Alias to match frontend type
      FROM Rewards r
      LEFT JOIN reward_freemenuitems rfmi ON r.reward_id = rfmi.reward_id
      GROUP BY r.reward_id -- Group by reward to aggregate free menu items
      ORDER BY r.name;
    `;
    const [rewards] = await db.query(sql);

    // Process fetched data to match frontend RawRewardItem structure
    const processedRewards = rewards.map(r => ({
      id: r.reward_id, // Map backend reward_id to frontend id
      reward_id: r.reward_id, // Include both formats for compatibility
      name: r.name,
      description: r.description,
      image: r.image_url, // Map image_url back to image for frontend type
      image_url: r.image_url, // Include both formats for compatibility
      type: r.type,
      criteria: r.criteria_json ? JSON.parse(r.criteria_json) : undefined, // Parse criteria JSON
      criteria_json: r.criteria_json, // Include both formats for compatibility
      pointsCost: r.points_cost !== null ? parseFloat(r.points_cost) : undefined, // Map points_cost and parse
      points_cost: r.points_cost !== null ? parseFloat(r.points_cost) : undefined, // Include both formats for compatibility
      freeMenuItemIds: r.freeMenuItemIds ? r.freeMenuItemIds.split(',') : [], // Use GROUP_CONCAT and split
      free_menu_item_ids: r.freeMenuItemIds ? r.freeMenuItemIds.split(',') : [], // Include both formats for compatibility
      discountPercentage: r.discount_percentage !== null ? parseFloat(r.discount_percentage) : undefined,
      discount_percentage: r.discount_percentage !== null ? parseFloat(r.discount_percentage) : undefined, // Include both formats for compatibility
      discountFixedAmount: r.discount_fixed_amount !== null ? parseFloat(r.discount_fixed_amount) : undefined,
      discount_fixed_amount: r.discount_fixed_amount !== null ? parseFloat(r.discount_fixed_amount) : undefined, // Include both formats for compatibility
      earningHint: r.earning_hint,
      earning_hint: r.earning_hint, // Include both formats for compatibility
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json(processedRewards);
  } catch (error) {
    console.error("Error fetching reward definitions:", error);
    res.status(500).json({ message: 'Error fetching reward definitions', error: error.message });
  }
});

// POST /api/rewards/definitions - Create a new reward definition
app.post('/api/rewards/definitions', authenticateToken, validateRewardData, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: Only managers can create reward definitions.' });
  }

  const { 
    name, 
    description, 
    image_url, 
    type, 
    criteria_json, 
    points_cost, 
    free_menu_item_ids, 
    discount_percentage, 
    discount_fixed_amount, 
    earning_hint 
  } = req.body;

  // Log the request for debugging
  console.log("Create reward request body:", {
    name, type, 
    image_url: image_url ? "(image present)" : undefined,
    criteria_json: criteria_json ? "(criteria present)" : undefined
  });

  const rewardId = uuidv4();
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Validate product IDs if provided
    let validFreeMenuItemIds = [];
    if (Array.isArray(free_menu_item_ids) && free_menu_item_ids.length > 0) {
      // Filter out any null, undefined, or empty string productIds
      validFreeMenuItemIds = free_menu_item_ids.filter(id => 
        id !== null && id !== undefined && id !== '');
      
      if (validFreeMenuItemIds.length > 0) {
        // Check if all product IDs exist
        const [existingProducts] = await connection.query(
          'SELECT product_id FROM Products WHERE product_id IN (?)',
          [validFreeMenuItemIds]
        );

        const existingIds = new Set(existingProducts.map(p => p.product_id));
        const invalidIds = validFreeMenuItemIds.filter(id => !existingIds.has(id));

        if (invalidIds.length > 0) {
          console.warn(`Some product IDs do not exist: ${invalidIds.join(', ')}`);
          // Filter to only valid IDs
          validFreeMenuItemIds = validFreeMenuItemIds.filter(id => existingIds.has(id));
        }
      }
    }

    // Parse or use existing criteria JSON
    let criteriaJsonValue = null;
    if (criteria_json) {
      if (typeof criteria_json === 'string') {
        // Validate JSON string
        try {
          JSON.parse(criteria_json); // Attempt to parse to validate
          criteriaJsonValue = criteria_json; // Use as-is if valid
        } catch (error) {
          await connection.rollback();
          return res.status(400).json({
            message: 'Invalid criteria_json format',
            error: error.message
          });
        }
      } else if (typeof criteria_json === 'object') {
        // Convert object to JSON string
        try {
          criteriaJsonValue = JSON.stringify(criteria_json);
        } catch (error) {
          await connection.rollback();
          return res.status(400).json({
            message: 'Invalid criteria object cannot be stringified',
            error: error.message
          });
        }
      }
    }

    // Ensure image URL is properly formatted
    let imageUrl = image_url && typeof image_url === 'string' ? image_url.trim() : null;
    
    // If image URL is relative and doesn't include /uploads/, add the uploads directory
    if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/src/assets') && !imageUrl.includes('/uploads/')) {
      // Handle both with and without leading slash
      imageUrl = '/uploads/' + imageUrl.replace(/^\/+/, '');
    }

    // Insert the main reward definition
    const insertRewardSql = `
      INSERT INTO Rewards (
        reward_id, name, description, image_url, type, 
        criteria_json, points_cost, discount_percentage, 
        discount_fixed_amount, earning_hint
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await connection.query(insertRewardSql, [
      rewardId,
      name.trim(),
      description?.trim() || null,
      imageUrl,
      type,
      criteriaJsonValue,
      points_cost || null,
      discount_percentage || null,
      discount_fixed_amount || null,
      earning_hint?.trim() || null
    ]);

    console.log(`Created new reward "${name}" with ID ${rewardId}`);

    // Handle free_menu_item_ids
    if (validFreeMenuItemIds.length > 0) {
      const insertFreeItemsSql = 'INSERT INTO reward_freemenuitems (reward_id, product_id) VALUES ?';
      const freeItemValues = validFreeMenuItemIds.map(productId => [rewardId, productId]);
      await connection.query(insertFreeItemsSql, [freeItemValues]);
      console.log(`Added ${validFreeMenuItemIds.length} free menu items to reward ${rewardId}`);
    }

    await connection.commit();

    // Fetch the complete reward data
    const [newRewardRows] = await db.query('SELECT * FROM Rewards WHERE reward_id = ?', [rewardId]);
    const newReward = newRewardRows[0];

    const [freeItemsRows] = await db.query(
      'SELECT product_id FROM reward_freemenuitems WHERE reward_id = ?',
      [rewardId]
    );
    const fetchedFreeMenuItemIds = freeItemsRows.map(row => row.product_id);

    // Return properly typed response with both camelCase and snake_case props for compatibility
    const responseReward = {
      id: newReward.reward_id,
      reward_id: newReward.reward_id,
      name: newReward.name,
      description: newReward.description,
      image: newReward.image_url,
      image_url: newReward.image_url,
      type: newReward.type,
      criteria: newReward.criteria_json ? safeJsonParse(newReward.criteria_json) : null,
      criteria_json: newReward.criteria_json,
      pointsCost: newReward.points_cost !== null ? parseFloat(newReward.points_cost) : null,
      points_cost: newReward.points_cost !== null ? parseFloat(newReward.points_cost) : null,
      freeMenuItemIds: fetchedFreeMenuItemIds,
      free_menu_item_ids: fetchedFreeMenuItemIds,
      discountPercentage: newReward.discount_percentage !== null ? parseFloat(newReward.discount_percentage) : null,
      discount_percentage: newReward.discount_percentage !== null ? parseFloat(newReward.discount_percentage) : null,
      discountFixedAmount: newReward.discount_fixed_amount !== null ? parseFloat(newReward.discount_fixed_amount) : null,
      discount_fixed_amount: newReward.discount_fixed_amount !== null ? parseFloat(newReward.discount_fixed_amount) : null,
      earningHint: newReward.earning_hint,
      earning_hint: newReward.earning_hint,
      createdAt: newReward.created_at,
      updatedAt: newReward.updated_at
    };

    res.status(201).json(responseReward);

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error creating reward definition:', error);
    res.status(500).json({
      message: 'Error creating reward definition',
      error: error.message,
      details: error.code === 'ER_DUP_ENTRY' ? 'A reward with this name already exists.' : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// PUT /api/rewards/definitions/:id - Update a reward definition
app.put('/api/rewards/definitions/:id', authenticateToken, upload.single('image'), async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: Only managers can update reward definitions.' });
  }
  const { id } = req.params;
  const updateData = req.body;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if reward exists
    const [existingReward] = await connection.query(
      'SELECT * FROM Rewards WHERE reward_id = ?', 
      [id]
    );

    if (existingReward.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Reward not found.' });
    }

    // Handle file upload - if a file was uploaded, set the image_url
    if (req.file) {
      updateData.image_url = getUploadedFileUrl(req.file);
    }

    // If we're receiving JSON data (not multipart form data with file)
    if (req.headers['content-type']?.includes('application/json')) {
      // Parse and validate JSON fields if needed
      if (updateData.free_menu_item_ids && Array.isArray(updateData.free_menu_item_ids)) {
        // Free menu items will be handled separately
      }

      // Ensure numeric fields are properly formatted
      if (updateData.points_cost !== undefined) {
        updateData.points_cost = Number(updateData.points_cost);
      }
      if (updateData.discount_percentage !== undefined) {
        updateData.discount_percentage = Number(updateData.discount_percentage);
      }
      if (updateData.discount_fixed_amount !== undefined) {
        updateData.discount_fixed_amount = Number(updateData.discount_fixed_amount);
      }
    }

    // Get old reward data for image cleanup
    const oldImageUrl = existingReward[0].image_url;

    // Update the reward table
    const updateFields = { ...updateData };
    
    // Remove free_menu_item_ids from update fields (will be handled separately)
    delete updateFields.free_menu_item_ids;

    if (Object.keys(updateFields).length > 0) {
      await connection.query('UPDATE Rewards SET ? WHERE reward_id = ?', [updateFields, id]);
    }

    // Handle free menu items if provided
    if (updateData.free_menu_item_ids && Array.isArray(updateData.free_menu_item_ids)) {
      // First delete existing associations
      await connection.query('DELETE FROM reward_freemenuitems WHERE reward_id = ?', [id]);

      // Add new associations if there are any
      if (updateData.free_menu_item_ids.length > 0) {
        const freeMenuItemInserts = updateData.free_menu_item_ids
          .filter(Boolean) // Filter out any null/undefined/empty values
          .map(productId => [id, productId]);

        if (freeMenuItemInserts.length > 0) {
          await connection.query(
            'INSERT INTO reward_freemenuitems (reward_id, product_id) VALUES ?',
            [freeMenuItemInserts]
          );
        }
      }
    }

    // If we updated the image and old image exists, delete old image
    if (updateData.image_url && oldImageUrl && updateData.image_url !== oldImageUrl) {
      await deleteUnusedImage(oldImageUrl);
    }

    // Commit transaction
    await connection.commit();

    // Fetch updated reward including free menu items
    const sql = `
      SELECT 
        r.*,
        GROUP_CONCAT(rfmi.product_id) AS free_menu_item_ids
      FROM Rewards r
      LEFT JOIN reward_freemenuitems rfmi ON r.reward_id = rfmi.reward_id
      WHERE r.reward_id = ?
      GROUP BY r.reward_id
    `;
    const [updatedRows] = await connection.query(sql, [id]);
    
    if (updatedRows.length === 0) {
      return res.status(404).json({ message: 'Reward not found after update.' });
    }

    const updatedReward = updatedRows[0];
    
    // Process for response format
    const responseReward = {
      id: updatedReward.reward_id,
      reward_id: updatedReward.reward_id,
      name: updatedReward.name,
      description: updatedReward.description,
      image: updatedReward.image_url,
      image_url: updatedReward.image_url,
      type: updatedReward.type,
      criteria: updatedReward.criteria_json ? safeJsonParse(updatedReward.criteria_json) : null,
      criteria_json: updatedReward.criteria_json,
      pointsCost: updatedReward.points_cost !== null ? parseFloat(updatedReward.points_cost) : null,
      points_cost: updatedReward.points_cost !== null ? parseFloat(updatedReward.points_cost) : null,
      freeMenuItemIds: updatedReward.free_menu_item_ids ? updatedReward.free_menu_item_ids.split(',') : [],
      free_menu_item_ids: updatedReward.free_menu_item_ids ? updatedReward.free_menu_item_ids.split(',') : [],
      discountPercentage: updatedReward.discount_percentage !== null ? parseFloat(updatedReward.discount_percentage) : null,
      discount_percentage: updatedReward.discount_percentage !== null ? parseFloat(updatedReward.discount_percentage) : null,
      discountFixedAmount: updatedReward.discount_fixed_amount !== null ? parseFloat(updatedReward.discount_fixed_amount) : null,
      discount_fixed_amount: updatedReward.discount_fixed_amount !== null ? parseFloat(updatedReward.discount_fixed_amount) : null,
      earningHint: updatedReward.earning_hint,
      earning_hint: updatedReward.earning_hint,
      createdAt: updatedReward.created_at,
      updatedAt: updatedReward.updated_at
    };

    res.json(responseReward);

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error updating reward definition:', error);
    res.status(500).json({
      message: 'Error updating reward definition',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// DELETE /api/rewards/definitions/:id - Delete a reward definition
app.delete('/api/rewards/definitions/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: Only managers can delete reward definitions.' });
  }
  const { id } = req.params;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    // First check if the reward exists
    const [existingReward] = await connection.query(
      'SELECT * FROM Rewards WHERE reward_id = ?', 
      [id]
    );
    
    if (existingReward.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Reward not found.' });
    }

    // 1. First delete order_rewards records that reference this reward's vouchers
    await connection.query(
      `DELETE order_rewards FROM order_rewards
       INNER JOIN customervouchers cv ON order_rewards.voucher_id = cv.voucher_instance_id
       WHERE cv.reward_id = ?`,
      [id]
    );

    // 2. Delete order_rewards records that directly reference this reward
    await connection.query(
      'DELETE FROM order_rewards WHERE reward_id = ?',
      [id]
    );
    
    // 3. Delete customer_claimed_rewards records
    await connection.query(
      'DELETE FROM customer_claimed_rewards WHERE reward_id = ?',
      [id]
    );
    
    // 4. Delete reward usage records
    await connection.query(
      'DELETE FROM reward_usage WHERE reward_id = ?',
      [id]
    );
    
    // 5. Delete orderlineitems records that reference this reward
    await connection.query(
      'DELETE FROM orderlineitems WHERE reward_id = ?',
      [id]
    );
    
    // 6. Delete voucher records from customervouchers table
    await connection.query(
      'DELETE FROM customervouchers WHERE reward_id = ?',
      [id]
    );
    
    // 7. Delete free menu items associations
    await connection.query(
      'DELETE FROM reward_freemenuitems WHERE reward_id = ?',
      [id]
    );

    // 8. Clean up associated image if it exists in uploads directory
    if (existingReward[0].image_url && existingReward[0].image_url.includes('/uploads/')) {
      try {
        const imagePath = path.join(__dirname, '..', existingReward[0].image_url);
        if (fsSync.existsSync(imagePath)) {
          await fs.unlink(imagePath);
          console.log(`Deleted image file: ${imagePath}`);
        }
      } catch (imgError) {
        console.error('Error deleting reward image file:', imgError);
        // Don't fail the reward deletion if image deletion fails
      }
    }
    
    // 9. Finally delete the reward itself
    const [result] = await connection.query(
      'DELETE FROM Rewards WHERE reward_id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Reward definition not found.' });
    }

    await connection.commit();
    res.json({ message: 'Reward definition deleted successfully.' });
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error deleting reward:', error);
    res.status(500).json({ message: 'Error deleting reward definition', error: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// POST /api/rewards/grant-voucher - Grant a voucher to a customer
app.post('/api/rewards/grant-voucher', authenticateToken, async (req, res) => {
  // Allow managers, employees and cashiers to grant vouchers
  if (req.user.role !== 'manager' && req.user.role !== 'employee' && req.user.role !== 'cashier') {
    return res.status(403).json({ message: 'Forbidden: Only authorized staff can grant vouchers.' });
  }
  
  const { customerId, rewardId, notes } = req.body;
  const grantedByEmployeeId = req.user.userId; // Use the authenticated user's ID
  
  // Validate required fields
  if (!customerId) {
    return res.status(400).json({ message: 'Customer ID is required.' });
  }
  
  if (!rewardId) {
    return res.status(400).json({ message: 'Reward ID is required.' });
  }
  
  let connection;
  
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    // 1. Verify the customer exists
    const [customerRows] = await connection.query(
      'SELECT * FROM Users WHERE user_id = ?',
      [customerId]
    );
    
    if (customerRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Customer not found.' });
    }
    
    // 2. Verify the reward exists and is a valid type for granting
    const [rewardRows] = await connection.query(
      'SELECT * FROM Rewards WHERE reward_id = ?',
      [rewardId]
    );
    
    if (rewardRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Reward not found.' });
    }
    
    const reward = rewardRows[0];
    
    // Only certain reward types can be granted as vouchers
    if (reward.type !== 'voucher' && reward.type !== 'manual_grant') {
      await connection.rollback();
      return res.status(400).json({ 
        message: 'Only reward types "voucher" and "manual_grant" can be issued as vouchers.' 
      });
    }
    
    // 3. Create a new voucher instance
    const voucherId = uuidv4();
    const now = new Date();
    
    // Calculate expiry date (default: 30 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    // If the reward has a validDateRange in criteria_json, use that for expiry
    let customExpiryDate = null;
    if (reward.criteria_json) {
      try {
        const criteria = JSON.parse(reward.criteria_json);
        if (criteria.validDateRange && criteria.validDateRange.endDate) {
          const criteriaEndDate = new Date(criteria.validDateRange.endDate);
          if (!isNaN(criteriaEndDate.getTime())) {
            customExpiryDate = criteriaEndDate;
          }
        }
      } catch (e) {
        console.error('Error parsing reward criteria:', e);
        // Continue with default expiry date
      }
    }
    
    // Get free menu items from the reward if any
    let rewardFreeMenuItems = [];
    if (reward.free_menu_item_ids) {
      try {
        rewardFreeMenuItems = JSON.parse(reward.free_menu_item_ids);
      } catch (e) {
        console.error('Error parsing free_menu_item_ids:', e);
        rewardFreeMenuItems = [];
      }
    }
    
    // 4. Insert the voucher into the customervouchers table
    await connection.query(
      `INSERT INTO customervouchers 
       (voucher_instance_id, reward_id, user_id, name_snapshot, description_snapshot, 
        granted_date, expiry_date, status, granted_by_method, employee_grant_user_id, employee_grant_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'employee_granted', ?, ?)`,
      [
        voucherId,
        rewardId,
        customerId,
        reward.name,
        reward.description,
        now,
        customExpiryDate || expiryDate,
        grantedByEmployeeId,
        notes || null
      ]
    );
    
    await connection.commit();
    
    // If the voucher includes free items, fetch their details
    let includedProducts = [];
    if (rewardFreeMenuItems && rewardFreeMenuItems.length > 0) {
      try {
        const [productRows] = await connection.query(
          'SELECT product_id, name, image_url FROM Products WHERE product_id IN (?)',
          [rewardFreeMenuItems]
        );
        includedProducts = productRows.map(p => ({
          id: p.product_id,
          name: p.name,
          image: p.image_url
        }));
      } catch (e) {
        console.error('Error fetching included products:', e);
      }
    }
    
    res.status(201).json({
      message: 'Voucher granted successfully',
      voucherId: voucherId,
      expiryDate: customExpiryDate || expiryDate,
      includedProducts: includedProducts.length > 0 ? includedProducts : undefined,
      rewardName: reward.name
    });
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error granting voucher:', error);
    res.status(500).json({ message: 'Error granting voucher', error: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// --- Customer Info Route ---

// GET /api/customers/:customerId/info - Fetch detailed info for rewards page
app.get('/api/customers/:customerId/info', authenticateToken, async (req, res) => {
  const { customerId } = req.params;
  const requestingUserId = req.user.userId;
  const requestingUserRole = req.user.role;

  console.log(`[GET /api/customers/${customerId}/info] Auth user: ${requestingUserId} (${requestingUserRole}), accessing customer: ${customerId}`);

  // Authorization: Customer can get their own info, all staff roles can access
  // If the user is a customer, they can only request their own ID
  if (requestingUserRole === 'customer' && String(requestingUserId) !== customerId) {
      return res.status(403).json({ message: 'Forbidden: Customers can only view their own information.' });
  }

  try {
    // 1. Fetch basic user data
    const userSql = `
      SELECT user_id, name, email, loyalty_points, birth_date, join_date, membership_tier, referrals_made, avatar_url
      FROM Users WHERE user_id = ?;
    `;
    const [userRows] = await db.query(userSql, [customerId]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found.' });
    }
    const customerBaseData = userRows[0];

    // 2. Fetch Purchases This Month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const purchasesSql = `SELECT COUNT(*) AS count FROM Orders WHERE customer_id = ? AND order_timestamp >= ?`;
    const [purchaseRows] = await db.query(purchasesSql, [customerId, startOfMonth]);
    const purchasesThisMonth = purchaseRows[0].count || 0;

    // 3. Fetch Lifetime Spend
    const spendSql = `SELECT SUM(total_amount) AS total FROM Orders WHERE customer_id = ?`;
    const [spendRows] = await db.query(spendSql, [customerId]);
    const lifetimeTotalSpend = parseFloat(spendRows[0].total) || 0;

    // 4. Fetch Active Vouchers
    const voucherSql = `
        SELECT 
            cv.voucher_instance_id AS instance_id, 
            cv.reward_id, 
            r.name, 
            r.description, 
            cv.granted_date, 
            cv.expiry_date, 
            cv.status, 
            cv.granted_by_method -- Corrected column name
        FROM CustomerVouchers cv
        JOIN Rewards r ON cv.reward_id = r.reward_id
        WHERE cv.user_id = ? AND cv.status = \'active\' AND (cv.expiry_date IS NULL OR cv.expiry_date >= CURDATE())
        ORDER BY cv.granted_date DESC;
    `; // Also check expiry date here
    const [activeVouchers] = await db.query(voucherSql, [customerId]);

    // 5. Fetch Claimed General Rewards
    const claimedSql = `SELECT reward_id FROM customer_claimed_rewards WHERE customer_id = ?`;
    const [claimedRewardsRows] = await db.query(claimedSql, [customerId]);
    const claimedGeneralRewardIds = claimedRewardsRows.map(row => row.reward_id); // Extract IDs

    // 5. Construct CustomerInfo object
    const customerInfo = {
        id: customerBaseData.user_id.toString(), // Ensure string ID
        name: customerBaseData.name,
        avatar: customerBaseData.avatar_url,
        birthDate: customerBaseData.birth_date ? customerBaseData.birth_date.toISOString().split('T')[0] : undefined,
        loyaltyPoints: customerBaseData.loyalty_points || 0,
        purchasesThisMonth: purchasesThisMonth,
        lifetimeTotalSpend: lifetimeTotalSpend,
        // lifetimeTotalVisits: /* Add query if needed */,
        membershipTier: customerBaseData.membership_tier,
        joinDate: customerBaseData.join_date ? customerBaseData.join_date.toISOString().split('T')[0] : undefined,
        referralsMade: customerBaseData.referrals_made || 0,
        activeVouchers: activeVouchers, // Add fetched active vouchers
        claimedGeneralRewardIds: claimedGeneralRewardIds // Add fetched claimed general reward IDs
        // Map voucher fields if DB names differ from CustomerVoucher type
    };

    console.log('[Backend GET /api/customers/:customerId/info] Constructed customerInfo:', customerInfo); // Add this logging

    res.json(customerInfo);

  } catch (error) {
    console.error(`Error fetching info for customer ${customerId}:`, error);
    res.status(500).json({ message: 'Error fetching customer information', error: error.message });
  }
});

// --- Start Server ---
const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  
  // Print out all registered routes for debugging
  console.log('\n=== REGISTERED ROUTES ===');
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Routes registered directly on the app
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods).join(', ').toUpperCase()
      });
    } else if (middleware.name === 'router') {
      // Router middleware
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods).join(', ').toUpperCase()
          });
        }
      });
    }
  });
  
  // Sort and print routes
  routes.sort((a, b) => a.path.localeCompare(b.path));
  routes.forEach(route => {
    console.log(`${route.methods}: ${route.path}`);
  });
  console.log('=========================\n');
}); 

// Route to get users available for employment (not already employees)
app.get('/api/users/available', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: "Forbidden: Only managers can access this resource." });
  }

  try {
    const query = `
      SELECT u.user_id, u.name, u.email, u.role 
      FROM Users u
      LEFT JOIN employeedetails e ON u.user_id = e.user_id
      WHERE e.user_id IS NULL;
    `;
    const [availableUsers] = await db.query(query); // Changed pool to db
    res.json(availableUsers);
  } catch (error) {
    console.error('Error fetching available users:', error);
    res.status(500).json({ message: 'Error fetching available users from the database' });
  }
}); 

// --- Employee Management Endpoints (Manager Only) ---

// POST /api/employees - Create a new employee
app.post('/api/employees', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: "Forbidden: Only managers can create employees." });
  }

  console.log('[Backend POST /api/employees] Received request body:', JSON.stringify(req.body, null, 2));

  const { userEmail, employeeIdCode, position, status: requestStatus, phone, hireDate, role: newRole } = req.body;

  console.log('[Backend POST /api/employees] Destructured values:', { userEmail, employeeIdCode, position, status: requestStatus, phone, hireDate, role: newRole });

  if (!userEmail || !employeeIdCode || !position) {
    console.log('[Backend POST /api/employees] Core validation failed. Values:', { userEmail: !!userEmail, employeeIdCode: !!employeeIdCode, position: !!position });
    return res.status(400).json({ message: 'User Email, Employee ID Code, and Position are required.' });
  }

  if (newRole && !['manager', 'employee', 'cashier', 'cook', 'customer'].includes(newRole)) {
    return res.status(400).json({ message: 'Invalid role provided for the user.' });
  }

  let connection;
  try {
    connection = await db.getConnection();

    // Check for existing employee_id_code BEFORE starting transaction
    const [existingEmployeeByIdCode] = await connection.query('SELECT employee_internal_id FROM employeedetails WHERE employee_id_code = ?', [employeeIdCode.trim()]);
    if (existingEmployeeByIdCode.length > 0) {
      console.log('[Backend POST /api/employees] Conflict: Employee ID Code already exists.');
      connection.release();
      return res.status(409).json({ message: 'Employee ID Code already exists.', field: 'employeeIdCode' });
    }

    await connection.beginTransaction();

    const [usersFound] = await connection.query('SELECT user_id FROM Users WHERE email = ?', [userEmail]);
    if (usersFound.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'User not found with the provided email.' });
    }
    const userId = usersFound[0].user_id;

    const [existingEmployeeByUserId] = await connection.query('SELECT employee_internal_id FROM employeedetails WHERE user_id = ?', [userId]);
    if (existingEmployeeByUserId.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({ message: 'This user is already registered as an employee.', field: 'userEmail' });
    }

    const finalStatus = requestStatus || 'Active';
    const finalPhone = phone?.trim() || null;
    const finalHireDate = hireDate ? new Date(hireDate).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');
    const finalRole = newRole || 'employee'; 

    const [result] = await connection.query(
      'INSERT INTO employeedetails (user_id, employee_id_code, position, status, hire_date) VALUES (?, ?, ?, ?, ?)',
      [userId, employeeIdCode.trim(), position, finalStatus, finalHireDate]
    );
    const employeeInternalId = result.insertId;

    await connection.commit();
    
    const [newEmployeeArr] = await connection.query(
      `SELECT ed.employee_internal_id, ed.employee_id_code, ed.position, ed.status, u.phone_number, ed.hire_date, u.email, u.name AS employeeName, u.role AS user_role FROM employeedetails ed JOIN users u ON ed.user_id = u.user_id WHERE ed.employee_internal_id = ?`,
      [employeeInternalId]
    );
    
    connection.release(); // Release connection after successful operation and fetch

    if (newEmployeeArr.length === 0) {
        // This case should be rare if insert and commit were successful
        return res.status(500).json({ message: "Failed to retrieve newly created employee details after creation." });
    }
    
    res.status(201).json(newEmployeeArr[0]);

  } catch (error) {
    if (connection) {
        try { await connection.rollback(); } catch (rbError) { console.error("[Backend POST /api/employees] Rollback error", rbError); }
        try { connection.release(); } catch (relError) { console.error("[Backend POST /api/employees] Release error", relError); }
    }
    console.error('[Backend POST /api/employees] Error:', error); // Log the full error on the server

    // Specific conflict errors are handled by pre-checks or more specific catch blocks if necessary.
    if (error.sqlState === '23000' && error.message.includes('employeedetails_user_id_unique')) { 
        return res.status(409).json({ message: 'This user is already registered as an employee.' });
    } 
    // For other errors, send a generic message
    res.status(500).json({ message: 'An unexpected error occurred while creating the employee.' });
  } 
});

// GET /api/employees - Retrieve all employees
app.get('/api/employees', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: "Forbidden: Only managers can view all employees." });
  }
  try {
    // Query to select all employees and join with users table to get name and email
    const query = `
      SELECT 
        e.employee_internal_id, e.user_id, e.employee_id_code, e.position, e.status, 
        u.phone_number, e.hire_date, e.created_at, e.updated_at, -- Select phone_number from users table (u)
        u.name as employeeName, u.email, u.role as user_role 
      FROM employeedetails e
      JOIN users u ON e.user_id = u.user_id
      ORDER BY e.created_at DESC; 
    `;
    const [employees] = await db.query(query);
    res.json(employees);
  } catch (error) {
    console.error('[Backend GET /api/employees] Error fetching employees:', error); // Log full error
    res.status(500).json({ message: 'An unexpected error occurred while fetching employees.' });
  }
});

// PUT /api/employees/:employeeInternalId - Update an existing employee
app.put('/api/employees/:employeeInternalId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: "Forbidden: Only managers can update employees." });
  }

  const { employeeInternalId } = req.params;
  const { employeeIdCode, position, status, phone_number, hireDate, role: newRole } = req.body;

  console.log(`[Backend PUT /api/employees/${employeeInternalId}] Received body:`, JSON.stringify(req.body, null, 2));

  if (!employeeIdCode && !position && !status && phone_number === undefined && hireDate === undefined && !newRole) {
    return res.status(400).json({ message: 'No update information provided.' });
  }
  if (newRole && !['manager', 'employee', 'cashier', 'cook', 'customer'].includes(newRole)) {
    return res.status(400).json({ message: 'Invalid role provided.' });
  }

  let connection;
  try {
    connection = await db.getConnection();

    // Check if the employee exists
    const [currentEmployeeArr] = await connection.query('SELECT * FROM employeedetails WHERE employee_internal_id = ?', [employeeInternalId]);
    if (currentEmployeeArr.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Employee not found.' });
    }
    const currentEmployee = currentEmployeeArr[0];

    // If employeeIdCode is being changed, check for its uniqueness against OTHER employees
    if (employeeIdCode && employeeIdCode.trim() !== currentEmployee.employee_id_code) {
      const [existingEmployeeWithNewId] = await connection.query(
        'SELECT employee_internal_id FROM employeedetails WHERE employee_id_code = ? AND employee_internal_id != ?',
        [employeeIdCode.trim(), employeeInternalId]
      );
      if (existingEmployeeWithNewId.length > 0) {
        console.log(`[Backend PUT /api/employees/${employeeInternalId}] Conflict: New Employee ID Code already exists.`);
        connection.release();
        return res.status(409).json({ message: 'The new Employee ID Code is already in use by another employee.', field: 'employeeIdCode' });
      }
    }

    await connection.beginTransaction();

    const setClauses = [];
    const params = [];

    if (employeeIdCode) {
      setClauses.push('employee_id_code = ?');
      params.push(employeeIdCode.trim());
    }
    if (position) {
      setClauses.push('position = ?');
      params.push(position);
    }
    if (status) {
      setClauses.push('status = ?');
      params.push(status);
    }
    if (hireDate) {
      setClauses.push('hire_date = ?');
      params.push(new Date(hireDate).toISOString().slice(0, 19).replace('T', ' '));
    }

    if (setClauses.length > 0) {
      setClauses.push('updated_at = NOW()');
      const updateEmployeedetailsSQL = `UPDATE employeedetails SET ${setClauses.join(', ')} WHERE employee_internal_id = ?`;
      params.push(employeeInternalId);
      console.log("[Backend PUT /api/employees] Executing employeedetails update:", updateEmployeedetailsSQL, params);
      await connection.query(updateEmployeedetailsSQL, params);
    }

    // Update phone_number in the users table if provided
    // Check if phone_number was explicitly included in the request body (allowing null/empty string)
    if (req.body.hasOwnProperty('phone_number')) {
      console.log(`[Backend PUT /api/employees/${req.params.employeeInternalId}] Checking for phone_number update.`);
      const userIdToUpdate = currentEmployee.user_id; // Get user_id from the fetched employee record
      console.log(`[Backend PUT /api/employees/${req.params.employeeInternalId}] userIdToUpdate for phone_number:`, userIdToUpdate);
      if (userIdToUpdate) {
        console.log(`[Backend PUT /api/employees/${req.params.employeeInternalId}] Updating user ${userIdToUpdate} phone_number`);
        // Use req.body.phone_number, converting empty string to null for DB if needed
        await connection.query('UPDATE users SET phone_number = ? WHERE user_id = ?', [req.body.phone_number || null, userIdToUpdate]);
      } else {
        console.warn(`[Backend PUT /api/employees/${req.params.employeeInternalId}] Cannot update phone_number, user_id not found for employee.`);
      }
    }

    if (setClauses.length === 0) {
        // This case should ideally be caught by the initial check for no update info, but as a safeguard within transaction:
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: 'No actual changes to apply for employee details or user role.' });
    }

    await connection.commit();

    // Fetch the updated employee details to return
    const [updatedEmployeeArr] = await connection.query(
      `SELECT ed.employee_internal_id, ed.employee_id_code, ed.position, ed.status, u.phone_number, ed.hire_date, u.email, u.name AS employeeName, u.role AS user_role
       FROM employeedetails ed JOIN users u ON ed.user_id = u.user_id
       WHERE ed.employee_internal_id = ?`,
      [employeeInternalId]
    );
    
    connection.release();

    if (updatedEmployeeArr.length === 0) {
        return res.status(404).json({ message: "Employee not found after update attempt (should not happen if initial check passed)." });
    }

    res.json(updatedEmployeeArr[0]);

  } catch (error) {
    if (connection) {
        try { await connection.rollback(); } catch (rbError) { console.error(`[Backend PUT /api/employees/${req.params.employeeInternalId}] Rollback error`, rbError); }
        try { connection.release(); } catch (relError) { console.error(`[Backend PUT /api/employees/${req.params.employeeInternalId}] Release error`, relError); }
    }
    console.error(`[Backend PUT /api/employees/${req.params.employeeInternalId}] Error:`, error); // Log full error
    // Specific conflict errors (like employeeIdCode) are handled by pre-checks.
    res.status(500).json({ message: 'An unexpected error occurred while updating the employee.' });
  }
});

// DELETE /api/employees/:employeeInternalId - Hard delete an employee and revert user role
app.delete('/api/employees/:employeeInternalId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: "Forbidden: Only managers can delete employees." });
  }
  const { employeeInternalId } = req.params;
  if (!employeeInternalId) {
    return res.status(400).json({ message: 'Employee Internal ID is required.'});
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Step 1: Get the user_id from the employeedetails record before deleting it
    const [employeeArr] = await connection.query('SELECT user_id FROM employeedetails WHERE employee_internal_id = ?', [employeeInternalId]);
    if (employeeArr.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Employee not found.' });
    }
    const userIdToDelete = employeeArr[0].user_id;

    // Step 2: Delete the employee record from employeedetails table
    const [deleteResult] = await connection.query('DELETE FROM employeedetails WHERE employee_internal_id = ?', [employeeInternalId]);
    if (deleteResult.affectedRows === 0) {
      // This should ideally not happen if the previous select found the employee, but as a safeguard:
      await connection.rollback();
      return res.status(404).json({ message: 'Employee not found during delete operation.' }); 
    }

    // Step 3: Revert the user's role to 'customer' in the users table
    if (userIdToDelete) { // Ensure we have a userId
      const [updateUserResult] = await connection.query('UPDATE users SET role = ? WHERE user_id = ?', ['customer', userIdToDelete]);
      console.log(`User ${userIdToDelete} role reverted to customer. Affected rows: ${updateUserResult.affectedRows}`);
    } else {
      // This case implies employeedetails record had no user_id, which is a data integrity issue but we handle it gracefully.
      console.warn(`Employee record ${employeeInternalId} did not have an associated user_id. Cannot revert role.`);
    }

    await connection.commit();
    res.status(200).json({ message: 'Employee successfully deleted and user role reverted to customer.' });

  } catch (error) {
    if (connection) {
        try { await connection.rollback(); } catch (rbError) { console.error(`[Backend DELETE /api/employees/${req.params.employeeInternalId}] Rollback error`, rbError); }
        try { connection.release(); } catch (relError) { console.error(`[Backend DELETE /api/employees/${req.params.employeeInternalId}] Release error`, relError); }
    }
    console.error(`[Backend DELETE /api/employees/${req.params.employeeInternalId}] Error:`, error); // Log full error
    res.status(500).json({ message: 'An unexpected error occurred while deleting the employee.' });
  }
});

// --- Option Groups CRUD ---
// ... existing code ...

// PATCH - Update product availability
app.patch('/api/products/:productId/availability', authenticateToken, async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: Only managers can update product availability.' });
  }

  const { productId } = req.params;
  const { availability } = req.body;

  if (!availability || !['available', 'unavailable'].includes(availability)) {
    return res.status(400).json({ message: 'Invalid availability status provided.' });
  }

  try {
    const [result] = await db.query(
      'UPDATE Products SET availability = ?, updated_at = NOW() WHERE product_id = ?',
      [availability, productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found or no change in availability.' });
    }

    // Fetch the updated product to return it
    const [updatedProductRows] = await db.query('SELECT * FROM Products WHERE product_id = ?', [productId]);
    if (updatedProductRows.length === 0) {
        // This case should ideally not happen if the update was successful
        return res.status(404).json({ message: 'Product not found after update.' });
    }

    res.json(updatedProductRows[0]);
  } catch (error) {
    console.error("Error updating product availability:", error);
    res.status(500).json({ message: 'Error updating product availability', error: error.message });
  }
});

// DELETE a product by ID
app.delete('/api/products/:productId', authenticateToken, async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  const { productId } = req.params;

  try {
    // TODO: Add check for related OrderLineItems? Or handle via FK constraint?
    const [result] = await db.query('DELETE FROM Products WHERE product_id = ?', [productId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.status(200).json({ message: 'Product deleted successfully.' }); // Or status 204 (No Content)

  } catch (error) {
    console.error(`Error deleting product ${productId}:`, error);
    // Handle potential foreign key constraint errors if Orders reference Products
    if (error.code === 'ER_ROW_IS_REFERENCED_2') { // Check specific error code for FK violation
       return res.status(400).json({ message: 'Cannot delete product as it is referenced in existing orders.' });
    }
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
});

// GET user data by ID
app.get('/api/users/:userId', authenticateToken, async (req, res) => {
  const requestedUserId = req.params.userId; // User ID from the URL parameter
  const authenticatedUserDbId = req.user.userId; // User ID from the authenticated token
  const authenticatedUserInternalId = req.user.internalId; // Internal ID from the token
  const authenticatedUserRole = req.user.role; // Role from the authenticated token

  // Modified to allow all authenticated staff to view any customer profile
  // Only customers are restricted to viewing their own profiles
  const isOwnProfile = String(authenticatedUserDbId) === String(requestedUserId) || 
                       String(authenticatedUserInternalId) === String(requestedUserId);
  
  if (authenticatedUserRole === 'customer' && !isOwnProfile) {
    // Customers can only view their own profiles
    console.warn(`[Backend GET /api/users/${requestedUserId}] Forbidden: Customer ${authenticatedUserDbId} attempted to access user ${requestedUserId}'s profile.`);
    return res.status(403).json({ message: 'Forbidden: Customers can only view their own profiles.' });
  }

  let connection;
  try {
    // Find the requested user's profile
    connection = await db.getConnection();
    const [users] = await connection.query(
      `SELECT user_id, name, email, role, avatar_url, referral_code, 
        phone_number, address, join_date, membership_tier  
      FROM Users WHERE user_id = ?`,
      [requestedUserId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // Return the user object to match frontend User type structure
    res.json({
      id: user.user_id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar_url,
      referralCode: user.referral_code, 
      phone_number: user.phone_number,
      address: user.address,
      joinDate: user.join_date ? user.join_date.toISOString().split('T')[0] : undefined,
      membershipTier: user.membership_tier
    });

  } catch (error) {
    console.error(`[Backend GET /api/users/${requestedUserId}] Error:`, error);
    res.status(500).json({ message: 'Error fetching user data', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Helper functions for image handling

// Helper function to delete unused images
async function deleteUnusedImage(imagePath) {
    // Skip deletion for null paths, default images, or paths that don't include 'uploads'
    if (!imagePath || imagePath.includes('default') || !imagePath.includes('uploads')) {
        console.log(`Skipping deletion for protected path: ${imagePath}`);
        return;
    }
    
    try {
        // Handle paths with or without leading slash
        const normalizedPath = imagePath.replace(/^\//, '');
        const fullPath = path.join(__dirname, '..', normalizedPath);
        
        // Check if file exists before attempting to delete
        try {
            await fs.access(fullPath);
        } catch (accessErr) {
            console.warn(`File not found, skipping deletion: ${fullPath}`);
            return;
        }
        
        // Delete the file
        await fs.unlink(fullPath);
        console.log(`Successfully deleted unused image: ${fullPath}`);
    } catch (err) {
        // Log but don't throw - we don't want image deletion failures to break the main operation
        console.error(`Error deleting image ${imagePath}:`, err);
    }
}

// Helper function to get URL for uploaded file
function getUploadedFileUrl(file) {
    // Return a path that will be accessible via the static file middleware
    // This works with how we're serving static files using app.use('/uploads', express.static(...))
    return `/uploads/${file.filename}`;
}

// Image upload endpoint
app.post('/api/upload/image', authenticateToken, (req, res, next) => {
    // Handle multer errors outside of the route handler
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
            }
            return res.status(400).json({ message: err.message || 'Error uploading file' });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const fileUrl = getUploadedFileUrl(req.file);
        res.json({ url: fileUrl });
    } catch (err) {
        console.error('Error uploading file:', err);
        res.status(500).json({ message: 'Error uploading file', error: err.message });
    }
});

// Update existing endpoints to handle image cleanup

// Update profile image endpoint
app.put('/api/users/:id', authenticateToken, (req, res, next) => {
    // Custom multer error handling
    upload.single('avatar')(req, res, (err) => {
        if (err) {
            console.error('Multer error in profile update:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'Avatar image too large. Maximum size is 5MB.' });
            }
            return res.status(400).json({ message: err.message || 'Error uploading avatar' });
        }
        next();
    });
}, async (req, res) => {
    const { id } = req.params;
    const updateData = { ...req.body }; // Clone to avoid modifying original request
    
    // Authorize - users can only update their own profiles unless they're managers
    if (req.user.role !== 'manager' && String(req.user.userId) !== String(id)) {
        return res.status(403).json({ 
            message: 'Forbidden: You can only update your own profile.' 
        });
    }
    
    try {
        // If new file uploaded, get its URL
        if (req.file) {
            updateData.avatar_url = getUploadedFileUrl(req.file);
        }

        // Get current user data to check for existing image
        const [currentUser] = await db.query('SELECT avatar_url FROM Users WHERE user_id = ?', [id]);
        
        if (currentUser.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Update user data
        const [updateResult] = await db.query('UPDATE Users SET ? WHERE user_id = ?', [updateData, id]);
        
        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found or no changes made' });
        }

        // If update successful and old image exists, delete it (but only if new image was uploaded)
        if (req.file && currentUser[0]?.avatar_url) {
            await deleteUnusedImage(currentUser[0].avatar_url);
        }

        // Fetch and return updated user data
        const [updatedUser] = await db.query('SELECT * FROM Users WHERE user_id = ?', [id]);
        res.json({ user: updatedUser[0] });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ message: 'Error updating user', error: err.message });
    }
});

// Note: The previous reward image update endpoint has been merged with the main reward update endpoint above

// Update category image endpoint
app.put('/api/categories/:id', authenticateToken, upload.single('image'), async (req, res) => {
    if (req.user.role !== 'manager') {
        return res.status(403).json({ message: 'Forbidden: Only managers can update categories.' });
    }

    const { id } = req.params;
    const updateData = req.body;

    try {
        // If new file uploaded, get its URL
        if (req.file) {
            updateData.image_url = getUploadedFileUrl(req.file);
        }

        // Get current category data to check for existing image
        const [currentCategory] = await db.query('SELECT image_url FROM Categories WHERE category_id = ?', [id]);

        // Update category data
        await db.query('UPDATE Categories SET ? WHERE category_id = ?', [updateData, id]);

        // If update successful and old image exists, delete it
        if (currentCategory[0]?.image_url) {
            await deleteUnusedImage(currentCategory[0].image_url);
        }

        // Fetch and return updated category data
        const [updatedCategory] = await db.query('SELECT * FROM Categories WHERE category_id = ?', [id]);
        res.json(updatedCategory[0]);
    } catch (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ message: 'Error updating category', error: err.message });
    }
});

// GET /api/rewards/available/:customerId - Get rewards available to a specific customer
app.get('/api/rewards/available/:customerId', authenticateToken, async (req, res) => {
  // Verify access: Either it's the user's own rewards or an employee/manager
  if (req.user.role !== 'manager' && 
      req.user.role !== 'employee' && 
      String(req.user.userId) !== String(req.params.customerId) &&
      String(req.user.internalId) !== String(req.params.customerId)) {
    return res.status(403).json({ message: 'Unauthorized to view these rewards' });
  }

  const customerId = req.params.customerId;
  let connection;

  try {
    connection = await db.getConnection();
    
    // 1. Get customer data for eligibility checks
    const [customerRows] = await connection.execute(
      'SELECT * FROM Users WHERE user_id = ? AND role = "customer"',
      [customerId]
    );
    
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    const customer = customerRows[0];
    
    // Get customer's claimed rewards
    const [claimedRewardsRows] = await connection.query(
      'SELECT reward_id FROM customer_claimed_rewards WHERE customer_id = ?',
      [customerId]
    );
    
    const claimedRewardIds = new Set(claimedRewardsRows.map(row => row.reward_id));
    console.log(`[GET /api/rewards/available/${customerId}] Customer has ${claimedRewardIds.size} claimed rewards`);
    
    // Get already redeemed rewards to filter them out
    const [redeemedRewardsRows] = await connection.execute(
      `SELECT DISTINCT ru.reward_id, ru.free_items_json
       FROM reward_usage ru
       JOIN orders o ON ru.order_id = o.order_id
       WHERE o.customer_id = ?`,
      [customerId]
    );
    
    // Extract voucher IDs from free_items_json for tracking redeemed vouchers
    const redeemedRewardIds = new Set(redeemedRewardsRows.map(row => row.reward_id));
    const redeemedVoucherIds = new Set();
    redeemedRewardsRows.forEach(row => {
      try {
        if (row.free_items_json) {
          const freeItems = JSON.parse(row.free_items_json);
          if (freeItems && freeItems.voucherId) {
            redeemedVoucherIds.add(freeItems.voucherId);
          }
        }
      } catch (err) {
        console.error("Error parsing free_items_json:", err);
      }
    });

    // Get the customer's points for points-based reward eligibility
    const customerPoints = customer.loyalty_points || 0;
    
    // Get the customer's tier for tier-based reward eligibility
    const customerTier = customer.membership_tier || null;
    
    // Get current date for date-based reward eligibility
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate();
    const currentDayOfWeek = today.getDay(); // 0-6 (Sunday-Saturday)
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`; // HH:MM
    
    // Get purchase counts for purchase-based reward eligibility
    const [purchaseCountResult] = await connection.execute(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE customer_id = ? 
       AND status = 'completed' 
       AND DATE_FORMAT(order_timestamp, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')`,
      [customerId]
    );
    
    const purchasesThisMonth = purchaseCountResult[0]?.count || 0;
    
    // Get total spend for spend-based reward eligibility
    const [totalSpendResult] = await connection.execute(
      `SELECT SUM(total_amount) as total_spend 
       FROM orders 
       WHERE customer_id = ? 
       AND status = 'completed'`,
      [customerId]
    );
    
    const lifetimeTotalSpend = totalSpendResult[0]?.total_spend || 0;
    
    // Get customer birthdate for birthday-based reward eligibility
    const customerBirthDate = customer.birth_date;
    let customerBirthMonth = null;
    let customerBirthDay = null;
    
    if (customerBirthDate) {
      const birthDate = new Date(customerBirthDate);
      customerBirthMonth = birthDate.getMonth() + 1; // 1-12
      customerBirthDay = birthDate.getDate();
    }
    
    // Get customer join date for new-signup reward eligibility
    const customerJoinDate = customer.join_date ? new Date(customer.join_date) : null;
    const joinDateStr = customerJoinDate ? customerJoinDate.toISOString().split('T')[0] : null;
    const isNewCustomer = joinDateStr && 
      ((new Date(todayStr).getTime() - new Date(joinDateStr).getTime()) / (1000 * 3600 * 24) <= 7); // Within 7 days
    
    // Get referral count for referral-based reward eligibility
    const referralsMade = customer.referrals_made || 0;
    
    // Now get all available rewards
    const [availableRewardsRows] = await connection.execute(
      `SELECT 
         r.reward_id, 
         r.name, 
         r.description, 
         r.image_url, 
         r.type, 
         r.points_cost, 
         r.criteria_json,
         r.earning_hint,
         r.discount_percentage,
         r.discount_fixed_amount,
         r.allow_multiple_claims,
         GROUP_CONCAT(rfmi.product_id) as free_menu_item_ids
       FROM rewards r
       LEFT JOIN reward_freemenuitems rfmi ON r.reward_id = rfmi.reward_id
       WHERE r.is_active = 1
       GROUP BY r.reward_id, r.name, r.description, r.image_url, r.type, r.points_cost, r.criteria_json, r.earning_hint, r.discount_percentage, r.discount_fixed_amount, r.allow_multiple_claims`
    );
    
    // Format rewards and check eligibility for each
    const formattedRewards = availableRewardsRows.map(reward => {
      // Skip rewards that have been redeemed and are not allowed multiple claims
      if (redeemedRewardIds.has(reward.reward_id) && reward.allow_multiple_claims !== 1 && reward.type !== 'voucher') {
        console.log(`Skipping already redeemed reward: ${reward.reward_id}`);
        return null;
      }
      
      // Skip rewards that are single-use and already claimed (except vouchers)
      if (reward.allow_multiple_claims !== 1 && 
          claimedRewardIds.has(reward.reward_id) && 
          reward.type !== 'voucher') {
        console.log(`Skipping already claimed reward: ${reward.reward_id}`);
        return null;
      }

      // Parse criteria if it exists
      let criteria = null;
      if (reward.criteria_json) {
        try {
          criteria = JSON.parse(reward.criteria_json);
        } catch (err) {
          console.error(`Error parsing criteria for reward ${reward.reward_id}:`, err);
          criteria = {};
        }
      } else {
        criteria = {};
      }

      // Parse free menu items if they exist
      const freeMenuItemIds = reward.free_menu_item_ids ? reward.free_menu_item_ids.split(',') : [];
      
      // Check if already claimed
      const isClaimed = claimedRewardIds.has(reward.reward_id);
      
      // Determine eligibility based on criteria
        let isEligible = true;
      let ineligibilityReason = '';
      
      // Only check eligibility if not already claimed
      if (!isClaimed) {
        // Points check
        if (criteria.minPoints && customerPoints < criteria.minPoints) {
          isEligible = false;
          ineligibilityReason = `Requires ${criteria.minPoints} points (you have ${customerPoints})`;
        }
        
        // Purchase count check
        if (isEligible && criteria.minPurchasesMonthly && purchasesThisMonth < criteria.minPurchasesMonthly) {
              isEligible = false;
          ineligibilityReason = `Requires ${criteria.minPurchasesMonthly} purchases this month (you have ${purchasesThisMonth})`;
            }
            
            // Birthday check
        if (isEligible && criteria.isBirthdayOnly && (customerBirthMonth !== currentMonth || customerBirthDay !== currentDay)) {
                isEligible = false;
                ineligibilityReason = "Only available on your birthday";
            }
            
            // Birth month check
        if (isEligible && criteria.isBirthMonthOnly && customerBirthMonth !== currentMonth) {
                isEligible = false;
                ineligibilityReason = "Only available during your birth month";
            }
            
            // Date range check
        if (isEligible && criteria.validDateRange) {
          if (criteria.validDateRange.startDate && todayStr < criteria.validDateRange.startDate) {
            isEligible = false;
            ineligibilityReason = `Available starting ${criteria.validDateRange.startDate}`;
          }
          if (isEligible && criteria.validDateRange.endDate && todayStr > criteria.validDateRange.endDate) {
            isEligible = false;
            ineligibilityReason = `Expired on ${criteria.validDateRange.endDate}`;
          }
        }
        
        // Membership tier check
        if (isEligible && criteria.requiredCustomerTier && criteria.requiredCustomerTier.length > 0) {
          if (!customerTier || !criteria.requiredCustomerTier.includes(customerTier)) {
                isEligible = false;
            ineligibilityReason = `Requires ${criteria.requiredCustomerTier.join(' or ')} tier`;
              }
        }
        
        // Referral check
        if (isEligible && criteria.minReferrals && referralsMade < criteria.minReferrals) {
                isEligible = false;
          ineligibilityReason = `Requires ${criteria.minReferrals} referrals (you have ${referralsMade})`;
        }
        
        // Sign-up bonus check
        if (isEligible && criteria.isSignUpBonus && !isNewCustomer) {
          isEligible = false;
          ineligibilityReason = "Only for new customers";
        }
        
        // Time window check
        if (isEligible && criteria.activeTimeWindows && criteria.activeTimeWindows.length > 0) {
          const isInTimeWindow = criteria.activeTimeWindows.some(window => {
            const isDayValid = !window.daysOfWeek || window.daysOfWeek.includes(currentDayOfWeek);
            const isTimeValid = currentTime >= window.startTime && currentTime <= window.endTime;
            return isDayValid && isTimeValid;
          });
          
          if (!isInTimeWindow) {
            isEligible = false;
            ineligibilityReason = "Only available during specific times/days";
          }
        }
        
        // Cumulative spend check
        if (isEligible && criteria.cumulativeSpendTotal && lifetimeTotalSpend < criteria.cumulativeSpendTotal) {
          isEligible = false;
          ineligibilityReason = `Requires total spend of $${criteria.cumulativeSpendTotal.toFixed(2)} (you have $${lifetimeTotalSpend.toFixed(2)})`;
        }
      }
      
      // Return formatted reward with eligibility info
        return {
        id: reward.reward_id,
          name: reward.name,
          description: reward.description,
        image: reward.image_url,
          type: reward.type,
        pointsCost: reward.points_cost,
        discountPercentage: reward.discount_percentage,
        discountFixedAmount: reward.discount_fixed_amount,
        freeMenuItemIds,
        isClaimed,
        isEligible,
        ineligibilityReason,
        earningHint: reward.earning_hint,
        allowMultipleClaims: reward.allow_multiple_claims === 1
      };
    }).filter(reward => reward !== null); // Filter out null entries (rewards that were skipped)
    
    // Filter rewards based on eligibility and claim status
    // For staff users (managers/employees), show all rewards to allow them to see what's available
    // For customers, filter to only show eligible or claimed rewards
    const isStaffUser = req.user.role === 'manager' || req.user.role === 'employee';
    
    const filteredRewards = formattedRewards.filter(reward => {
      // Staff can see all rewards
      if (isStaffUser) return true;
      
      // Always include claimed rewards
      if (reward.isClaimed) return true;
      
      // For unclaimed rewards, only include them if they're eligible
      return reward.isEligible;
    });
    
    console.log(`[GET /api/rewards/available/${customerId}] Returning ${filteredRewards.length} rewards: ${filteredRewards.map(r => r.name).join(', ')}`);
    res.json(filteredRewards);
    
  } catch (error) {
    console.error(`Error fetching available rewards for customer ${customerId}:`, error);
    res.status(500).json({ message: 'Error fetching available rewards', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/rewards/available - Get all available rewards for a customer
app.get('/api/rewards/available', authenticateToken, async (req, res) => {
  // First try to get customer ID from internalId, then fall back to userId
  const customerId = req.user.internalId || String(req.user.userId);
  if (!customerId) {
    // This should ideally be caught by authenticateToken if userId is essential
    return res.status(400).json({ message: "Customer ID not found in token." });
  }
  console.log(`[GET /api/rewards/claimed-only] Using customer ID: ${customerId}`);

  let connection;
  try {
    connection = await db.getConnection();

    // First check if this is a customer
    const [customerRows] = await connection.execute(
      'SELECT * FROM Users WHERE user_id = ? AND role = "customer"',
      [customerId]
    );
    
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Get redeemed rewards to filter them out
      const [redeemedRewardsRows] = await connection.execute(
        `SELECT DISTINCT ru.reward_id 
         FROM reward_usage ru
         JOIN orders o ON ru.order_id = o.order_id
       WHERE o.customer_id = ?`,
        [customerId]
      );
      
    const redeemedRewardIds = new Set(redeemedRewardsRows.map(row => row.reward_id));
    
    // Initialize rewards array
    const claimedRewards = [];
    
    // 1. Get explicitly claimed rewards (from customer_claimed_rewards)
    const [claimedRewardsRows] = await connection.execute(
      `SELECT ccr.reward_id, r.name, r.description, r.image_url, r.type,
              r.discount_percentage, r.discount_fixed_amount, r.criteria_json
       FROM customer_claimed_rewards ccr
       JOIN rewards r ON ccr.reward_id = r.reward_id
       WHERE ccr.customer_id = ? AND ccr.redeemed_date IS NULL`,
      [customerId]
    );
    
    // Process claimed rewards
    for (const reward of claimedRewardsRows) {
      // Skip redeemed rewards
      if (redeemedRewardIds.has(reward.reward_id)) {
        continue;
      }
      
      // Get free menu items
      let freeMenuItemIds = [];
      try {
        const [menuItems] = await connection.execute(
          `SELECT product_id FROM reward_freemenuitems WHERE reward_id = ?`,
          [reward.reward_id]
        );
        freeMenuItemIds = menuItems.map(item => item.product_id);
      } catch (e) {
        console.error('Error fetching free menu items:', e);
      }

      // Add to claimed rewards
      claimedRewards.push({
            id: reward.reward_id,
            name: `${reward.name} (Available)`,
            description: reward.description || '',
            image: reward.image_url || '',
        type: reward.type,
        discountPercentage: reward.discount_percentage ? parseFloat(reward.discount_percentage) : undefined,
        discountFixedAmount: reward.discount_fixed_amount ? parseFloat(reward.discount_fixed_amount) : undefined,
            freeMenuItemIds: freeMenuItemIds,
            isVoucher: false,
        isClaimed: true,
        isEligible: true
      });
    }
    
    // 2. Get active vouchers
    const now = new Date();
    const [vouchersRows] = await connection.execute(
      `SELECT cv.voucher_instance_id, cv.reward_id, cv.name_snapshot as name, 
              cv.description_snapshot as description, r.image_url, r.type,
              r.discount_percentage, r.discount_fixed_amount, cv.expiry_date
         FROM customervouchers cv
         JOIN rewards r ON cv.reward_id = r.reward_id 
         WHERE cv.user_id = ? AND cv.status = 'active'`,
        [customerId]
      );
    
    // Process vouchers
    for (const voucher of vouchersRows) {
      // Skip expired vouchers
      const expiryDate = voucher.expiry_date ? new Date(voucher.expiry_date) : null;
      if (expiryDate && expiryDate < now) {
        console.log(`[GET /api/rewards/claimed-only] Skipping expired voucher: ${voucher.voucher_instance_id}`);
        continue;
      }
      
      // Get free menu items
      let freeMenuItemIds = [];
      try {
        const [menuItems] = await connection.execute(
          `SELECT product_id FROM reward_freemenuitems WHERE reward_id = ?`,
          [voucher.reward_id]
        );
        freeMenuItemIds = menuItems.map(item => item.product_id);
      } catch (e) {
        console.error('Error fetching free menu items for voucher:', e);
      }

      // Format date
      const expiryFormatted = expiryDate ? 
        `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}-${String(expiryDate.getDate()).padStart(2, '0')}` : 
        'No expiry';
      
      // Add voucher to rewards
      claimedRewards.push({
        id: voucher.reward_id,
        voucherId: voucher.voucher_instance_id,
        name: `${voucher.name} (Voucher)`,
        description: `${voucher.description || ''} (Expires: ${expiryFormatted})`,
        image: voucher.image_url || '',
        type: voucher.type,
        discountPercentage: voucher.discount_percentage ? parseFloat(voucher.discount_percentage) : undefined,
        discountFixedAmount: voucher.discount_fixed_amount ? parseFloat(voucher.discount_fixed_amount) : undefined,
        freeMenuItemIds: freeMenuItemIds,
        isVoucher: true,
        isClaimed: true,
        isEligible: true,
        expiryDate: expiryFormatted
      });
    }

    console.log(`[GET /api/rewards/claimed-only] Returning ${claimedRewards.length} claimed rewards/vouchers`);
    res.json(claimedRewards);
    
  } catch (error) {
    console.error('Error fetching claimed rewards:', error);
    res.status(500).json({ message: 'Error fetching claimed rewards', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// --- Middleware to fix rewards display in Menu ---
// NOTE: Middleware removed since we now have a proper /api/rewards/claimed-only endpoint

// POST /api/rewards/verify-claimed - Verify if rewards have been claimed or redeemed
app.post('/api/rewards/verify-claimed', authenticateToken, async (req, res) => {
  const { rewardIds } = req.body;
  if (!rewardIds || !Array.isArray(rewardIds) || rewardIds.length === 0) {
    return res.status(400).json({ message: 'Invalid request - rewardIds must be a non-empty array' });
  }
  
  const customerId = req.user.internalId || String(req.user.userId);
  if (!customerId) {
    return res.status(400).json({ message: "Customer ID not found in token." });
  }
  
  let connection;
  
  try {
    connection = await db.getConnection();
    
    // Check customer existence
    const [customerRows] = await connection.execute(
      'SELECT * FROM Users WHERE user_id = ? AND role = "customer"',
      [customerId]
    );

    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get claimed rewards
    const placeholders = rewardIds.map(() => '?').join(',');
    const [claimedRows] = await connection.execute(
      `SELECT reward_id FROM customer_claimed_rewards 
       WHERE customer_id = ? AND reward_id IN (${placeholders})`,
      [customerId, ...rewardIds]
    );
    
    // Get rewards that have been used in orders
    const [redeemedRows] = await connection.execute(
      `SELECT DISTINCT ru.reward_id 
       FROM reward_usage ru
       JOIN orders o ON ru.order_id = o.order_id
       WHERE o.customer_id = ? AND ru.reward_id IN (${placeholders})`,
      [customerId, ...rewardIds]
    );
    
    // Create sets for easy lookup
    const claimedRewardIds = new Set(claimedRows.map(row => row.reward_id));
    const redeemedRewardIds = new Set(redeemedRows.map(row => row.reward_id));
    
    // Return the status of each reward
    const result = rewardIds.map(rewardId => ({
      rewardId,
      isClaimed: claimedRewardIds.has(rewardId),
      isRedeemed: redeemedRewardIds.has(rewardId)
    }));
    
    res.json({ rewards: result });
  } catch (error) {
    console.error('Error verifying claimed rewards:', error);
    res.status(500).json({ message: 'Error verifying claimed rewards', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Add the /api/rewards/claimed-only endpoint right before the middleware
// GET /api/rewards/claimed-only - Get rewards that a customer has already claimed
app.get('/api/rewards/claimed-only', authenticateToken, async (req, res) => {
  // First try to get customer ID from internalId, then fall back to userId
  const customerId = req.user.internalId || String(req.user.userId);
  if (!customerId) {
    // This should ideally be caught by authenticateToken if userId is essential
    return res.status(400).json({ message: "Customer ID not found in token." });
  }
  console.log(`[GET /api/rewards/claimed-only] Using customer ID: ${customerId}`);

  let connection;
  try {
    connection = await db.getConnection();

    // First check if this is a customer
    const [customerRows] = await connection.execute(
      'SELECT * FROM Users WHERE user_id = ? AND role = "customer"',
      [customerId]
    );
    
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Get redeemed rewards to filter them out
    const [redeemedRewardsRows] = await connection.execute(
      `SELECT DISTINCT ru.reward_id 
       FROM reward_usage ru
       JOIN orders o ON ru.order_id = o.order_id
       WHERE o.customer_id = ?`,
      [customerId]
    );
      
    const redeemedRewardIds = new Set(redeemedRewardsRows.map(row => row.reward_id));
    
    // Initialize rewards array
    const claimedRewards = [];
    
    // 1. Get explicitly claimed rewards (from customer_claimed_rewards)
    const [claimedRewardsRows] = await connection.execute(
      `SELECT ccr.reward_id, r.name, r.description, r.image_url, r.type,
              r.discount_percentage, r.discount_fixed_amount, r.criteria_json
       FROM customer_claimed_rewards ccr
       JOIN rewards r ON ccr.reward_id = r.reward_id
       WHERE ccr.customer_id = ? AND ccr.redeemed_date IS NULL`,
      [customerId]
    );
    
    // Process claimed rewards
    for (const reward of claimedRewardsRows) {
      // Skip redeemed rewards
      if (redeemedRewardIds.has(reward.reward_id)) {
        continue;
      }
      
      // Get free menu items
      let freeMenuItemIds = [];
      try {
        const [menuItems] = await connection.execute(
          `SELECT product_id FROM reward_freemenuitems WHERE reward_id = ?`,
          [reward.reward_id]
        );
        freeMenuItemIds = menuItems.map(item => item.product_id);
      } catch (e) {
        console.error('Error fetching free menu items:', e);
      }

      // Add to claimed rewards
      claimedRewards.push({
        id: reward.reward_id,
        name: `${reward.name} (Available)`,
        description: reward.description || '',
        image: reward.image_url || '',
        type: reward.type,
        discountPercentage: reward.discount_percentage ? parseFloat(reward.discount_percentage) : undefined,
        discountFixedAmount: reward.discount_fixed_amount ? parseFloat(reward.discount_fixed_amount) : undefined,
        freeMenuItemIds: freeMenuItemIds,
        isVoucher: false,
        isClaimed: true,
        isEligible: true
      });
    }
    
    // 2. Get active vouchers
    const now = new Date();
    const [vouchersRows] = await connection.execute(
      `SELECT cv.voucher_instance_id, cv.reward_id, cv.name_snapshot as name, 
              cv.description_snapshot as description, r.image_url, r.type,
              r.discount_percentage, r.discount_fixed_amount, cv.expiry_date
       FROM customervouchers cv
       JOIN rewards r ON cv.reward_id = r.reward_id 
       WHERE cv.user_id = ? AND cv.status = 'active'`,
      [customerId]
    );
    
    // Process vouchers
    for (const voucher of vouchersRows) {
      // Skip expired vouchers
      const expiryDate = voucher.expiry_date ? new Date(voucher.expiry_date) : null;
      if (expiryDate && expiryDate < now) {
        console.log(`[GET /api/rewards/claimed-only] Skipping expired voucher: ${voucher.voucher_instance_id}`);
        continue;
      }
      
      // Get free menu items
      let freeMenuItemIds = [];
      try {
        const [menuItems] = await connection.execute(
          `SELECT product_id FROM reward_freemenuitems WHERE reward_id = ?`,
          [voucher.reward_id]
        );
        freeMenuItemIds = menuItems.map(item => item.product_id);
      } catch (e) {
        console.error('Error fetching free menu items for voucher:', e);
      }

      // Format date
      const expiryFormatted = expiryDate ? 
        `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}-${String(expiryDate.getDate()).padStart(2, '0')}` : 
        'No expiry';
      
      // Add voucher to rewards
      claimedRewards.push({
        id: voucher.reward_id,
        name: `${voucher.name} (Voucher)`,
        description: `${voucher.description || ''} (Expires: ${expiryFormatted})`,
        image: voucher.image_url || '',
        type: voucher.type,
        discountPercentage: voucher.discount_percentage ? parseFloat(voucher.discount_percentage) : undefined,
        discountFixedAmount: voucher.discount_fixed_amount ? parseFloat(voucher.discount_fixed_amount) : undefined,
        freeMenuItemIds: freeMenuItemIds,
        isVoucher: true,
        instanceId: voucher.voucher_instance_id,
        isClaimed: true,
        isEligible: true,
        expiryDate: expiryFormatted
      });
    }

    console.log(`[GET /api/rewards/claimed-only] Customer has ${claimedRewards.length} claimed rewards`);
    res.json(claimedRewards);
    
  } catch (error) {
    console.error('Error fetching claimed rewards:', error);
    res.status(500).json({ message: 'Error fetching claimed rewards', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// POST /api/orders/checkout - Process an order and return order details
app.post('/api/orders/checkout', authenticateToken, async (req, res) => {
  const { customerName, items, redeemedRewards, userId } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'No items in order' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Generate a random order ID - could also use UUID
    const orderId = 'ORD' + Date.now().toString() + Math.floor(Math.random() * 1000).toString();
    
    // Generate ticket number (simple incremental)
    const [lastOrderResult] = await connection.execute(
      'SELECT MAX(CAST(SUBSTRING(ticket_number, 2) AS UNSIGNED)) as last_number FROM orders WHERE DATE(created_at) = CURDATE()'
    );
    
    const lastNumber = lastOrderResult[0]?.last_number || 0;
    const ticketNumber = 'T' + (parseInt(lastNumber) + 1).toString().padStart(3, '0');
    
    // Calculate order total
    let orderTotal = 0;
    let orderDiscount = 0;
    
    // Process any discounts from redeemed rewards
    if (redeemedRewards && Array.isArray(redeemedRewards)) {
      for (const reward of redeemedRewards) {
        if (reward.appliedDiscount) {
          if (reward.appliedDiscount.type === 'percentage' && reward.appliedDiscount.value) {
            orderDiscount += (reward.appliedDiscount.originalTotal * (reward.appliedDiscount.value / 100));
          } else if (reward.appliedDiscount.type === 'fixed' && reward.appliedDiscount.value) {
            orderDiscount += reward.appliedDiscount.value;
          }
        }
      }
    }
    
    // Calculate total from regular items
    for (const item of items) {
      if (!item.isRewardItem) { // Only count non-reward items for total
        orderTotal += (item.unitPriceSnapshot * item.quantity);
      }
    }
    
    // Apply discount (never more than the order total)
    const finalDiscount = Math.min(orderDiscount, orderTotal);
    const finalTotal = Math.max(orderTotal - finalDiscount, 0);
    
    // Determine customer ID
    let customerId = null;
    if (userId) {
      customerId = userId;
    } else {
      // For guest orders, we don't have a customer ID
      // Could optionally create a guest customer record here
    }
    
    // Insert order into database
    const [orderResult] = await connection.execute(
      `INSERT INTO orders 
       (order_id, customer_id, customer_name_snapshot, total_amount, discount_amount, original_amount, status, ticket_number, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [orderId, customerId, customerName, finalTotal, finalDiscount, orderTotal, 'pending', ticketNumber]
    );
    
    // Insert order items
    for (const item of items) {
      // Convert selectedOptionsSnapshot from array of objects to JSON string
      const optionsJson = JSON.stringify(item.selectedOptionsSnapshot || []);
      // Calculate total line price
      const totalLinePrice = item.unitPriceSnapshot * item.quantity;
      
      // Insert order line item
      const [orderLineItemResult] = await connection.execute(
        `INSERT INTO orderlineitems 
         (order_id, product_id, product_name_snapshot, quantity, unit_price_snapshot, total_line_price, is_reward_item, reward_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId, 
          item.productId, 
          item.name, 
          item.quantity, 
          item.unitPriceSnapshot, 
          totalLinePrice,
          item.isRewardItem ? 1 : 0,
          item.rewardId || null
        ]
      );
      
      // Get the inserted order line item ID
      const orderLineItemId = orderLineItemResult.insertId;
      
      // Insert selected options if any
      if (item.selectedOptionsSnapshot && item.selectedOptionsSnapshot.length > 0) {
        for (const option of item.selectedOptionsSnapshot) {
          await connection.execute(
            `INSERT INTO orderlineitem_selectedoptions 
             (order_line_item_id, option_id, selected_option_label_snapshot, price_modifier_snapshot) 
             VALUES (?, ?, ?, ?)`,
            [
              orderLineItemId,
              option.option || option.optionId || null, // Use either option or optionId depending on your data structure
              option.group ? `${option.group}: ${option.option}` : option.option, // Format as "group: option" if group exists
              option.priceModifier || 0
            ]
          );
        }
      }
    }
    
    // Process redeemed rewards
    if (redeemedRewards && Array.isArray(redeemedRewards) && redeemedRewards.length > 0) {
      // Insert into order_rewards table for batch processing
      const orderRewardsValues = redeemedRewards.map(reward => {
        // Handle either freeItems or freeMenuItemIds
        const freeItems = reward.freeItems || reward.freeMenuItemIds || [];
        
        return [
          orderId,
          reward.rewardId,
          reward.voucherId || null,
          reward.appliedDiscount ? (reward.appliedDiscount.type === 'percentage' ? 
            (reward.appliedDiscount.originalTotal * (reward.appliedDiscount.value / 100)) : 
            reward.appliedDiscount.value) : 0,
          freeItems.length > 0 ? JSON.stringify(freeItems) : null
        ];
      });
      
      if (orderRewardsValues.length > 0) {
        await connection.query(
          `INSERT INTO order_rewards 
           (order_id, reward_id, voucher_id, discount_amount, free_items_json) 
           VALUES ?`,
          [orderRewardsValues]
        );
      }
      
      // Process each reward individually
      for (const reward of redeemedRewards) {
        // Handle either freeItems or freeMenuItemIds
        const freeItems = reward.freeItems || reward.freeMenuItemIds || [];
        const usageType = reward.appliedDiscount ? 'discount' : 
                         (freeItems.length > 0 ? 'free_items' : 'other');
        
        // Record reward usage
        await connection.execute(
          `INSERT INTO reward_usage 
           (reward_id, order_id, user_id, usage_type, discount_amount, free_items_json) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            reward.rewardId,
            orderId,
            customerId,
            usageType,
            reward.appliedDiscount ? (reward.appliedDiscount.type === 'percentage' ? reward.appliedDiscount.value : reward.appliedDiscount.value) : 0,
            reward.voucherId ? JSON.stringify({ voucherId: reward.voucherId, freeItems: freeItems }) : 
              (freeItems.length > 0 ? JSON.stringify(freeItems) : null)
          ]
        );
        
        // If this is a voucher, mark it as redeemed
        if (reward.voucherId) {
          await connection.execute(
            `UPDATE customervouchers SET status = 'redeemed', claimed_date = NOW() 
             WHERE voucher_instance_id = ?`,
            [reward.voucherId]
          );
        }
        
        // If this is a regular reward, mark it as redeemed in customer_claimed_rewards
        if (!reward.voucherId && customerId) {
          await connection.execute(
            `UPDATE customer_claimed_rewards 
             SET redeemed_date = NOW() 
             WHERE customer_id = ? AND reward_id = ? AND redeemed_date IS NULL 
             LIMIT 1`,
            [customerId, reward.rewardId]
          );
        }
      }
    }
    
    // Commit the transaction
    await connection.commit();
    
    // Check if order needs manager approval (e.g., for orders over $50)
    const needsApproval = finalTotal >= 50; // Example threshold
    
    let responseData = {
      message: 'Order placed successfully',
      orderId: orderId,
      ticketNumber: ticketNumber,
      timestamp: new Date().toISOString(),
      total: finalTotal,
      discount: finalDiscount,
      items: items.length,
      status: 'pending'
    };
    
    // If order needs approval, generate an approval URL
    if (needsApproval && req.user.role !== 'manager') {
      // In a real application, you would generate a secure token
      // and store it in the database, associated with this order
      const approvalToken = crypto.randomBytes(16).toString('hex');
      
      // Store the approval token in the database
      await db.query(
        'INSERT INTO order_approvals (order_id, approval_token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
        [orderId, approvalToken]
      );
      
      // Generate an approval URL
      const approvalUrl = `http://localhost:3000/approve?type=checkout&token=${approvalToken}&orderId=${orderId}`;
      
      // Add the approval URL to the response
      responseData.approvalUrl = approvalUrl;
      responseData.needsApproval = true;
    }
    
    // Respond with order details
    res.status(201).json(responseData);
    
  } catch (error) {
    // Rollback in case of error
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }
    }
    
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Error creating order', error: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// POST /api/orders/approve-checkout - Approve a pending order
app.post('/api/orders/approve-checkout', async (req, res) => {
  const { orderId } = req.body;
  
  if (!orderId) {
    return res.status(400).json({ message: 'Order ID is required' });
  }
  
  let connection;
  try {
    connection = await db.getConnection();
    
    // Update order status to approved
    const [result] = await connection.execute(
      `UPDATE orders SET status = 'approved', updated_at = NOW() WHERE order_id = ?`,
      [orderId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Return success response
    res.status(200).json({ 
      message: 'Order approved successfully',
      orderId
    });
    
  } catch (error) {
    console.error('Error approving order:', error);
    res.status(500).json({ message: 'Error approving order', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// POST /api/orders/reject-checkout - Reject a pending order
app.post('/api/orders/reject-checkout', async (req, res) => {
  const { orderId } = req.body;
  
  if (!orderId) {
    return res.status(400).json({ message: 'Order ID is required' });
  }
  
  let connection;
  try {
    connection = await db.getConnection();
    
    // Update order status to rejected
    const [result] = await connection.execute(
      `UPDATE orders SET status = 'rejected', updated_at = NOW() WHERE order_id = ?`,
      [orderId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Return success response
    res.status(200).json({ 
      message: 'Order rejected successfully',
      orderId
    });
    
  } catch (error) {
    console.error('Error rejecting order:', error);
    res.status(500).json({ message: 'Error rejecting order', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Create necessary tables if they don't exist
(async () => {
  try {
    const connection = await db.getConnection();
    
    // Create PasswordResetTokens table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS PasswordResetTokens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
      )
    `);
    
    // Create UserSettings table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usersettings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        settings_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
      )
    `);
    
    // Create OrderApprovals table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_approvals (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id VARCHAR(255) NOT NULL,
        approval_token VARCHAR(255) NOT NULL,
        approved BOOLEAN DEFAULT FALSE,
        approved_by INT NULL,
        approval_date DATETIME NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (approval_token),
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )
    `);
    
    console.log('Database tables checked/created successfully');
    connection.release();
  } catch (error) {
    console.error('Error setting up database tables:', error);
  }
})();

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// UPDATE existing user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  // Existing code...
});

// GET /api/users/:userId/settings - Get user settings
app.get('/api/users/:userId/settings', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  
  // Authorization check: User can only access their own settings, unless they are a manager
  if (req.user.userId != userId && req.user.role !== 'manager') {
    return res.status(403).json({ 
      message: 'Forbidden: You can only access your own settings.' 
    });
  }
  
  try {
    // Get user settings from database
    const [settings] = await db.query('SELECT settings_json FROM usersettings WHERE user_id = ?', [userId]);
    
    if (settings.length === 0) {
      // If no settings found, return default settings
      return res.json({
        autoSave: false,
        theme: 'light',
        profileBanner: {
          type: 'color',
          value: '#a7f3d0',
        }
      });
    }
    
    // Parse settings JSON and return
    const userSettings = safeJsonParse(settings[0].settings_json);
    res.json(userSettings);
  } catch (error) {
    console.error(`Error fetching settings for user ${userId}:`, error);
    res.status(500).json({ message: 'Error fetching user settings', error: error.message });
  }
});

// PUT /api/users/:userId/settings - Update user settings
app.put('/api/users/:userId/settings', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const newSettings = req.body;
  
  // Authorization check: User can only update their own settings, unless they are a manager
  if (req.user.userId != userId && req.user.role !== 'manager') {
    return res.status(403).json({ 
      message: 'Forbidden: You can only update your own settings.' 
    });
  }
  
  try {
    // Check if settings exist for user
    const [existingSettings] = await db.query('SELECT settings_json FROM usersettings WHERE user_id = ?', [userId]);
    
    const settingsJson = JSON.stringify(newSettings);
    
    if (existingSettings.length === 0) {
      // Insert new settings
      await db.query('INSERT INTO usersettings (user_id, settings_json) VALUES (?, ?)', [userId, settingsJson]);
    } else {
      // Update existing settings
      await db.query('UPDATE usersettings SET settings_json = ? WHERE user_id = ?', [settingsJson, userId]);
    }
    
    res.json({ message: 'Settings updated successfully', settings: newSettings });
  } catch (error) {
    console.error(`Error updating settings for user ${userId}:`, error);
    res.status(500).json({ message: 'Error updating user settings', error: error.message });
  }
});

// PUT /api/users/:userId/password - Change user password
app.put('/api/users/:userId/password', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;
  
  // Check if user is authenticated and has permission to change this password
  if (req.user.userId != userId && req.user.role !== 'manager') {
    return res.status(403).json({ 
      message: 'Forbidden: You can only change your own password unless you are a manager.' 
    });
  }
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }
  
  try {
    // 1. Get the user's current password hash
    const [users] = await db.query('SELECT password_hash FROM Users WHERE user_id = ?', [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = users[0];
    
    // 2. Verify current password is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // 3. Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // 4. Update the password in the database
    await db.query('UPDATE Users SET password_hash = ? WHERE user_id = ?', [hashedPassword, userId]);
    
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Error updating password', error: error.message });
  }
});

// --- Test Approval Endpoints ---

// Store pending approvals in memory (would use DB in production)
const pendingApprovals = {
  passwordResets: new Map(),
  checkouts: new Map()
};

// Request password reset (modified to be simpler)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  
  try {
    // Check if user exists
    const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'No user found with this email address' });
    }
    
    // Generate a reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 1); // Token valid for 1 hour
    
    // Store the token in the pending approvals
    pendingApprovals.passwordResets.set(token, {
      email,
      token,
      expiryTime,
      isApproved: false,
      isRejected: false
    });
    
    // Create approval request data
    const approvalData = {
      type: 'password_reset',
      data: { email, token }
    };
    
    // Create approval URL
    const approvalUrl = `http://localhost:5173/test-approval?data=${encodeURIComponent(JSON.stringify(approvalData))}`;
    
    res.status(200).json({ 
      message: 'Password reset requested.',
      approvalUrl
    });
    
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reset password (simplified to not require approval)
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, email, newPassword } = req.body;
  
  if (!token || !email || !newPassword) {
    return res.status(400).json({ message: 'Token, email, and new password are required' });
  }
  
  try {
    // Check if the reset request exists
    const resetRequest = pendingApprovals.passwordResets.get(token);
    
    if (!resetRequest) {
      return res.status(404).json({ message: 'Password reset request not found' });
    }
    
    if (resetRequest.email !== email) {
      return res.status(400).json({ message: 'Email does not match the reset request' });
    }
    
    if (resetRequest.expiryTime < new Date()) {
      pendingApprovals.passwordResets.delete(token);
      return res.status(400).json({ message: 'Reset token has expired' });
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the user's password in the database
    await db.query('UPDATE Users SET password_hash = ? WHERE email = ?', [hashedPassword, email]);
    
    // Delete the reset request
    pendingApprovals.passwordResets.delete(token);
    
    res.status(200).json({ message: 'Password has been reset successfully' });
    
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Approve password reset
app.post('/api/auth/approve-password-reset', async (req, res) => {
  const { token, email } = req.body;
  
  if (!token || !email) {
    return res.status(400).json({ message: 'Token and email are required' });
  }
  
  try {
    // Check if the reset request exists
    const resetRequest = pendingApprovals.passwordResets.get(token);
    
    if (!resetRequest) {
      return res.status(404).json({ message: 'Password reset request not found' });
    }
    
    if (resetRequest.email !== email) {
      return res.status(400).json({ message: 'Email does not match the reset request' });
    }
    
    if (resetRequest.expiryTime < new Date()) {
      pendingApprovals.passwordResets.delete(token);
      return res.status(400).json({ message: 'Reset token has expired' });
    }
    
    // Mark as approved
    resetRequest.isApproved = true;
    pendingApprovals.passwordResets.set(token, resetRequest);
    
    res.status(200).json({ message: 'Password reset approved' });
    
  } catch (error) {
    console.error('Password reset approval error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reject password reset
app.post('/api/auth/reject-password-reset', async (req, res) => {
  const { token, email } = req.body;
  
  if (!token || !email) {
    return res.status(400).json({ message: 'Token and email are required' });
  }
  
  try {
    // Check if the reset request exists
    const resetRequest = pendingApprovals.passwordResets.get(token);
    
    if (!resetRequest) {
      return res.status(404).json({ message: 'Password reset request not found' });
    }
    
    if (resetRequest.email !== email) {
      return res.status(400).json({ message: 'Email does not match the reset request' });
    }
    
    // Delete the reset request
    pendingApprovals.passwordResets.delete(token);
    
    res.status(200).json({ message: 'Password reset rejected' });
    
  } catch (error) {
    console.error('Password reset rejection error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Request checkout approval (modified from existing checkout endpoint)
app.post('/api/orders/checkout', authenticateToken, async (req, res) => {
  let connection;
  try {
    const orderData = req.body;
    
    // Validate order data
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      return res.status(400).json({ message: 'Invalid order data' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Generate order ID and ticket number
    const orderId = uuidv4();
    const ticketNumber = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Calculate order total
    let orderTotal = 0;
    let itemsToProcess = [];
    
    // First, fetch all products and calculate prices
    for (const item of orderData.items) {
      // Fetch product details from the database to verify pricing
      const [productRows] = await connection.execute(
        'SELECT product_id, name, base_price, availability FROM products WHERE product_id = ?',
        [item.productId]
      );
      
      if (productRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
      }
      
      const product = productRows[0];
      
      // Check if product is available
      if (product.availability === 'unavailable') {
        await connection.rollback();
        return res.status(400).json({ message: `Product "${product.name}" is currently unavailable.` });
      }
      
      // Calculate item price (base price + options)
      let itemPrice = parseFloat(product.base_price);
      let selectedOptions = [];
      
      // Process options if any
      if (item.selectedOptionIds && Object.keys(item.selectedOptionIds).length > 0) {
        for (const [categoryId, optionIds] of Object.entries(item.selectedOptionIds)) {
          if (!optionIds) continue;
          
          const optionIdArray = Array.isArray(optionIds) ? optionIds : [optionIds];
          
          for (const optionId of optionIdArray) {
            if (!optionId) continue;
            
            // Fetch option price modifier
            const [optionRows] = await connection.execute(
              'SELECT option_id, label, price_modifier FROM options WHERE option_id = ?',
              [optionId]
            );
            
            if (optionRows.length > 0) {
              selectedOptions.push(optionRows[0]);
              if (optionRows[0].price_modifier) {
                itemPrice += parseFloat(optionRows[0].price_modifier);
              }
            }
          }
        }
      }
      
      // Set the price to 0 if this is a reward free item
      if (item.isRewardItem && item.rewardId) {
        itemPrice = 0;
      } else {
        // Add to order total (price * quantity)
        orderTotal += itemPrice * item.quantity;
      }
      
      // Store item data for later processing
      itemsToProcess.push({
        item,
        product,
        itemPrice,
        selectedOptions
      });
    }

    // Process rewards if any
    let discountTotal = 0;
    if (orderData.redeemedRewards && Array.isArray(orderData.redeemedRewards) && orderData.redeemedRewards.length > 0) {
      for (const reward of orderData.redeemedRewards) {
        if (reward.appliedDiscount) {
          if (reward.appliedDiscount.type === 'percentage') {
            discountTotal += (orderTotal * (reward.appliedDiscount.value / 100));
          } else if (reward.appliedDiscount.type === 'fixed') {
            discountTotal += reward.appliedDiscount.value;
          }
        }
      }
    }

    // Apply discount cap to ensure we don't go negative
    discountTotal = Math.min(discountTotal, orderTotal);
    const finalTotal = Math.max(0, orderTotal - discountTotal);

    // Ensure all parameters for order creation are valid
    const customerId = req.user && req.user.role === 'customer' 
        ? (req.user.internalId || req.user.userId || null) 
        : null;
    
    console.log(`[/api/orders/checkout] Setting customer_id: ${customerId}, from req.user:`, req.user);
    
    const customerName = orderData.customerName || 'Guest';
    
    if (!orderId || typeof orderId !== 'string') {
      throw new Error('Invalid order ID');
    }
    
    if (!ticketNumber || typeof ticketNumber !== 'string') {
      throw new Error('Invalid ticket number');
    }

    // Create the order in pending state
    try {
      await connection.execute(
        'INSERT INTO orders (order_id, customer_id, customer_name_snapshot, total_amount, status, ticket_number, discount_amount, original_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          orderId, 
          customerId, // Validated customer ID
          customerName, // Validated customer name
          finalTotal, 
          'pending', 
          ticketNumber,
          discountTotal,
          orderTotal
        ]
      );
    } catch (err) {
      console.error('Error inserting order:', err);
      throw err; // Re-throw to trigger rollback
    }

    // Insert line items
    for (const { item, product, itemPrice, selectedOptions } of itemsToProcess) {
      // Skip items with missing required fields
      if (!item || !item.productId || !item.name) {
        console.warn('Skipping item with missing required fields:', item);
        continue;
      }
      
      // Ensure quantity is a valid number
      const quantity = typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 1;
      
      try {
        // For reward items, validate that the reward_id exists to prevent foreign key errors
        let rewardIdToUse = null;
        if (item.isRewardItem && item.rewardId) {
          try {
            // Check if the reward exists in the rewards table
            const [rewardCheck] = await connection.execute(
              'SELECT 1 FROM rewards WHERE reward_id = ?',
              [item.rewardId]
            );
            
            if (rewardCheck.length > 0) {
              rewardIdToUse = item.rewardId;
            } else {
              console.warn(`Warning: Reward ID ${item.rewardId} not found in rewards table. Setting to null.`);
            }
          } catch (rewardCheckErr) {
            console.error('Error checking reward existence:', rewardCheckErr);
          }
        }
        
        // Insert order line item
        const [orderLineItemResult] = await connection.execute(
          'INSERT INTO orderlineitems (order_id, product_id, product_name_snapshot, quantity, unit_price_snapshot, total_line_price, is_reward_item, reward_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            orderId, 
            item.productId,
            item.name, 
            quantity, 
            itemPrice || 0, // Ensure not undefined
            (itemPrice || 0) * quantity,
            item.isRewardItem ? 1 : 0,
            rewardIdToUse
          ]
        );
        
        // Get the inserted order line item ID
        const orderLineItemId = orderLineItemResult.insertId;
        
        // Insert selected options
        for (const option of selectedOptions) {
          // Skip options with missing required fields
          if (!option || !option.option_id) {
            console.warn('Skipping option with missing option_id:', option);
            continue;
          }
          
          await connection.execute(
            'INSERT INTO orderlineitem_selectedoptions (order_line_item_id, option_id, selected_option_label_snapshot, price_modifier_snapshot) VALUES (?, ?, ?, ?)',
            [
              orderLineItemId,
              option.option_id,
              option.label || 'Unknown option', // Provide default if label is undefined
              option.price_modifier || 0
            ]
          );
        }
      } catch (err) {
        console.error('Error inserting order line item:', err);
        throw err; // Re-throw to trigger rollback
      }
    }

    // Process rewards if any
    if (orderData.redeemedRewards && Array.isArray(orderData.redeemedRewards) && orderData.redeemedRewards.length > 0) {
      // Validate and sanitize rewards data before database insertion
      const validatedRewards = orderData.redeemedRewards.filter(reward => {
        // Skip any reward with missing required fields
        if (!reward || !reward.rewardId) {
          console.warn('Skipping reward with missing rewardId:', reward);
          return false;
        }
        return true;
      });
      
      if (validatedRewards.length > 0) {
        // Create validated reward values for bulk insertion
        const rewardValues = validatedRewards.map(reward => [
          orderId,
          reward.rewardId, // This is required and should never be null or undefined
          reward.voucherId || null, // Convert undefined to null for SQL
          reward.appliedDiscount ? 
            (reward.appliedDiscount.type === 'percentage' ? 
              (orderTotal * (reward.appliedDiscount.value / 100)) : reward.appliedDiscount.value) : 0,
          Array.isArray(reward.freeItems) && reward.freeItems.length > 0 ? JSON.stringify(reward.freeItems) : null // Ensure null if empty or invalid
        ]);
        
        // Insert validated rewards
        await connection.query(
          'INSERT INTO order_rewards (order_id, reward_id, voucher_id, discount_amount, free_items_json) VALUES ?',
          [rewardValues]
        );
      }
    }

    // Store the checkout in pending approvals
    pendingApprovals.checkouts.set(orderId, {
      orderId,
      orderData,
      orderTotal,
      customerName: orderData.customerName,
      itemSummary: itemsToProcess.map(({ item }) => ({
        name: item.name,
        quantity: item.quantity
      })),
      createdAt: new Date(),
      isApproved: false,
      isRejected: false
    });
    
    // Create approval request data
    const approvalData = {
      type: 'checkout',
      data: {
        orderId,
        orderTotal,
        customerName: orderData.customerName,
        items: itemsToProcess.map(({ item }) => ({
          name: item.name,
          quantity: item.quantity
        }))
      }
    };
    
    // Create approval URL
    const approvalUrl = `http://localhost:5173/test-approval?data=${encodeURIComponent(JSON.stringify(approvalData))}`;
    
    // Commit the transaction
    await connection.commit();
    
    res.status(200).json({ 
      message: 'Order submitted for approval',
      orderId,
      ticketNumber,
      timestamp: new Date().toISOString(),
      approvalUrl
    });
    
  } catch (error) {
    // Roll back the transaction on error
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }
    }
    
    console.error('Checkout request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Release the connection back to the pool
    if (connection) connection.release();
  }
});

// Approve checkout
app.post('/api/orders/approve-checkout', async (req, res) => {
  const { orderId } = req.body;
  
  if (!orderId) {
    return res.status(400).json({ message: 'Order ID is required' });
  }
  
  try {
    // Check if the checkout request exists
    const checkoutRequest = pendingApprovals.checkouts.get(orderId);
    
    if (!checkoutRequest) {
      return res.status(404).json({ message: 'Checkout request not found' });
    }
    
    // Process the order (simplified)
    // In a real app, you would create the order in the database
    checkoutRequest.isApproved = true;
    pendingApprovals.checkouts.set(orderId, checkoutRequest);
    
    // Return success
    res.status(200).json({ 
      message: 'Order approved and processed successfully',
      orderId
    });
    
  } catch (error) {
    console.error('Checkout approval error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reject checkout
app.post('/api/orders/reject-checkout', async (req, res) => {
  const { orderId } = req.body;
  
  if (!orderId) {
    return res.status(400).json({ message: 'Order ID is required' });
  }
  
  try {
    // Check if the checkout request exists
    const checkoutRequest = pendingApprovals.checkouts.get(orderId);
    
    if (!checkoutRequest) {
      return res.status(404).json({ message: 'Checkout request not found' });
    }
    
    // Mark as rejected and clean up
    checkoutRequest.isRejected = true;
    pendingApprovals.checkouts.set(orderId, checkoutRequest);
    
    res.status(200).json({ 
      message: 'Order rejected',
      orderId
    });
    
  } catch (error) {
    console.error('Checkout rejection error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});