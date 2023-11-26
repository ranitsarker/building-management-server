const express = require('express')
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken')
require('dotenv').config()
const { MongoClient, ServerApiVersion,  ObjectId} = require('mongodb');

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
        agreementData.acceptedDate = null;
        agreementData.rejectedDate = null;

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

    // get user role
    app.get('/user/:email', async(req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({email})
      res.send(result);
    })
/**
* agreement accepted or rejected that status endpoint and user role change status
* accepted = user => member
* rejected = member => user 
*/
    
    // Update agreement status endpoint
    app.put('/updateAgreementStatus/:id', async (req, res) => {
      try {
        const agreementId = req.params.id;
        const { status } = req.body;

        // Convert the agreementId to ObjectId
        const objectId = new ObjectId(agreementId);

        // Update the agreement status in the database
        const result = await agreementsCollection.updateOne(
          { _id: objectId },
          { $set: { status } }
        );

        // If the agreement is not found, return a 404 status
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Agreement not found' });
        }

        // Retrieve the updated agreement data
        const updatedAgreement = await agreementsCollection.findOne({ _id: objectId });

        res.json(updatedAgreement);
      } catch (error) {
        console.error('Error updating agreement status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Update user role endpoint
    app.put('/updateUserRole/:email', async (req, res) => {
      try {
        const userEmail = req.params.email;
        const { role } = req.body;

        // Update the user role in the database
        const result = await usersCollection.updateOne(
          { email: userEmail },
          { $set: { role } }
        );

        // If the user is not found, return a 404 status
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Retrieve the updated user data
        const updatedUser = await usersCollection.findOne({ email: userEmail });

        res.json(updatedUser);
      } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });



/**
* from admin agreement will accept and reject those 2 end point
*/
    // Update accepted date
    app.put('/updateAcceptedDate/:id', async (req, res) => {
      const agreementId = req.params.id;

      try {
        const result = await agreementsCollection.updateOne(
          { _id: new ObjectId(agreementId) },
          { $set: { acceptedDate: new Date() } }
        );

        res.json(result);
      } catch (error) {
        console.error('Error updating accepted date:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Update rejected date
    app.put('/updateRejectedDate/:id', async (req, res) => {
      const agreementId = req.params.id;

      try {
        const result = await agreementsCollection.updateOne(
          { _id: new ObjectId(agreementId) },
          { $set: { rejectedDate: new Date() } }
        );

        res.json(result);
      } catch (error) {
        console.error('Error updating rejected date:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Fetch all agreements endpoint
    app.get('/fetchAllAgreements', async (req, res) => {
      try {
        // Fetch all agreements from the database
        const allAgreements = await agreementsCollection.find({}).toArray();

        res.json(allAgreements);
      } catch (error) {
        console.error('Error fetching all agreements:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // API endpoint to get user profile
    app.get('/fetchUserProfile', async (req, res) => {
      try {
        const userEmail = req.query.email;

        if (!userEmail) {
          return res.status(400).json({ error: 'Email parameter is required' });
        }
        const userData = await usersCollection.findOne({ email: userEmail });

        if (!userData) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json(userData);
      } catch (error) {
        console.error('Error fetching user profile:', error);
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