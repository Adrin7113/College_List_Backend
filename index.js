const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const cors = require("cors");
require("dotenv").config();
const { ObjectId } = require("mongodb");

const connectToDb = async () => {
  const client = new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    await client.connect();
    console.log("Connected to MongoDB");
    return client.db(process.env.MONGO_DB_NAME);
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
};

const startServer = async () => {
  const db = await connectToDb();
  const app = express();
  app.use(cors());

  app.get("/collegesOverview", async (req, res) => {
    try {
      const collection = db.collection("colleges");
      const data = await collection
        .aggregate([
          {
            $project: {
              _id: 1, // Exclude _id field
              name: 1, // Include name field
              address: 1, // Include address field
              overview: "$landing.overview.about", // Include overview field from landing
            },
          },
        ])
        .toArray();
      res.json(data);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  });
  app.get("/colleges/:id", async (req, res) => {
    console.log(req.params.id);
    try {
      const collection = db.collection("colleges");
      const college = await collection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (college) {
        res.json(college);
      } else {
        res.status(404).json({ error: "College not found" });
      }
    } catch (err) {
      console.error("Failed to fetch college:", err);
      res.status(500).json({ error: "Failed to fetch college" });
    }
  });
  app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  });
};

startServer();
