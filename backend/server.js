import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Port - changed to 5050 to avoid conflict with services like TunnelBear on port 5000
const PORT = process.env.PORT || 5050;

// Local JSON Database fallback setup (uses writeable /tmp on Vercel)
const DB_FILE = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'database.json') 
  : path.resolve('database.json');

function initDbFile() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({
        users: [],
        events: [],
        bookings: [],
        messages: [],
        reviews: []
      }, null, 2));
    }
  } catch (err) {
    console.error('Failed to initialize local JSON database file:', err.message);
  }
}

const dbJson = {
  read: () => {
    try {
      initDbFile();
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      return { users: [], events: [], bookings: [], messages: [], reviews: [] };
    }
  },
  write: (data) => {
    try {
      initDbFile();
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Failed to write local JSON database:', e.message);
    }
  }
};

// Connect to MongoDB middleware
async function connectDb(req, res, next) {
  if (mongoose.connection.readyState === 1) {
    return next();
  }
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/event_planner';
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.warn('⚠️ [Database Notice] MongoDB connection failed. Server is running in robust local file-based database mode (database.json).');
  }
  next();
}
app.use(connectDb);



// --- Database Schemas & Models ---

// User/Provider Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['organizer', 'provider'], required: true },
  serviceName: String,
  serviceType: { type: String, enum: ['caterer', 'decorator', 'entertainer', 'photographer', 'venue', 'other'] },
  price: Number,
  description: String,
  rating: { type: Number, default: 5 },
  reviewsCount: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

// Event Schema
const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  location: String,
  budget: { type: Number, default: 0 },
  guests: [String],
  tasks: [{
    text: String,
    completed: { type: Boolean, default: false }
  }],
  eventType: { type: String, enum: ['physical', 'virtual'], default: 'physical' },
  meetingLink: String,
  organizerId: { type: String, required: true }
});
const Event = mongoose.model('Event', eventSchema);

// Booking Schema
const bookingSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  price: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'paid', 'cancelled'], default: 'pending' },
  paystackReference: String,
  refundStatus: { type: String, enum: ['none', 'pending', 'refunded'], default: 'none' },
  refundAmount: { type: Number, default: 0 },
  cancellationReason: String
});
const Booking = mongoose.model('Booking', bookingSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  booking: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// Review Schema
const reviewSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  organizer: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String,
  reply: String,
  timestamp: { type: Date, default: Date.now }
});
const Review = mongoose.model('Review', reviewSchema);

// --- Mail Notification Service Helpers ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER || 'demo@ethereal.email',
    pass: process.env.SMTP_PASS || 'demo_pass'
  }
});

async function sendNotificationEmail(to, subject, htmlContent) {
  try {
    await transporter.sendMail({
      from: '"Event Planner Platform" <no-reply@eventplanner.com>',
      to,
      subject,
      html: htmlContent
    });
    console.log(`Email notification successfully sent to ${to}`);
  } catch (error) {
    console.error('Failed to send notification email:', error);
  }
}

// --- REST API Endpoints with transparent DB Fallbacks ---

