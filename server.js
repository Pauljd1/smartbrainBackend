const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const knex = require('knex');


dotenv.config();


const db = knex({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST || 'dpg-cs4g1sd2ng1s739k05pg-a.frankfurt-postgres.render.com',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'smartbrain_p29u_user',
        password: process.env.DB_PASSWORD || 'u1SBvh49xFgRse0fdCAVfz8JQ7sKsipy',
        database: process.env.DB_NAME || 'smartbrain_p29u',
        ssl: {
            rejectUnauthorized: false,
        },
    },
});


const app = express();
const saltRounds = 10;

// Middleware
app.use(bodyParser.json());
app.use(cors());


app.get('/', (req, res) => {
    res.send('Welcome to the Smart Brain API!');
});

// Signin route
app.post('/signin', async (req, res) => {
    try {
        const {email, password} = req.body;

        if (!email || !password) {
            return res.status(400).json('Incorrect form submission');
        }

        const [data] = await db('login').select('email', 'hash').where('email', email);

        if (data) {
            const isValid = await bcrypt.compare(password, data.hash);

            if (isValid) {
                const [user] = await db('users').select('*').where('email', email);
                return res.json(user); // Return the user data
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
    const {email, name, password} = req.body;

    if (!email || !name || !password) {
        return res.status(400).json('Incorrect form submission');
    }

    try {
        const hash = await bcrypt.hash(password, saltRounds);

        const [loginEmail] = await db('login')
            .insert({hash, email})
            .returning('email');

        const [user] = await db('users')
            .insert({
                email: loginEmail.email,
                name,
                joined: new Date(),
            })
            .returning('*');

        return res.json(user);
    } catch (error) {
        console.error('Error during registration:', error);
        return res.status(400).json('Unable to register');
    }
});

// Profile route
app.get('/profile/:id', async (req, res) => {
    const {id} = req.params;
    try {
        const [user] = await db('users').select('*').where({id});
        if (user) {
            return res.json(user);
        } else {
            return res.status(400).json('Unable to get profile');
        }
    } catch (error) {
        console.error('Error getting profile:', error);
        return res.status(400).json('Error getting user');
    }
});

// Image update route
app.put('/image', async (req, res) => {
    const {id} = req.body;
    try {
        const [entries] = await db('users').where('id', id).increment('entries', 1).returning('entries');
        return res.json(entries.entries);
    } catch (error) {
        console.error('Error updating entries:', error);
        return res.status(400).json('Unable to update entries');
    }
});


app.post('/clarifai', async (req, res) => {
    const {input} = req.body;

    // Store your Clarifai credentials in environment variables for security
    const PAT = process.env.CLARIFAI_PAT || "60d533bdd28643d7bf18ef4f6ea75f56";
    const USER_ID = process.env.CLARIFAI_USER_ID || "pauljd1";
    const APP_ID = process.env.CLARIFAI_APP_ID || "faceDetection";
    const MODEL_ID = process.env.CLARIFAI_MODEL_ID || "face-detection";

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
        const response = await fetch(`https://api.clarifai.com/v2/models/${MODEL_ID}/outputs`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Key ${PAT}`,
                'Content-Type': 'application/json',
            },
            body: raw,
        });

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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
