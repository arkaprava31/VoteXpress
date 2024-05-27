// Require necessary modules
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const blake = require('blakejs');
const { blake2b } = blake;

const app = express();

app.use(bodyParser.json());
app.use(cors());

mongoose.connect('mongodb+srv://arka:v3SDu7zvRBa2YJ8m@cluster0.hudnver.mongodb.net/?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const formDataSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  voterID: {
    type: String,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  uniqueID: {
    type: String,
    required: true,
  }
});

const voteDataSchema = new mongoose.Schema({
  voterID: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  registeredVoteID: {
    type: String,
    required: true,
  }
});

const FormData = mongoose.model('FormData', formDataSchema);

const VoteData = mongoose.model('VoteData', voteDataSchema);

app.post('/api/submit', async (req, res) => {
  try {
    const { name, email, password, adminPassword, voterID } = req.body;

    // const hashedVoterID = await bcrypt.hash(voterID, 10);

    const existingUser = await FormData.findOne({ email });

    const existingVoterID = await FormData.findOne({ voterID });

    if (existingUser) {
      return res.status(400).json({ error: 'Current email id is already linked. Use different one...' });
    }

    if (existingVoterID) {
      return res.status(400).json({ error: 'User already exists! login to continue...' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const uniqueUserID = uuidv4();

    const formData = new FormData({
      name,
      email,
      password: hashedPassword,
      adminPassword,
      voterID,
      uniqueID: uniqueUserID
    });

    await formData.save();

    res.status(201).json({ message: 'Form data saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await FormData.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'Invalid login credentials!' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ email: user.email }, 'your-secret-key', { expiresIn: '1h' });

    console.log(user.isVerified);

    res.status(200).json({ token, userName: user.name, uniqueID: user.uniqueID, isVerified: user.isVerified });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/voterid', async (req, res) => {
  try {
    const { voterID } = req.body;

    const user = await FormData.findOne({ voterID });

    console.log(voterID);

    if (!user) {
      return res.status(404).json({ error: "Voter Id doesn't match!" });
    }
    res.status(200).json({ voterIDNumber: user.voterID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/checkVoter', async (req, res) => {
  try {
    const { voterID } = req.body;

    const user = await VoteData.findOne({ voterID });

    console.log(user.registeredVoteID);

    if (!user) {
      return res.status(404).json({ registeredVoteID: "null" });
    }
    res.status(200).json({ registeredVoteID: user.registeredVoteID });
  } catch (error) {
    res.status(500).json({ registeredVoteID: "" });
  }
});


app.post('/api/register-vote', async (req, res) => {
  try {
    const { voterID, email, registeredVoteID } = req.body;

    // Encrypt registeredVoteID with Blake2b
    const hash = blake2b(new TextEncoder().encode(registeredVoteID));

    const voteData = new VoteData({
      voterID,
      email,
      registeredVoteID: hash.toString('hex') // Convert hash to hexadecimal string
    });

    await voteData.save();

    res.status(201).json({ message: 'Vote saved successfully' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/countVotes', async (req, res) => {
  try {
    const voteCounts = await VoteData.aggregate([
      {
        $group: {
          _id: '$registeredVoteID',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalCount = voteCounts.reduce((total, voteCount) => total + voteCount.count, 0);

    console.log(voteCounts);
    res.status(200).json({ voteCounts: voteCounts, totalCount  });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
