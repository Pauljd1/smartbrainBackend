import express from 'express';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import knex from 'knex';
import path from 'path';
import {fileURLToPath} from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const db = knex({
    client: 'pg',
    connection:
        process.env.DATABASE_URL ||
        'postgresql://<your_db_username>:<your_db_password>@<your_db_host>/<your_db_name>',
});

const app = express();
const saltRounds = 10;


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


app.post('/signin', async (req, res) => {
    try {
        const {email, password} = req.body;

        if (!email || !password) {
            return res.status(400).json({error: 'Incorrect form submission'});
        }

        const [data] = await db('login')
            .select('email', 'hash')
            .where('email', email);

        if (data) {
            const isValid = await bcrypt.compare(password, data.hash);

            if (isValid) {
                const [user] = await db('users').select('*').where('email', email);
                return res.json(user);
            } else {
                return res.status(400).json({error: 'Wrong credentials'});
            }
        } else {
            return res.status(400).json({error: 'Wrong credentials'});
        }
    } catch (error) {
        console.error('Error during sign-in:', error);
        return res.status(500).json({error: 'Error during sign-in', details: error.message});
    }
});


app.post('/register', async (req, res) => {
    console.log('Register request body:', req.body); // Log request body for debugging

    const {email, name, password} = req.body;

    if (!email || !name || !password) {
        return res.status(400).json({error: 'Incorrect form submission'});
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
        return res.status(500).json({error: 'Unable to register', details: error.message});
    }
});


app.get('/profile/:id', async (req, res) => {
    const {id} = req.params;
    try {
        const [user] = await db('users').select('*').where({id});
        if (user) {
            return res.json(user);
        } else {
            return res.status(400).json({error: 'Unable to get profile'});
        }
    } catch (error) {
        console.error('Error getting profile:', error);
        return res.status(400).json({error: 'Error getting user', details: error.message});
    }
});


app.put('/image', async (req, res) => {
    const {id} = req.body;
    try {
        const [entries] = await db('users')
            .where('id', id)
            .increment('entries', 1)
            .returning('entries');
        return res.json(entries.entries);
    } catch (error) {
        console.error('Error updating entries:', error);
        return res.status(400).json({error: 'Unable to update entries', details: error.message});
    }
});


app.post('/clarifai', async (req, res) => {
    const {input} = req.body;

    const PAT = process.env.CLARIFAI_PAT || '<your_clarifai_pat>';
    const USER_ID = process.env.CLARIFAI_USER_ID || '<your_user_id>';
    const APP_ID = process.env.CLARIFAI_APP_ID || '<your_app_id>';
    const MODEL_ID = process.env.CLARIFAI_MODEL_ID || 'face-detection';

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
            const errorDetail = await response.text(); // Get detailed error message
            throw new Error(`Clarifai API error: ${response.statusText}. Detail: ${errorDetail}`);
        }

        const result = await response.json();
        return res.json(result);
    } catch (error) {
        console.error('Error calling Clarifai API:', error);
        return res.status(400).json({error: 'Error calling Clarifai API', details: error.message});
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