// 1. Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const user = new User(req.body);
      await user.save();
      return res.status(201).json(user);
    } else {
      const data = dbJson.read();
      const existing = data.users.find(u => u.email === req.body.email);
      if (existing) return res.status(400).json({ error: 'Email already exists' });
      
      const user = { 
        _id: new mongoose.Types.ObjectId().toString(), 
        ...req.body, 
        rating: 5, 
        reviewsCount: 0 
      };
      data.users.push(user);
      dbJson.write(data);
      return res.status(201).json(user);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne({ email, password });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      return res.json(user);
    } else {
      const data = dbJson.read();
      const user = data.users.find(u => u.email === email && u.password === password);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      return res.json(user);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Providers List
app.get('/api/providers', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const providers = await User.find({ role: 'provider' });
      return res.json(providers);
    } else {
      const data = dbJson.read();
      const providers = data.users.filter(u => u.role === 'provider');
      return res.json(providers);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Events CRUD
app.get('/api/events', async (req, res) => {
  const { organizerId } = req.query;
  try {
    if (mongoose.connection.readyState === 1) {
      const events = await Event.find({ organizerId });
      return res.json(events);
    } else {
      const data = dbJson.read();
      const events = data.events.filter(e => e.organizerId === organizerId);
      return res.json(events);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const event = new Event(req.body);
      await event.save();
      return res.status(201).json(event);
    } else {
      const data = dbJson.read();
      const event = {
        _id: new mongoose.Types.ObjectId().toString(),
        tasks: [],
        ...req.body
      };
      data.events.push(event);
      dbJson.write(data);
      return res.status(201).json(event);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
      return res.json(event);
    } else {
      const data = dbJson.read();
      const idx = data.events.findIndex(e => e._id === req.params.id);
      if (idx !== -1) {
        data.events[idx] = { ...data.events[idx], ...req.body };
        dbJson.write(data);
        return res.json(data.events[idx]);
      }
      return res.status(404).json({ error: 'Event not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Bookings & Paystack Payments integration
app.post('/api/bookings', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const booking = new Booking(req.body);
      await booking.save();
      return res.status(201).json(booking);
    } else {
      const data = dbJson.read();
      const booking = {
        _id: new mongoose.Types.ObjectId().toString(),
        status: 'pending',
        refundStatus: 'none',
        refundAmount: 0,
        ...req.body
      };
      data.bookings.push(booking);
      dbJson.write(data);
      return res.status(201).json(booking);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/bookings', async (req, res) => {
  const { organizerId, providerId } = req.query;
  try {
    if (mongoose.connection.readyState === 1) {
      const filter = {};
      if (organizerId) filter.organizer = organizerId;
      if (providerId) filter.provider = providerId;
      const bookings = await Booking.find(filter)
        .populate('event')
        .populate('provider')
        .populate('organizer');
      return res.json(bookings);
    } else {
      const data = dbJson.read();
      let filtered = data.bookings;
      if (organizerId) filtered = filtered.filter(b => b.organizer === organizerId);
      if (providerId) filtered = filtered.filter(b => b.provider === providerId);

      // Populate manually
      const populated = filtered.map(b => ({
        ...b,
        event: data.events.find(e => e._id === b.event),
        provider: data.users.find(u => u._id === b.provider),
        organizer: data.users.find(u => u._id === b.organizer)
      }));
      return res.json(populated);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paystack payment verification & updates
app.post('/api/payments/verify', async (req, res) => {
  const { reference, bookingId } = req.body;
  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_paystack_secret_key_antigravity';
    
    let isSuccess = false;
    if (paystackSecret.startsWith('sk_test_mock')) {
      isSuccess = true;
    } else {
      const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.data?.data?.status === 'success') {
        isSuccess = true;
      }
    }

    if (isSuccess) {
      if (mongoose.connection.readyState === 1) {
        const booking = await Booking.findById(bookingId).populate('organizer').populate('provider').populate('event');
        if (booking) {
          booking.status = 'paid';
          booking.paystackReference = reference;
          await booking.save();

          await sendNotificationEmail(
            booking.organizer.email,
            'Booking Confirmed and Paid!',
            `<h3>Hello ${booking.organizer.name},</h3>
             <p>Your payment for event <strong>${booking.event.name}</strong> with provider <strong>${booking.provider.name}</strong> was successful!</p>
             <p>Amount Paid: GHS ${booking.price}</p>
             <p>Paystack Transaction Ref: ${reference}</p>`
          );

          await sendNotificationEmail(
            booking.provider.email,
            'New Paid Booking Received!',
            `<h3>Hello ${booking.provider.name},</h3>
             <p>You have received a fully-paid booking from <strong>${booking.organizer.name}</strong> for event <strong>${booking.event.name}</strong>.</p>
             <p>Amount Paid: GHS ${booking.price}</p>`
          );
          return res.json({ success: true, booking });
        }
      } else {
        const data = dbJson.read();
        const idx = data.bookings.findIndex(b => b._id === bookingId);
        if (idx !== -1) {
          data.bookings[idx].status = 'paid';
          data.bookings[idx].paystackReference = reference;
          
          const booking = data.bookings[idx];
          const organizer = data.users.find(u => u._id === booking.organizer);
          const provider = data.users.find(u => u._id === booking.provider);
          const event = data.events.find(e => e._id === booking.event);

          dbJson.write(data);

          if (organizer && provider && event) {
            await sendNotificationEmail(
              organizer.email,
              'Booking Confirmed and Paid!',
              `<h3>Hello ${organizer.name},</h3>
               <p>Your payment for event <strong>${event.name}</strong> with provider <strong>${provider.name}</strong> was successful!</p>
               <p>Amount Paid: GHS ${booking.price}</p>`
            );
          }
          return res.json({ success: true, booking });
        }
      }
    }
    res.status(400).json({ error: 'Payment verification failed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Booking Cancellation & Paystack Refund Endpoint
app.post('/api/bookings/:id/cancel', async (req, res) => {
  const { reason } = req.body;
  try {
    if (mongoose.connection.readyState === 1) {
      const booking = await Booking.findById(req.params.id).populate('organizer').populate('provider').populate('event');
      if (!booking) return res.status(404).json({ error: 'Booking not found' });

      const previousStatus = booking.status;
      booking.status = 'cancelled';
      booking.cancellationReason = reason;

      if (previousStatus === 'paid' && booking.paystackReference) {
        booking.refundStatus = 'pending';
        const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
        if (paystackSecret && !paystackSecret.startsWith('sk_test_mock')) {
          try {
            await axios.post('https://api.paystack.co/refund', {
              transaction: booking.paystackReference,
              amount: booking.price * 100
            }, {
              headers: {
                Authorization: `Bearer ${paystackSecret}`,
                'Content-Type': 'application/json'
              }
            });
            booking.refundStatus = 'refunded';
            booking.refundAmount = booking.price;
          } catch (refundErr) {
            console.error('Paystack Refund failed, marked pending manual action:', refundErr.response?.data || refundErr.message);
          }
        } else {
          booking.refundStatus = 'refunded';
          booking.refundAmount = booking.price;
        }
      }
      await booking.save();
      return res.json({ success: true, booking });
    } else {
      const data = dbJson.read();
      const idx = data.bookings.findIndex(b => b._id === req.params.id);
      if (idx !== -1) {
        const previousStatus = data.bookings[idx].status;
        data.bookings[idx].status = 'cancelled';
        data.bookings[idx].cancellationReason = reason;

        if (previousStatus === 'paid') {
          data.bookings[idx].refundStatus = 'refunded';
          data.bookings[idx].refundAmount = data.bookings[idx].price;
        }
        dbJson.write(data);
        return res.json({ success: true, booking: data.bookings[idx] });
      }
      return res.status(404).json({ error: 'Booking not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Messaging
app.post('/api/messages', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const msg = new Message(req.body);
      await msg.save();
      return res.status(201).json(msg);
    } else {
      const data = dbJson.read();
      const msg = {
        _id: new mongoose.Types.ObjectId().toString(),
        timestamp: new Date(),
        ...req.body
      };
      data.messages.push(msg);
      dbJson.write(data);
      return res.status(201).json(msg);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  const { bookingId } = req.query;
  try {
    if (mongoose.connection.readyState === 1) {
      const messages = await Message.find({ booking: bookingId }).sort('timestamp');
      return res.json(messages);
    } else {
      const data = dbJson.read();
      const messages = data.messages
        .filter(m => m.booking === bookingId)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      return res.json(messages);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Analytics API endpoints
app.get('/api/analytics/organizer/:id', async (req, res) => {
  const organizerId = req.params.id;
  try {
    if (mongoose.connection.readyState === 1) {
      const events = await Event.find({ organizerId });
      const bookings = await Booking.find({ organizer: organizerId, status: 'paid' });
      const totalBudget = events.reduce((sum, e) => sum + (e.budget || 0), 0);
      const totalSpent = bookings.reduce((sum, b) => sum + b.price, 0);

      const spendingByCategory = {};
      const detailedBookings = await Booking.find({ organizer: organizerId }).populate('provider');
      detailedBookings.forEach(b => {
        if (b.status === 'paid' && b.provider?.serviceType) {
          spendingByCategory[b.provider.serviceType] = (spendingByCategory[b.provider.serviceType] || 0) + b.price;
        }
      });
      return res.json({ totalBudget, totalSpent, spendingByCategory, eventsCount: events.length });
    } else {
      const data = dbJson.read();
      const events = data.events.filter(e => e.organizerId === organizerId);
      const bookings = data.bookings.filter(b => b.organizer === organizerId && b.status === 'paid');

      const totalBudget = events.reduce((sum, e) => sum + (e.budget || 0), 0);
      const totalSpent = bookings.reduce((sum, b) => sum + b.price, 0);

      const spendingByCategory = {};
      bookings.forEach(b => {
        const provider = data.users.find(u => u._id === b.provider);
        if (provider?.serviceType) {
          spendingByCategory[provider.serviceType] = (spendingByCategory[provider.serviceType] || 0) + b.price;
        }
      });
      return res.json({ totalBudget, totalSpent, spendingByCategory, eventsCount: events.length });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/provider/:id', async (req, res) => {
  const providerId = req.params.id;
  try {
    if (mongoose.connection.readyState === 1) {
      const bookings = await Booking.find({ provider: providerId });
      const paidBookings = bookings.filter(b => b.status === 'paid');
      const totalBookings = bookings.length;
      const totalRevenue = paidBookings.reduce((sum, b) => sum + b.price, 0);

      const reviews = await Review.find({ provider: providerId });
      const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) : 5;

      return res.json({ totalBookings, totalRevenue, avgRating, pendingBookingsCount: bookings.filter(b => b.status === 'pending').length });
    } else {
      const data = dbJson.read();
      const bookings = data.bookings.filter(b => b.provider === providerId);
      const paidBookings = bookings.filter(b => b.status === 'paid');
      const totalBookings = bookings.length;
      const totalRevenue = paidBookings.reduce((sum, b) => sum + b.price, 0);

      const reviews = data.reviews.filter(r => r.provider === providerId);
      const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) : 5;

      return res.json({ totalBookings, totalRevenue, avgRating, pendingBookingsCount: bookings.filter(b => b.status === 'pending').length });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
export default app;

