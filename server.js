const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');
const knex = require('knex')({
    client: 'pg',
    connection: {
        host: 'localhost',
        port: 5432,
        user: 'test',
        password: '1234',
        database: 'smart-brain',
    }
});
const fetch = require('node-fetch');

const app = express();
const saltRounds = 10;


app.use(bodyParser.json());
app.use(cors());


app.post('/signin', async (req, res) => {
    try {
        const {email, password} = req.body;


        if (!email || !password) {
            return res.status(400).json('Incorrect form submission');
        }


        const [data] = await knex('login').select('email', 'hash').where('email', email);

        if (data) {

            const isValid = await bcrypt.compare(password, data.hash);

            if (isValid) {

                const [user] = await knex('users').select('*').where('email', email);
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


app.post('/register', async (req, res) => {
    const {email, name, password} = req.body;


    if (!email || !name || !password) {
        return res.status(400).json('Incorrect Form Submission');
    }

    try {
        // Hash the password
        const hash = await bcrypt.hash(password, saltRounds);


        const [loginEmail] = await knex('login')
            .insert({hash, email})
            .returning('email');

        // Insert into 'users' table
        const [user] = await knex('users')
            .insert({
                email: loginEmail.email,
                name,
                joined: new Date()
            })
            .returning('*');


        return res.json(user);
    } catch (error) {
        console.error(error);
        return res.status(400).json('Unable to register');
    }
});


app.get('/profile/:id', async (req, res) => {
    const {id} = req.params;
    try {
        const [user] = await knex('users').select('*').where({id});
        if (user) {
            return res.json(user);
        } else {
            return res.status(400).json('Unable to get profile');
        }
    } catch (error) {
        console.error(error);
        return res.status(400).json('Error getting user');
    }
});


app.put('/image', async (req, res) => {
    const {id} = req.body;
    try {
        const [entries] = await knex('users').where('id', id).increment('entries', 1).returning('entries');
        return res.json(entries.entries);
    } catch (error) {
        console.error(error);
        return res.status(400).json('Unable to get entries');
    }
});


app.post('/clarifai', async (req, res) => {
    const {input} = req.body;
    const PAT = "60d533bdd28643d7bf18ef4f6ea75f56";
    const USER_ID = "pauljd1";
    const APP_ID = "faceDetection";
    const MODEL_ID = "face-detection";

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
        console.error(error);
        return res.status(400).json('Error calling Clarifai API');
    }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
