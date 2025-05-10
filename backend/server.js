require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db'); // Import the database connection pool
const { v4: uuidv4 } = require('uuid'); // Import uuid
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing for frontend requests
app.use(express.json()); // Parse JSON request bodies

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expecting "Bearer TOKEN"

  console.log('[authenticateToken] Received headers:', req.headers); // Log headers
  console.log('[authenticateToken] Extracted token:', token); // Log extracted token

  if (token == null) {
    console.log('[authenticateToken] Token is null, sending 401.');
    return res.status(401).json({ message: 'Unauthorized' }); // Changed to JSON response
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
      console.error('[authenticateToken] JWT_SECRET is not defined!');
      return res.status(500).json({ message: 'Internal server error: Auth configuration missing.' });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      console.log('[authenticateToken] JWT Verification Error:', err.message); // Log specific verify error
      return res.status(403).json({ message: 'Forbidden' }); // Changed to JSON response
    }
    // Token is valid, attach payload to request object
    console.log('[authenticateToken] JWT verified successfully. User:', user);
    req.user = user; 
    next(); // Proceed to the next middleware or route handler
  });
};

// --- Basic Routes ---
app.get('/', (req, res) => {
  res.send('EspressoLane Backend is Running!');
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
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// POST - Create a new category
app.post('/api/categories', authenticateToken, async (req, res) => {
  // Role-based authorization
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  const { name, image_url } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Missing required field: name' });
  }

  try {
    const sql = `INSERT INTO Categories (name, image_url) VALUES (?, ?)`;
    const [result] = await db.query(sql, [name, image_url || null]);

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

// --- Product Routes ---

// POST - Create a new product
app.post('/api/products', authenticateToken, async (req, res) => {
  // Role-based authorization
  console.log('[POST /api/products] Checking role for req.user:', req.user);
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
  }

  // Destructure expected fields from request body
  const { name, description, base_price, image_url, category_id, availability, tags, option_group_ids } = req.body;

  // Basic validation
  if (!name || base_price === undefined || category_id === undefined) {
    return res.status(400).json({ message: 'Missing required fields: name, base_price, category_id' });
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
      availability || 'available',
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
  // Destructure fields that can be updated
  const { name, description, base_price, image_url, category_id, availability, tags, option_group_ids } = req.body;

  // Basic validation - ensure at least one updatable field is present
  if (name === undefined && description === undefined && base_price === undefined && image_url === undefined && category_id === undefined && availability === undefined && tags === undefined && option_group_ids === undefined) {
    return res.status(400).json({ message: 'No update fields provided.' });
  }
  if (category_id !== undefined && typeof category_id !== 'number') {
    return res.status(400).json({ message: 'Invalid category_id format.' });
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
    if (tags !== undefined) { setClauses.push('tags = ?'); productValues.push(tags === null ? null : tags); productFieldsUpdated = true; }

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
  const { label, price_modifier } = req.body;

  if (isNaN(optionId)) {
    return res.status(400).json({ message: 'Invalid option ID format.' });
  }
  if (label === undefined && price_modifier === undefined) {
    return res.status(400).json({ message: 'No update fields provided (label or price_modifier).' });
  }

  try {
    let setClauses = [];
    let values = [];
    if (label !== undefined) { setClauses.push('label = ?'); values.push(label); }
    if (price_modifier !== undefined) { setClauses.push('price_modifier = ?'); values.push(price_modifier); }

    if (setClauses.length === 0) {
        return res.status(400).json({ message: 'No valid fields to update.' });
    }

    values.push(optionId);
    const sql = `UPDATE Options SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE option_id = ?`;
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

    // Insert the new user (user_id is auto-increment)
    // TODO: Generate/handle referral code if needed
    const newUserSql = `
      INSERT INTO Users (email, name, password_hash, role, avatar_url, join_date)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    // Inserting minimal required fields + join_date. Others have defaults or are NULL.
    const defaultAvatar = '/src/assets/avatar.png';
    const [insertResult] = await db.query(newUserSql, [email, name, passwordHash, userRole, defaultAvatar]);
    const newUserId = insertResult.insertId; // Get the auto-incremented integer user_id

    // Fetch the newly created user data (excluding password hash) to return
    // Select fields needed for the frontend User type - temporarily removed referral_code for debugging
    const [newUserRows] = await db.query('SELECT user_id, name, email, role, avatar_url FROM Users WHERE user_id = ?', [newUserId]);

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
                referralCode: newUser.referral_code // This will be undefined if not selected, ensure frontend handles it
            }
        });
    } else {
      // This shouldn't typically happen if the insert succeeded without error
      res.status(500).json({ message: 'User registered but could not be retrieved.' });
    }

  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
});

// POST /api/login - Log in a user
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Find user by email (using the email column)
    const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' }); // Use generic message
    }

    const user = users[0];

    // Compare provided password with stored hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' }); // Use generic message
    }

    // Password matches - Generate JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET is not defined in .env file!');
        return res.status(500).json({ message: 'Internal server error: JWT configuration missing.' });
    }

    const payload = {
      userId: user.user_id, // Put integer user_id into token
      email: user.email,
      role: user.role,
      name: user.name
      // Add other non-sensitive info if needed
    };

    // Sign the token (e.g., expires in 1 hour)
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });

    // Send token back to client (along with user info matching frontend User type)
    res.json({
      token: token,
      user: {
        id: user.user_id.toString(), // Send id as string representation of integer user_id
        name: user.name,
        // email: user.email,
        role: user.role,
        avatar: user.avatar_url,
        referralCode: user.referral_code
      }
    });

  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({ message: 'Error logging in user', error: error.message });
  }
});

// --- Order Routes ---

// GET /api/orders - Fetch all orders with their line items (Added limit query param)
app.get('/api/orders', authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || null; // Get optional limit from query string

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
  // Data from frontend
  const { customerName, items } = req.body; // Removed totalAmount, expect items to have selectedOptionIds
  const loggedInUserId = req.user.userId; 
  const loggedInUserRole = req.user.role;

  // Basic Validation
  if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Missing required order data: customerName, items array.' });
  }
  // TODO: Add validation for item structure (productId, quantity, selectedOptionIds)

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Determine the customer_id to store
    let orderUserIdToStore = null; 
    if (loggedInUserRole === 'customer') {
        orderUserIdToStore = loggedInUserId;
    } // Remains null for staff orders

    // --- Server-Side Price Calculation --- 
    let calculated_total_amount = 0;
    const lineItemsToInsert = []; // To store data for bulk insert later
    const allSelectedOptionIds = items.flatMap(item => Object.values(item.selectedOptionIds || {}).flat()); // Get all potential option IDs

    // Fetch all potentially relevant product and option prices in fewer queries
    const productIds = items.map(item => item.productId);
    // Fetch product name along with base price
    const productPriceSql = `SELECT product_id, base_price, name FROM Products WHERE product_id IN (?)`;
    const [productPrices] = await connection.query(productPriceSql, [productIds]);
    // Store both price and name in the map
    const productDataMap = new Map(productPrices.map(p => [p.product_id, { price: parseFloat(p.base_price), name: p.name }]));

    let optionPriceMap = new Map();
    if (allSelectedOptionIds.length > 0) {
        // Fetch option label and price modifier
        const optionPriceSql = `SELECT option_id, label, price_modifier FROM Options WHERE option_id IN (?)`;
        const [optionPrices] = await connection.query(optionPriceSql, [allSelectedOptionIds]);
        // Store object with label and modifier in the map
        optionPriceMap = new Map(optionPrices.map(o => [String(o.option_id), { label: o.label, modifier: parseFloat(o.price_modifier) }]));
    }

    for (const item of items) {
        // Retrieve product data (price and name) from the map
        const productData = productDataMap.get(item.productId);
        if (!productData) {
            throw new Error(`Product data not found for ID: ${item.productId}`);
        }
        const basePrice = productData.price;
        const productNameSnapshot = productData.name; // Get the name snapshot

        let optionsModifier = 0;
        if (item.selectedOptionIds) {
            for (const key in item.selectedOptionIds) {
                 const selection = item.selectedOptionIds[key]; // Can be string (radio) or string[] (checkbox)
                 const idsToLookup = Array.isArray(selection) ? selection : [selection];
                 idsToLookup.forEach(optionId => {
                     // Retrieve option details (modifier) from map
                     const optionData = optionPriceMap.get(String(optionId)); 
                     if (optionData?.modifier !== undefined) { 
                         optionsModifier += optionData.modifier;
                     }
                 });
            }
        }

        const unit_price_snapshot = basePrice + optionsModifier;
        const total_line_price = unit_price_snapshot * item.quantity;
        calculated_total_amount += total_line_price;

        // Prepare data for bulk insert into OrderLineItems, including product_name_snapshot
        lineItemsToInsert.push([
            null, // Placeholder for order_id, will be set later
            item.productId,
            productNameSnapshot, // Add product name snapshot
            item.quantity,
            unit_price_snapshot,
            total_line_price
        ]);
        // TODO: Prepare data for OrderLineItem_SelectedOptions insertion here as well
    }
    // --- End Server-Side Price Calculation ---

    // 1. Create the main order record
    const orderId = uuidv4(); 
    const ticketNumber = `#${String(Date.now()).slice(-6)}`; 
    const orderStatus = 'pending';
    const orderTimestamp = new Date();

    const orderSql = `
      INSERT INTO Orders (order_id, customer_id, customer_name_snapshot, total_amount, status, order_timestamp, ticket_number)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await connection.query(orderSql, [
      orderId,
      orderUserIdToStore, 
      customerName,       
      calculated_total_amount, // Use server-calculated total
      orderStatus,
      orderTimestamp,     
      ticketNumber
    ]);

    // 2. Insert line items (with calculated prices)
    if (lineItemsToInsert.length > 0) {
       // Update orderId placeholder in each line item array
       lineItemsToInsert.forEach(line => line[0] = orderId);

       const lineItemsSql = `
        INSERT INTO OrderLineItems (order_id, product_id, product_name_snapshot, quantity, unit_price_snapshot, total_line_price)
        VALUES ?;
      `;
      // Get the result of the line item insertion to know the first inserted ID and affected rows
      const [lineItemsResult] = await connection.query(lineItemsSql, [lineItemsToInsert]);

      // 3. Insert into OrderLineItem_SelectedOptions
      if (lineItemsResult.affectedRows === items.length) { // Ensure all expected line items were inserted
        const firstLineItemId = lineItemsResult.insertId;
        const selectedOptionsToInsert = [];

        for (let i = 0; i < items.length; i++) {
          const lineItemDatabaseId = firstLineItemId + i; // Calculate the actual ID for each line item
          const currentFrontendItem = items[i]; // Original item from the request with selectedOptionIds

          if (currentFrontendItem.selectedOptionIds && Object.keys(currentFrontendItem.selectedOptionIds).length > 0) {
            for (const groupId in currentFrontendItem.selectedOptionIds) {
              const selectedInGroup = currentFrontendItem.selectedOptionIds[groupId];
              const productOptionIds = Array.isArray(selectedInGroup) ? selectedInGroup : [selectedInGroup];

              for (const productOptionId of productOptionIds) {
                if (productOptionId) { // Basic check to ensure there's an ID
                  // Fetch label and modifier from the map for snapshotting
                  const optionDetails = optionPriceMap.get(String(productOptionId));
                  const labelSnapshot = optionDetails?.label ?? 'Unknown Option'; // Default if not found
                  const modifierSnapshot = optionDetails?.modifier ?? 0.00; // Default if not found

                  selectedOptionsToInsert.push([
                    lineItemDatabaseId,
                    productOptionId,
                    labelSnapshot,      // Add label snapshot
                    modifierSnapshot    // Add modifier snapshot
                  ]);
                }
              }
            }
          }
        }

        if (selectedOptionsToInsert.length > 0) {
          const selectedOptionsSql = `
            INSERT INTO OrderLineItem_SelectedOptions 
              (order_line_item_id, option_id, selected_option_label_snapshot, price_modifier_snapshot)
            VALUES ?;
          `;
          await connection.query(selectedOptionsSql, [selectedOptionsToInsert]);
        }
      } else {
        console.warn(`Order ${orderId}: Mismatch in expected line items vs. inserted line items. Skipping selected options insertion.`);
        // Potentially throw an error here to rollback if this is critical
      }
    }
    
    // TODO: Insert into OrderLineItem_SelectedOptions here // This TODO can be removed now

    await connection.commit();

    // 3. Fetch the newly created order to return (keep existing logic)
    const [newlyCreatedOrder] = await db.query('SELECT * FROM Orders WHERE order_id = ?', [orderId]);
    // Fetch line items including the name snapshot
    const [newlyCreatedItems] = await db.query('SELECT * FROM OrderLineItems WHERE order_id = ?', [orderId]);
    // TODO: Fetch selected options as well if needed for the response
    // ... (rest of data structuring and response remains similar) ...

    if (newlyCreatedOrder.length === 0) {
       throw new Error('Failed to retrieve newly created order.');
    }

    const finalOrderData = {
       id: newlyCreatedOrder[0].order_id, 
       customerId: newlyCreatedOrder[0].customer_id, 
       customerName: newlyCreatedOrder[0].customer_name_snapshot, // Use correct column name
       items: newlyCreatedItems.map(dbItem => ({ // Map DB items back
          productId: dbItem.product_id,
          name: dbItem.product_name_snapshot, // Use the snapshot name
          quantity: dbItem.quantity,
          customizations: [], // TODO: Reconstruct customizations string or pass selected options
          // unitPrice: parseFloat(dbItem.unit_price_snapshot), // Optionally return prices
          // lineTotal: parseFloat(dbItem.total_line_price),
       })),
       total: parseFloat(newlyCreatedOrder[0].total_amount), // Use correct column name
       status: newlyCreatedOrder[0].status,
       timestamp: newlyCreatedOrder[0].order_timestamp, // Use correct column name
       ticketNumber: newlyCreatedOrder[0].ticket_number,
    };

    res.status(201).json(finalOrderData); 

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error creating order:", error);
    res.status(500).json({ message: 'Error creating order', error: error.message });
  } finally {
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

  // Authorization: Only managers can archive
  if (role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to archive orders.' });
  }

  try {
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
        'SELECT 1 FROM claimedgeneralrewards WHERE customer_id = ? AND reward_id = ? LIMIT 1',
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
      // b. Mark reward as claimed (using claimedgeneralrewards table)
      try {
        await connection.query(
          'INSERT INTO claimedgeneralrewards (customer_id, reward_id, claimed_at) VALUES (?, ?, NOW())',
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

// GET /api/rewards/definitions - Fetch all reward definitions
app.get('/api/rewards/definitions', async (req, res) => {
  // TODO: Consider adding authentication if rewards are sensitive
  try {
    const sql = `SELECT * FROM Rewards ORDER BY name`; // Assuming Rewards table
    const [rewards] = await db.query(sql);
    // TODO: Add logic to parse criteria_json if stored as string
    // const processedRewards = rewards.map(r => ({
    //   ...r,
    //   criteria: r.criteria_json ? JSON.parse(r.criteria_json) : null,
    //   criteria_json: undefined // Remove raw json string
    // }));
    res.json(rewards); // Sending raw for now, assumes frontend knows structure
  } catch (error) {
    console.error("Error fetching reward definitions:", error);
    res.status(500).json({ message: 'Error fetching reward definitions', error: error.message });
  }
});

// TODO: Add POST, PUT, DELETE endpoints for /api/rewards/definitions (manager only)

// POST /api/rewards/definitions - Create a new reward definition
app.post('/api/rewards/definitions', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: Only managers can create reward definitions.' });
  }

  // TODO: Add validation for the request body (req.body) structure
  const { name, description, image, type, criteria, pointsCost, freeMenuItemIds, discountPercentage, discountFixedAmount, earningHint } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: 'Missing required fields: name, type' });
  }

  try {
    const rewardId = uuidv4(); // Generate unique ID
    // Stringify criteria if it's an object
    const criteriaJson = criteria ? JSON.stringify(criteria) : null;
    // Prepare list of free item IDs (assuming comma-separated string or array)
    const freeItems = Array.isArray(freeMenuItemIds) ? freeMenuItemIds.join(',') : (freeMenuItemIds || null);

    const sql = `
      INSERT INTO Rewards (reward_id, name, description, image_url, type, criteria_json, points_cost, free_menu_item_ids, discount_percentage, discount_fixed_amount, earning_hint)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await db.query(sql, [
      rewardId, name, description, image, type, criteriaJson, 
      pointsCost, freeItems, discountPercentage, discountFixedAmount, earningHint
    ]);

    // Fetch the newly created reward to return
    const [newReward] = await db.query('SELECT * FROM Rewards WHERE reward_id = ?', [rewardId]);
    if (newReward.length > 0) {
      // TODO: Parse criteria_json before sending?
      res.status(201).json(newReward[0]); 
    } else {
      res.status(500).json({ message: 'Reward created but could not be retrieved.' });
    }

  } catch (error) {
    console.error("Error creating reward definition:", error);
    res.status(500).json({ message: 'Error creating reward definition', error: error.message });
  }
});

// PUT /api/rewards/definitions/:id - Update a reward definition
app.put('/api/rewards/definitions/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: Only managers can update reward definitions.' });
  }
  const { id } = req.params;
  // TODO: Add validation for req.body
  const { name, description, image, type, criteria, pointsCost, freeMenuItemIds, discountPercentage, discountFixedAmount, earningHint } = req.body;

  // Check if at least one field is provided for update
  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ message: 'No update fields provided.' });
  }

  try {
    let setClauses = [];
    let values = [];

    // Dynamically build SET clause
    if (name !== undefined) { setClauses.push('name = ?'); values.push(name); }
    if (description !== undefined) { setClauses.push('description = ?'); values.push(description); }
    if (image !== undefined) { setClauses.push('image_url = ?'); values.push(image); }
    if (type !== undefined) { setClauses.push('type = ?'); values.push(type); }
    if (criteria !== undefined) { setClauses.push('criteria_json = ?'); values.push(criteria ? JSON.stringify(criteria) : null); }
    if (pointsCost !== undefined) { setClauses.push('points_cost = ?'); values.push(pointsCost); }
    if (freeMenuItemIds !== undefined) { 
        const freeItems = Array.isArray(freeMenuItemIds) ? freeMenuItemIds.join(',') : (freeMenuItemIds || null);
        setClauses.push('free_menu_item_ids = ?'); values.push(freeItems);
    }
    if (discountPercentage !== undefined) { setClauses.push('discount_percentage = ?'); values.push(discountPercentage); }
    if (discountFixedAmount !== undefined) { setClauses.push('discount_fixed_amount = ?'); values.push(discountFixedAmount); }
    if (earningHint !== undefined) { setClauses.push('earning_hint = ?'); values.push(earningHint); }

    if (setClauses.length === 0) {
        return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP'); // Add updated_at timestamp
    values.push(id); // Add reward ID for WHERE clause

    const sql = `UPDATE Rewards SET ${setClauses.join(', ')} WHERE reward_id = ?`;
    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Reward definition not found.' });
    }

    // Fetch the updated reward to return
    const [updatedReward] = await db.query('SELECT * FROM Rewards WHERE reward_id = ?', [id]);
    // TODO: Parse criteria_json before sending?
    res.json(updatedReward[0]);

  } catch (error) {
    console.error(`Error updating reward definition ${id}:`, error);
    res.status(500).json({ message: 'Error updating reward definition', error: error.message });
  }
});

