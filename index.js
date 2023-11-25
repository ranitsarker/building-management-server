const express = require('express')
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken')
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 5000
// middleware 
app.use(cors({
  origin: [
    'http://localhost:5173', 
  ], 
  credentials: true
}));

app.use(express.json());


  const client = new MongoClient(process.env.DB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  })

  async function run() {
    try {
      //collection name 
      const usersCollection = client.db('buildingManagementDB').collection('users');
      const apartmentsCollection = client.db('buildingManagementDB').collection('apartments');
      const agreementsCollection = client.db('buildingManagementDB').collection('agreements');


      // auth related api
      app.post('/jwt', async (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '365d',
        });

        // Send the token in the response body
        res.send({ token });
      });

      // Logout
      app.get('/logout', async (req, res) => {
        try {
          res
            .clearCookie('token', {
              maxAge: 0,
              secure: process.env.NODE_ENV === 'production',
              sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            })
            .send({ success: true })
          console.log('Logout successful')
        } catch (err) {
          res.status(500).send(err)
        }
      })
    // Save or modify user email, status in DB
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email: email }
      const options = { upsert: true }
      const isExist = await usersCollection.findOne(query)
      console.log('User found?----->', isExist)
      if (isExist) return res.send(isExist)
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user, timestamp: Date.now() },
        },
        options
      )
      res.send(result)
    })

    // get apartments
    app.get('/apartments', async (req, res) => {
      try {
        const apartments = await apartmentsCollection.find().toArray();
        res.json(apartments);
      } catch (error) {
        console.error('Error fetching apartments:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Save agreement endpoint
    app.post('/saveAgreement', async (req, res) => {
      try {
        const agreementData = req.body;

        // Include the current date in the agreement data
        agreementData.createdAt = new Date();

        // Save the agreement data that collection
        const result = await agreementsCollection.insertOne(agreementData);

        // Respond with the result or any other information
        res.json({ success: true, result });
      } catch (error) {
        console.error('Error saving agreement:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // get agreements
    app.get('/agreements', async (req, res) => {
      try {
        const agreements = await agreementsCollection.find().toArray();
        res.json(agreements);
      } catch (error) {
        console.error('Error fetching agreements:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });



      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
    }
  }
  run().catch(console.dir)


  app.get('/', (req, res) => {
    res.send('building management is running')
})
app.listen(port, () => {
    console.log(`building management is running on port ${port}`)
})