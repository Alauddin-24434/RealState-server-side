const express = require('express')
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const cors = require('cors')
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const axios = require('axios');
// ------use cookeiie perser-----
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000

// middleware ---- use
const corsOptions = {
  origin: ['http://localhost:5173', 'https://real-state-platform.web.app', 'https://real-state-platform.firebaseapp.com'],
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access you' })
    // ----
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}



// mongodb db uri -----------------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8ldebrq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    // crate all collection hare----------
    const usersCollection = client.db("RealStateDB").collection('users')

    const reviewCollection = client.db("RealStateDB").collection('reviews')
    const houseCollection = client.db("RealStateDB").collection('house')
    const userCartCollection = client.db("RealStateDB").collection('carts')
    const offersCollection = client.db("RealStateDB").collection('offers')
    const paymentCollection = client.db("RealStateDB").collection("payments");


    // auth realated api ---------
    app.post('/jwt', async (req, res) => {
      const user = req.body
      console.log('I need a new jwt', user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

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
    // -------------------------offers collection code start hare eee------------------------

    app.post('/offers', async (req, res) => {
      try {
        const body = req.body;
        const result = await offersCollection.insertOne(body)
        res.send(result)

      }
      catch (err) {
        console.log("this error is house collection post error", err)
      }
    })

    app.get('/offers', async (req, res) => {
      try {
        const cursor = offersCollection.find()
        const result = await cursor.toArray()
        res.send(result)
      }
      catch (err) {
        console.log(err)
      }
    })

    app.get('/userBought', async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send('Email parameter is missing');
        }

        const result = await offersCollection.find({ email }).toArray();
        console.log('Query Result:', result);
        res.send(result);
      } catch (err) {
        console.error('Error:', err);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });


    // put upadte offer collection
    app.put('/offers/accept/:id', async (req, res) => {
      const { id } = req.params;

      try {
        // Update the offer status to 'accepted' in the database
        await offersCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'accepted' } });
       
        // Send a PUT request to update the status on the client-side (if needed)
        await axios.put(`https://real-state-server-side.vercel.app/offers/accept/${id}`);

        res.json({ success: true, message: 'Offer accepted successfully' });
      } catch (error) {
        console.error('Error accepting offer:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
    });

    // PUT method to reject an offer
    app.put('/offers/reject/:id', async (req, res) => {
      const { id } = req.params;

      try {
        // Update the offer status to 'rejected' in the database
        await offersCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'rejected' } });
       
        // Send a PUT request to update the status on the client-side (if needed)
        await axios.put(`https://real-state-server-side.vercel.app/offers/reject/${id}`);

        res.json({ success: true, message: 'Offer rejected successfully' });
      } catch (error) {
        console.error('Error rejecting offer:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
    });

    // house collection code start hare
    // Update property route
    app.put('/houseUpdate/:id', async (req, res) => {
      try {
        const propertyId = req.params.id;
        const updatedData = req.body;

        // Convert propertyId to ObjectId
        const objectId = new ObjectId(propertyId);

        // Update the property in the collection
        const filter = { _id: objectId };
        const updateResult = await houseCollection.updateOne(filter, { $set: updatedData });

        if (updateResult.modifiedCount > 0) {
          // Property updated successfully
          const updatedProperty = await houseCollection.findOne({ _id: objectId });
          res.status(200).json({
            message: 'Property updated successfully',
            updatedProperty,
          });
        } else {
          // Property not found or not updated
          res.status(404).json({ error: 'Property not found or not updated' });
        }
      } catch (error) {
        console.error('Error updating property:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    app.post('/house', async (req, res) => {
      try {
        const body = req.body;
        const result = await houseCollection.insertOne(body)
        res.send(result)

      }
      catch (err) {
        console.log("this error is house collection post error", err)
      }
    })

    app.get('/houses', async (req, res) => {
      try {
        const cursor = houseCollection.find()
        const result = await cursor.toArray()
        res.send(result)
      }
      catch (err) {
        console.log(err)
      }
    })
    app.get('/houses/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await houseCollection.findOne(query)
        res.send(result)
      }
      catch (err) {
        console.log("single propertiesCollection get error", err)
      }
    })
    app.get('/agentHouses/:email', async (req, res) => {
      try {
        const email = req.params.email;

        const result = await houseCollection.find({ 'agent.email': email }).toArray()
        res.send(result)
      }
      catch (err) {
        console.log(err)
      }
    })

    app.delete('/houseDelete/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await houseCollection.deleteOne(query);

        // Check if the deletion was successful
        if (result.deletedCount === 1) {
          res.status(204).send(); // 204 No Content indicates success
        } else {
          res.status(404).send({ error: 'Review not found' });
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    // 2 ------------------- user Review collection code start hare-----------------------

    app.post('/reviews', async (req, res) => {
      try {
        const body = req.body;
        console.log("receive review from clint side body :", body)
        const result = await reviewCollection.insertOne(body)
        res.send(result)
      }
      catch (err) {
        console.log("reviews  post in reviewsCollection error", err)
      }
    })



    // all reviews
    app.get('/reviews', async (req, res) => {
      try {
        const cursor = reviewCollection.find()
        const result = await cursor.toArray()
        res.send(result)
      }
      catch (err) {
        console.log(err)
      }
    })

    app.get('/ownReviews', async (req, res) => {
      try {
        console.log(req.query.email);
        // console.log('token owner info', req.user)
        // if (req.user.email !== req.query.email) {
        //     return res.status(403).send({ message: 'forbidden access' })
        // }
        let query = {}
        if (req.query?.email) {
          query = { email: req.query.email }
        }

        const result = await reviewCollection.find(query).toArray();
        console.log('Query Result:', result);
        res.send(result);
      } catch (err) {
        console.error("own user reviews get:", err);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    app.delete('/userReviews/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await reviewCollection.deleteOne(query);

        // Check if the deletion was successful
        if (result.deletedCount === 1) {
          res.status(204).send(); // 204 No Content indicates success
        } else {
          res.status(404).send({ error: 'Review not found' });
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });
    // ------------------- user Review collection code end hare-----------------------

    // ----------------------user cart book collection start hare -------------
    app.post('/carts', async (req, res) => {
      try {
        const body = req.body;
        console.log("receive cart data  from clint side body :", body)
        const result = await userCartCollection.insertOne(body)
        res.send(result)
      }
      catch (err) {
        console.log("reviews  post in userCartCollection error", err)
      }
    })
    app.get('/carts', async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send('Email parameter is missing');
        }

        const result = await userCartCollection.find({ email }).toArray();
        console.log('Query Result:', result);
        res.send(result);
      } catch (err) {
        console.error('Error:', err);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    app.get('/allBooking', async (req, res) => {
      try {
        const cursor = userCartCollection.find()
        const result = await cursor.toArray()
        res.send(result)
      }
      catch (err) {
        console.log(err)
      }
    })
    app.delete('/carts/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCartCollection.deleteOne(query);

        // Check if the deletion was successful
        if (result.deletedCount === 1) {
          res.status(204).send(); // 204 No Content indicates success
        } else {
          res.status(404).send({ error: 'Review not found' });
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });



    // 3----------------------- userCollection code start hare -----------------

    app.get('/users', async (req, res) => {
      try {
        const cursor = usersCollection.find()
        const result = await cursor.toArray()
        res.send(result)
      }
      catch (err) {
        console.log(err)
      }
    })

    app.delete('/users/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(query);

        // Check if the deletion was successful
        if (result.deletedCount === 1) {
          res.status(204).send(); // 204 No Content indicates success
        } else {
          res.status(404).send({ error: 'Review not found' });
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });
    app.patch('/users/:id', async (req, res) => {
      const userId = req.params.id;
      const { role } = req.body;

      try {
        const filter = { _id: new ObjectId(userId) };
        const update = { $set: { role: role } };

        const result = await usersCollection.updateOne(filter, update);

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await usersCollection.findOne(filter);

        res.json(updatedUser);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    app.get('/user/:email', async (req, res) => {
      try {
        const email = req.params.email;

        const result = await usersCollection.findOne({ email })
        res.send(result)
      }
      catch (err) {
        console.log(err)
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
    // ---------------------------stripe payment collection ---------------------
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


    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  carefully delete each item from the cart
      console.log('payment info', payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };

      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    })
    // -----------------admin ---------------------
    // Route to handle the PATCH request for updating the status

    app.patch('/houses/update/:id', async (req, res) => {
      const userId = req.params.id;
      const { status } = req.body;

      try {
        const filter = { _id: new ObjectId(userId) };
        const update = { $set: { status: status } };

        const result = await houseCollection.updateOne(filter, update);

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await houseCollection.findOne(filter);

        res.json(updatedUser);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // app.get('/houses', async (req, res) => {
    //   const { email } = req.query;

    //   try {
    //     const properties =await houseCollection.find({ email });
    //     res.json(properties);
    //   } catch (error) {
    //     console.error('Error fetching properties:', error);
    //     res.status(500).json({ error: 'Internal Server Error' });
    //   }
    // });

    // -----------------------authtication userCollection code end hare -----------------

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Real state Server is running...')
})

app.listen(port, () => {
  console.log(`Real state platform is running on port ${port}`)
})
