import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://caresphere-client.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized access: Missing token' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access: Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    const db = client.db('caresphereDB');
    const usersCollection = db.collection('users');
    const eventsCollection = db.collection('events');
    const joinsCollection = db.collection('joined_events');

    // Auth: Register
    app.post('/api/auth/register', async (req, res) => {
      try {
        const { name, email, photoURL, password } = req.body;
        if (!name || !email || !password) {
          return res.status(400).send({ message: 'Name, email, and password are required' });
        }

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(409).send({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
          name,
          email,
          photoURL: photoURL || '',
          password: hashedPassword,
          createdAt: new Date()
        };

        await usersCollection.insertOne(newUser);
        const token = jwt.sign(
          { email: newUser.email, name: newUser.name, photoURL: newUser.photoURL },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.status(201).send({
          success: true,
          token,
          user: { name: newUser.name, email: newUser.email, photoURL: newUser.photoURL }
        });
      } catch (error) {
        res.status(500).send({ message: 'Registration failed', error: error.message });
      }
    });

    // Auth: Login
    app.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        if (!email || !password) {
          return res.status(400).send({ message: 'Email and password required' });
        }

        const user = await usersCollection.findOne({ email });
        if (!user || !user.password) {
          return res.status(401).send({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).send({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
          { email: user.email, name: user.name, photoURL: user.photoURL },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.send({
          success: true,
          token,
          user: { name: user.name, email: user.email, photoURL: user.photoURL }
        });
      } catch (error) {
        res.status(500).send({ message: 'Login failed', error: error.message });
      }
    });

    // Auth: Social Sync
    app.post('/api/auth/social-login', async (req, res) => {
      try {
        const { name, email, photoURL } = req.body;
        let user = await usersCollection.findOne({ email });
        if (!user) {
          const newUser = { name, email, photoURL: photoURL || '', createdAt: new Date() };
          await usersCollection.insertOne(newUser);
          user = newUser;
        }

        const token = jwt.sign(
          { email: user.email, name: user.name, photoURL: user.photoURL },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.send({
          success: true,
          token,
          user: { name: user.name, email: user.email, photoURL: user.photoURL }
        });
      } catch (error) {
        res.status(500).send({ message: 'Social login failed', error: error.message });
      }
    });

    // Profile: Update
    app.patch('/api/users/profile', verifyToken, async (req, res) => {
      try {
        const { name, photoURL } = req.body;
        await usersCollection.updateOne(
          { email: req.user.email },
          { $set: { name, photoURL } }
        );

        const updatedToken = jwt.sign(
          { email: req.user.email, name, photoURL },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.send({ success: true, token: updatedToken, user: { email: req.user.email, name, photoURL } });
      } catch (error) {
        res.status(500).send({ message: 'Profile update failed', error: error.message });
      }
    });

    // Events: 6 Recent Upcoming (Home page)
    app.get('/api/events/recent', async (req, res) => {
      try {
        const now = new Date().toISOString();
        const events = await eventsCollection
          .find({ eventDate: { $gte: now } })
          .sort({ eventDate: 1 })
          .limit(6)
          .toArray();

        res.send(events);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching recent events', error: error.message });
      }
    });

    // Events: All Upcoming (Upcoming Events page)
    app.get('/api/events', async (req, res) => {
      try {
        const now = new Date().toISOString();
        const events = await eventsCollection
          .find({ eventDate: { $gte: now } })
          .sort({ eventDate: 1 })
          .toArray();

        res.send(events);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching events', error: error.message });
      }
    });

    // Events: Single Details
    app.get('/api/events/:id', async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).send({ message: 'Invalid ID' });

        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
        if (!event) return res.status(404).send({ message: 'Event not found' });

        res.send(event);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching details', error: error.message });
      }
    });

    // Events: Create (Protected, Future Date Enforced)
    app.post('/api/events', verifyToken, async (req, res) => {
      try {
        const { title, description, eventType, thumbnail, location, eventDate } = req.body;
        if (!title || !description || !eventType || !thumbnail || !location || !eventDate) {
          return res.status(400).send({ message: 'All fields are required' });
        }

        const parsedDate = new Date(eventDate);
        if (parsedDate <= new Date()) {
          return res.status(400).send({ message: 'Event date must be in the future' });
        }

        const newEvent = {
          title,
          description,
          eventType,
          thumbnail,
          location,
          eventDate: parsedDate.toISOString(),
          creatorEmail: req.user.email,
          creatorName: req.user.name,
          createdAt: new Date().toISOString()
        };

        const result = await eventsCollection.insertOne(newEvent);
        res.status(201).send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        res.status(500).send({ message: 'Error creating event', error: error.message });
      }
    });

    // Manage Events: User's Created Events (Protected)
    app.get('/api/user/events', verifyToken, async (req, res) => {
      try {
        const events = await eventsCollection
          .find({ creatorEmail: req.user.email })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(events);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching events', error: error.message });
      }
    });

    // Manage Events: Update Event (Protected)
    app.patch('/api/events/:id', verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).send({ message: 'Invalid ID' });

        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
        if (!event) return res.status(404).send({ message: 'Event not found' });

        if (event.creatorEmail !== req.user.email) {
          return res.status(403).send({ message: 'Forbidden: You can only edit your own events' });
        }

        const { title, description, eventType, thumbnail, location, eventDate } = req.body;
        if (eventDate && new Date(eventDate) <= new Date()) {
          return res.status(400).send({ message: 'Date must be in the future' });
        }

        const updateDoc = {
          $set: {
            ...(title && { title }),
            ...(description && { description }),
            ...(eventType && { eventType }),
            ...(thumbnail && { thumbnail }),
            ...(location && { location }),
            ...(eventDate && { eventDate: new Date(eventDate).toISOString() })
          }
        };

        await eventsCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);
        res.send({ success: true, message: 'Event updated successfully' });
      } catch (error) {
        res.status(500).send({ message: 'Error updating event', error: error.message });
      }
    });

    // Manage Events: Delete Event (Protected)
    app.delete('/api/events/:id', verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).send({ message: 'Invalid ID' });

        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
        if (!event) return res.status(404).send({ message: 'Event not found' });

        if (event.creatorEmail !== req.user.email) {
          return res.status(403).send({ message: 'Forbidden: You can only delete your own events' });
        }

        await eventsCollection.deleteOne({ _id: new ObjectId(id) });
        await joinsCollection.deleteMany({ eventId: id });
        res.send({ success: true, message: 'Event deleted successfully' });
      } catch (error) {
        res.status(500).send({ message: 'Error deleting event', error: error.message });
      }
    });

    // Events: Join Event (Protected)
    app.post('/api/events/:id/join', verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).send({ message: 'Invalid ID' });

        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
        if (!event) return res.status(404).send({ message: 'Event not found' });

        const alreadyJoined = await joinsCollection.findOne({
          eventId: id,
          userEmail: req.user.email
        });

        if (alreadyJoined) {
          return res.status(409).send({ message: 'You have already joined this event' });
        }

        const joinRecord = {
          eventId: id,
          eventTitle: event.title,
          eventThumbnail: event.thumbnail,
          eventLocation: event.location,
          eventType: event.eventType,
          eventDate: event.eventDate,
          userEmail: req.user.email,
          userName: req.user.name,
          joinedAt: new Date().toISOString()
        };

        await joinsCollection.insertOne(joinRecord);
        res.status(201).send({ success: true, message: 'Successfully joined event' });
      } catch (error) {
        res.status(500).send({ message: 'Error joining event', error: error.message });
      }
    });

    // Joined Events List (Protected)
    app.get('/api/user/joined-events', verifyToken, async (req, res) => {
      try {
        const joined = await joinsCollection
          .find({ userEmail: req.user.email })
          .sort({ eventDate: 1 })
          .toArray();
        res.send(joined);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching joined events', error: error.message });
      }
    });

    app.get('/', (req, res) => {
      res.send({ status: 'CareSphere API is running' });
    });

  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`CareSphere server running on port ${port}`);
});