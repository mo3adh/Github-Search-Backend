import express from 'express';
import cors from 'cors';
import axios from 'axios';
import redis from 'redis';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const app = express();
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

// Swagger Documentation  *************************  
const swaggerOptions = {
    swaggerDefinition: {
        components: {},
        info: {
        version: "1.0.0",
        title: "Serach API",
        description: "Github Serach API",
        servers: ["http://localhost:5000"]
        }
    },
    apis: ["app.js"]
};
const swaggerDocs = swaggerJsDoc(swaggerOptions);

/**
 * @swagger
 * components:
 *   schemas:
 *     SearchQuery:
 *       type: object
 *       required:
 *         - searchType
 *         - searchBody
 *       properties:
 *         searchType:
 *           type: string
 *           description: Search Type
 *         SearchBody:
 *           type: string
 *           description: Search Body
 *       example:
 *         searchType: users
 *         SearchBody: john13245
 */

// Utility functions  *************************  
async function clearCache(req, res) {
    try {
        await client.connect();
        client.flushAll();
        client.quit();
        res.send("Cache cleared succesfully").status(201);
    } catch (error) {
        res.send(error).status(403);
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
            const data = JSON.parse(value);
            return res.send({data: data, type: searchType}).status(201);
        }

        console.log("Data was not found");
    } catch (error) {
        return res.send(error).status(403);
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

        return res.send({data: data, type: searchType}).status(201);
    } catch (error) {
        res.send(error).status(403);
    }
}



// API Rtoutes  *************************  
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get('/', (req, res) => {
    res.send({ response: "I am alive" }).status(201);
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Get all search results
 *     description: Fetch data from Github API
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchQuery'
 *     responses:
 *       201:
 *         description: data fetched successfully
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchQuery'
 *       403:
 *         description: error
 */
app.post('/search', getFromCache, getFromAPI);

/**
 * @swagger
 * /clear-cache:
 *   get:
 *     summary: clear cached memory
 *     responses:
 *       201:
 *         description: cahce memory cleared successfully 
 *       403:
 *         description: error
 */
app.get('/clear-cache', clearCache);