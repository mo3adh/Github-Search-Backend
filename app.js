import express from 'express';
import cors from 'cors';
import axios from 'axios';
import redis from 'redis';

const app = express();
const port = 5000;
const PORT = process.env.PORT || 5000;
const REDIS_PORT = process.env.REDIS_PORT  || 6379;


const client = redis.createClient(REDIS_PORT);

app.use(cors({
    origin: ["http://localhost:3000"],
    methods: ["POST", "GET"],
    credentials: true
}));

app.use(express.json());

app.listen(PORT, () => {
    // console.log("I am live");
});

// Utility functions
/********************************************************************************* */
    
async function clearCache(req, res) {
    try {
        await client.connect();
        client.flushAll();
        client.quit();
        res.send("Cache cleared succesfully").status(201);
    } catch (error) {
        res.send({error}).status(403);
    }
}

// Check if data exist in chache memory
async function getFromCache(req, res, next) {
    const {searchType, searchBody} = req.body;
    const key = searchType + searchBody;

    try {
        await client.connect();
        const value = await client.get(key);
        if(value != null) {
            console.log("Data was found");
            client.quit();
            return res.send(JSON.parse(value)).status(201);
        }

        console.log("Data was not found");
    } catch (error) {
        res.send(error).status(403);
    }
    
    next();
}

// Fetch the data from API
async function getFromAPI(req, res) {
    const {searchType, searchBody} = req.body;
    const key = searchType + searchBody;
    
    try {
        const result = await axios.get(`https://api.github.com/search/${searchType}?q=${searchBody}`);
        const data = result.data;

        client.set(key, JSON.stringify(data), 'EX', 60 * 60 * 2);
        client.quit();

        res.send(data).status(201);
    } catch (error) {
        res.send(error).status(403);
    }
}

// API routes
/******************************************************************************* */

app.get('/', (req, res) => {
    res.send({ response: "I am alive" }).status(201);
});

app.post('/search', getFromCache, getFromAPI);

app.get('/clear-cache', clearCache);
    

    
