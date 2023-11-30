    const express = require('express')
    const cors = require('cors')
    const app = express()
    const jwt = require('jsonwebtoken')
    require('dotenv').config()
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    const { MongoClient, ServerApiVersion,  ObjectId} = require('mongodb');

    const port = process.env.PORT || 5000
    // middleware 
    app.use(cors({
    origin: [
      'http://localhost:5173', 
      'https://building-management-31565.web.app'
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
        const announcementsCollection = client.db('buildingManagementDB').collection('announcements');
        const paymentsCollection = client.db('buildingManagementDB').collection('payments');
        const couponsCollection = client.db('buildingManagementDB').collection('coupons');

        // verify token middleware
        const verifyToken = (req, res, next) => {
          const token = req.headers.authorization;
        
          if (!token) {
            return res.status(401).json({ error: 'Unauthorized access. No token provided.' });
          }
        
          try {
            // Verify the token
            const decoded = jwt.verify(token.split(' ')[1], process.env.ACCESS_TOKEN_SECRET);
            req.user = decoded; // Attach the decoded user information to the request
            next(); // Move to the next middleware
          } catch (error) {
            console.error('Error verifying token:', error);
            return res.status(403).json({ error: 'Invalid token.' });
          }
        };
        // auth related api
        app.post('/jwt', async (req, res) => {
          const user = req.body;
          const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: '365d',
          });

          // Send the token in the response body
          res.send({ token });
        });


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

      // get agreements (Secure)
      app.get('/agreements', verifyToken, async (req, res) => {
        try {
          const agreements = await agreementsCollection.find().toArray();
          res.json(agreements);
        } catch (error) {
          console.error('Error fetching agreements:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
      });

      // get user role (Secure)
      app.get('/user/:email', verifyToken, async(req, res) => {
        const email = req.params.email
        const result = await usersCollection.findOne({email})
        res.send(result);
      })
      
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
      app.get('/fetchAllAgreements', verifyToken, async (req, res) => {
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
      app.get('/fetchUserProfile', verifyToken, async (req, res) => {
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

      // API endpoint to fetch members based on role
      app.get('/fetchMembers', verifyToken, async (req, res) => {
        try {
          const role = req.query.role;

          if (!role) {
            return res.status(400).json({ error: 'Role parameter is required' });
          }

          // Fetch members data from the 'usersCollection' collection based on role
          const membersData = await usersCollection.find({ role: role }).toArray();

          res.json(membersData);
        } catch (error) {
          console.error('Error fetching members:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
      });

      //announcement post endpoint
      app.post('/make-announcement', async (req, res) => {
        try {
          const { title, description, user } = req.body;

          const result = await announcementsCollection.insertOne({
            title,
            description,
            user,
            createdAt: new Date(),
          });

          if (result.insertedId) {
            res.status(201).json({ message: 'Announcement submitted successfully', insertedId: result.insertedId });
          } else {
            console.error('Failed to insert announcement');
            res.status(500).json({ error: 'Internal Server Error' });
          }
        } catch (error) {
          console.error('Error making announcement:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
      });

      // Fetch all announcements endpoint
      app.get('/fetchAllAnnouncements', verifyToken, async (req, res) => {
        try {
          const announcements = await announcementsCollection.find().toArray();
          res.json(announcements);
        } catch (error) {
          console.error('Error fetching announcements:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
      });

        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        console.log(amount, 'amount inside the intent')

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });

        res.send({
          clientSecret: paymentIntent.client_secret
        })
      });

      // save payments
      app.post('/payments', async (req, res) => {
        const payment = req.body;
        const paymentResult = await paymentsCollection.insertOne(payment);

        // carefully delete each item from the agreements
        console.log('payment info', payment);

        // If agreementIds is a single string ID
        const query = {
          _id: new ObjectId(payment.agreementIds)
        };

        const deleteResult = await agreementsCollection.deleteOne(query);

        res.send({ paymentResult, deleteResult });
      });
      
      // Fetch all payments endpoint
      app.get('/payments/history', verifyToken, async (req, res) => {
        try {
          const query = { email: req.query.email };
      
          // If a month parameter is provided, add it to the query
          if (req.query.month) {
            query.month = req.query.month;
          }
      
          // Fetch payments based on the query
          const allPayments = await paymentsCollection.find(query).toArray();
          res.json(allPayments);
        } catch (error) {
          console.error('Error fetching payment history:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
      });

    // Add this endpoint to save coupon information
    // Add this endpoint to create a new coupon
    app.post('/coupons', async (req, res) => {
    try {
      // Extract coupon data from the request body
      const { couponCode, discountPercentage, couponDescription } = req.body;

      // Validate coupon data if needed

      // Save the coupon to the 'coupons' collection
      const result = await couponsCollection.insertOne({
        couponCode,
        discountPercentage,
        couponDescription,
      });

      res.status(201).json({ success: true, result });
    } catch (error) {
      console.error('Error creating coupon:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
    });
    // Add this endpoint to get coupon information
    app.get('/coupons', async (req, res) => {
    try {
      // Fetch all coupons from the 'coupons' collection
      const coupons = await couponsCollection.find().toArray();
      res.json(coupons);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
    });


    app.get('/coupons/:couponCode', async (req, res) => {
    const couponCode = req.params.couponCode;

    try {
      const coupon = await couponsCollection.findOne({ couponCode });

      if (coupon) {
        res.json(coupon);
      } else {
        res.status(404).json({ error: 'Coupon not found' });
      }
    } catch (error) {
      console.error('Error fetching coupon:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
    });

    // total number of apartment
    app.get('/apartments/count', async (req, res) => {
      try {
        const totalApartmentsCount = await apartmentsCollection.countDocuments();
        res.json(totalApartmentsCount);
      } catch (error) {
        console.error('Error fetching apartments count:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // get accepted agreements (totalUnavailableRooms room)
    app.get('/agreements/totalUnavailableRooms', verifyToken, async (req, res) => {
      try {
        const totalUnavailableRooms = await agreementsCollection.countDocuments({ status: 'accepted' });
        res.json(totalUnavailableRooms);
      } catch (error) {
        console.error('Error fetching total unavailable rooms:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });


        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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