// DELETE /api/rewards/definitions/:id - Delete a reward definition
app.delete('/api/rewards/definitions/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden: Only managers can delete reward definitions.' });
  }
  const { id } = req.params;

  try {
    // TODO: Consider implications - should we prevent deleting if active vouchers exist?
    // Or just delete the definition and let vouchers become unusable?
    // For now, simple delete:
    const sql = 'DELETE FROM Rewards WHERE reward_id = ?';
    const [result] = await db.query(sql, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Reward definition not found.' });
    }

    res.status(200).json({ message: 'Reward definition deleted successfully.' });

  } catch (error) {
    console.error(`Error deleting reward definition ${id}:`, error);
    // Handle potential FK errors if deleting is constrained
    res.status(500).json({ message: 'Error deleting reward definition', error: error.message });
  }
});

// --- Customer Info Route ---

// GET /api/customers/:customerId/info - Fetch detailed info for rewards page
app.get('/api/customers/:customerId/info', authenticateToken, async (req, res) => {
  const { customerId } = req.params;
  const requestingUserId = req.user.userId;
  const requestingUserRole = req.user.role;

  // Authorization: Customer can get their own info, staff can get anyone's?
  if (requestingUserRole !== 'customer' && requestingUserRole !== 'manager' && requestingUserRole !== 'employee' && requestingUserRole !== 'cashier') {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to view customer info.' });
  }
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
            cv.granted_by 
        FROM CustomerVouchers cv
        JOIN Rewards r ON cv.reward_id = r.reward_id
        WHERE cv.customer_id = ? AND cv.status = \'active\' AND (cv.expiry_date IS NULL OR cv.expiry_date >= CURDATE())
        ORDER BY cv.granted_date DESC;
    `; // Also check expiry date here
    const [activeVouchers] = await db.query(voucherSql, [customerId]);

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
        activeVouchers: activeVouchers // Add fetched active vouchers
        // Map voucher fields if DB names differ from CustomerVoucher type
    };

    res.json(customerInfo);

  } catch (error) {
    console.error(`Error fetching info for customer ${customerId}:`, error);
    res.status(500).json({ message: 'Error fetching customer information', error: error.message });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
}); 

// Route to get users available for employment (not already employees)
app.get('/api/users/available', authenticateToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: "Forbidden: Only managers can access this resource." });
  }

  try {
    const query = `
      SELECT u.user_id, u.name, u.email, u.role 
      FROM users u
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

    const [usersFound] = await connection.query('SELECT user_id FROM users WHERE email = ?', [userEmail]);
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
      'INSERT INTO employeedetails (user_id, employee_id_code, position, status, phone_number, hire_date) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, employeeIdCode.trim(), position, finalStatus, finalPhone, finalHireDate]
    );
    const employeeInternalId = result.insertId;

    if (newRole) { 
        await connection.query('UPDATE users SET role = ? WHERE user_id = ?', [finalRole, userId]);
    }

    await connection.commit();
    
    const [newEmployeeArr] = await connection.query(
      `SELECT ed.employee_internal_id, ed.employee_id_code, ed.position, ed.status, ed.phone_number, ed.hire_date, u.email, u.name AS employeeName, u.role AS user_role FROM employeedetails ed JOIN users u ON ed.user_id = u.user_id WHERE ed.employee_internal_id = ?`,
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
        e.phone_number, e.hire_date, e.created_at, e.updated_at,
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
  const { employeeIdCode, position, status, phoneNumber, hireDate, role: newRole } = req.body;

  console.log(`[Backend PUT /api/employees/${employeeInternalId}] Received body:`, JSON.stringify(req.body, null, 2));

  if (!employeeIdCode && !position && !status && phoneNumber === undefined && hireDate === undefined && !newRole) {
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
    if (phoneNumber !== undefined) { // Allow setting phone to null or empty string to effectively clear it
      setClauses.push('phone_number = ?');
      params.push(phoneNumber === '' ? null : phoneNumber.trim());
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

    // Update user's role if newRole is provided
    let userRoleUpdated = false;
    if (newRole) {
      // Get user_id from currentEmployee (fetched before transaction)
      const userIdToUpdate = currentEmployee.user_id;
      if (userIdToUpdate) {
        console.log(`[Backend PUT /api/employees/${employeeInternalId}] Updating user ${userIdToUpdate} role to ${newRole}`);
        await connection.query('UPDATE users SET role = ? WHERE user_id = ?', [newRole, userIdToUpdate]);
        userRoleUpdated = true;
      } else {
        console.warn(`[Backend PUT /api/employees/${employeeInternalId}] Cannot update role, user_id not found on current employee record.`);
      }
    }

    if (setClauses.length === 0 && !userRoleUpdated) {
        // This case should ideally be caught by the initial check for no update info, but as a safeguard within transaction:
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: 'No actual changes to apply for employee details or user role.' });
    }

    await connection.commit();

    // Fetch the updated employee details to return
    const [updatedEmployeeArr] = await connection.query(
      `SELECT ed.employee_internal_id, ed.employee_id_code, ed.position, ed.status, ed.phone_number, ed.hire_date, u.email, u.name AS employeeName, u.role AS user_role 
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