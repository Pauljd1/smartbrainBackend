import express from 'express';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import knex from 'knex';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = knex({
  client: 'pg',
  connection: {
    host: 'dpg-cs4g1sd2ng1s739k05pg-a',
    user: 'smartbrain_p29u_user',
    password: 'u1SBvh49xFgRse0fdCAVfz8JQ7sKsipy',
    database: 'smartbrain_p29u',
    port: 5432,
  },
});

const app = express();
const saltRounds = 10;

// CORS Configuration
const corsOptions = {
  origin: 'https://smartbrain-4gyf.onrender.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
};

app.use(bodyParser.json());
app.use(cors(corsOptions));

app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Signin route
app.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json('Incorrect form submission');
    }

    const data = await db('login')
      .select('email', 'hash')
      .where('email', email);

    if (data.length) {
      const isValid = await bcrypt.compare(password, data[0].hash);

      if (isValid) {
        const user = await db('users').select('*').where('email', email);
        if (user.length) {
          return res.json(user[0]); // Send user data as JSON
        } else {
          return res.status(400).json('User not found');
        }
      } else {
        return res.status(400).json('Wrong credentials');
      }
    } else {
      return res.status(400).json('Wrong credentials');
    }
  } catch (error) {
    console.error('Error during sign-in:', error);
    return res.status(500).json('Error during sign-in');
  }
});

// Register route
app.post('/register', async (req, res) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json('Incorrect form submission');
  }

  try {
    const hash = await bcrypt.hash(password, saltRounds);

    const loginEmail = await db('login')
      .insert({ hash, email })
      .returning('email');

    if (loginEmail.length) {
      // Ensure email was returned
      const user = await db('users')
        .insert({
          email: loginEmail[0].email, // Access the email correctly
          name,
          joined: new Date(),
        })
        .returning('*');

      if (user.length) {
        return res.json(user[0]); // Send user data as JSON
      } else {
        return res.status(400).json('User could not be registered');
      }
    } else {
      return res.status(400).json('Unable to register');
    }
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(400).json('Unable to register');
  }
});

// Clarifai API route
app.post('/clarifai', async (req, res) => {
  const { input } = req.body;

  const PAT = '60d533bdd28643d7bf18ef4f6ea75f56';
  const USER_ID = 'pauljd1';
  const APP_ID = 'faceDetection';
  const MODEL_ID = 'face-detection';

  const raw = JSON.stringify({
    user_app_id: {
      user_id: USER_ID,
      app_id: APP_ID,
    },
    inputs: [
      {
        data: {
          image: {
            url: input,
          },
        },
      },
    ],
  });

  try {
    const response = await fetch(
      `https://api.clarifai.com/v2/models/${MODEL_ID}/outputs`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Key ${PAT}`,
          'Content-Type': 'application/json',
        },
        body: raw,
      }
    );

    if (!response.ok) {
      throw new Error(`Clarifai API error: ${response.statusText}`);
    }

    const result = await response.json();
    return res.json(result);
  } catch (error) {
    console.error('Error calling Clarifai API:', error);
    return res.status(400).json('Error calling Clarifai API');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
