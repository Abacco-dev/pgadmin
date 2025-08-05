const express = require('express');
const app = express();
const pool = require('./db'); // PostgreSQL connection
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Create uploads folder if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer setup for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

/* -------------------------
   CREATE Contact (POST)
------------------------- */
app.post('/api/contacts', upload.single('file'), async (req, res) => {
  try {
    const { name, email, emp_id, salary, age, role, address, phone_number } = req.body;
    const file = req.file;

    if (!name || !email || !emp_id || !salary || !age || !role || !address || !phone_number) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!email.includes('@')) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    const existing = await pool.query('SELECT * FROM contacts WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      if (file) fs.unlinkSync(file.path);
      return res.status(409).json({ error: 'Contact with this email already exists.' });
    }

    const filePath = file ? file.path : null;

    const result = await pool.query(
      `INSERT INTO contacts 
       (name, email, emp_id, salary, age, role, address, phone_number, file_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, email, emp_id, salary, age, role, address, phone_number, filePath]
    );

    res.status(201).json({ message: 'Contact added successfully.', contact: result.rows[0] });
  } catch (error) {
    console.error('POST error:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* -------------------------
   READ All Contacts (GET)
------------------------- */
app.get('/api/contacts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('GET error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

/* -------------------------
   UPDATE Contact (PUT)
------------------------- */
app.put('/api/contacts/:id', upload.single('file'), async (req, res) => {
  const id = req.params.id;
  const { name, email, emp_id, salary, age, role, address, phone_number } = req.body;
  const file = req.file;

  // 🔍 Add this line to debug incoming body
  console.log("Request body:", req.body);

  try {
    const oldResult = await pool.query('SELECT file_path FROM contacts WHERE id = $1', [id]);
    const oldFilePath = oldResult.rows[0]?.file_path;

    let filePath = oldFilePath;
    if (file) {
      filePath = file.path;
      if (oldFilePath && fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    const result = await pool.query(
      `UPDATE contacts 
       SET name = $1, email = $2, emp_id = $3, salary = $4, age = $5, role = $6, address = $7, phone_number = $8, file_path = $9
       WHERE id = $10 RETURNING *`,
      [name, email, emp_id, salary, age, role, address, phone_number, filePath, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact updated successfully.', contact: result.rows[0] });
  } catch (error) {
    console.error('PUT error:', error);
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: 'Database error' });
  }
});


/* -------------------------
   DELETE Contact (DELETE)
------------------------- */
app.delete('/api/contacts/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const existing = await pool.query('SELECT file_path FROM contacts WHERE id = $1', [id]);
    const filePath = existing.rows[0]?.file_path;

    const result = await pool.query('DELETE FROM contacts WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'Contact deleted successfully.', contact: result.rows[0] });
  } catch (error) {
    console.error('DELETE error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

/* -------------------------
   Start Server
------------------------- */
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
