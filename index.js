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
  app.use(express.json());
  app.use(cors());

  app.get("/colleges", async (req, res) => {
    try {
      const collection = db.collection("colleges");
      const data = await collection
        .aggregate([
          {
            $project: {
              _id: 1,
              name: 1,
              address: 1,
            },
          },
        ])
        .toArray();
      const uniqueFilterOptions = await db
        .collection("uniqueFilterOptions")
        .find({})
        .toArray();
      res.json({ data, uniqueFilterOptions });
    } catch (err) {
      console.error("Failed to fetch data:", err);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  });

  app.get("/colleges/:id", async (req, res) => {
    try {
      const collection = db.collection("colleges");
      const pipeline = [
        {
          $match: {
            _id: new ObjectId(req.params.id),
          },
        },
        {
          $addFields: {
            idString: { $toString: "$_id" },
          },
        },
        {
          $lookup: {
            from: "courses",
            localField: "idString",
            foreignField: "collegeId",
            as: "courseDetails",
          },
        },
        {
          $lookup: {
            from: "scholarships",
            localField: "idString",
            foreignField: "collegeId",
            as: "scholarshipDetails",
          },
        },
      ];
      const college = await collection.aggregate(pipeline).toArray();
      if (college.length > 0) {
        res.json(college[0]);
      } else {
        res.status(404).json({ error: "College not found" });
      }
    } catch (err) {
      console.error("Failed to fetch college:", err);
      res.status(500).json({ error: "Failed to fetch college" });
    }
  });

  app.post("/colleges/filters", async (req, res) => {
    const { country, program, type, courseName, collegeName } = req.body;
    try {
      const collection = db.collection("colleges");
      const pipeline = [
        {
          $addFields: {
            idString: { $toString: "$_id" },
          },
        },
        {
          $lookup: {
            from: "courses",
            localField: "idString",
            foreignField: "collegeId",
            as: "courseDetails",
          },
        },
      ];

      if (country !== "") {
        pipeline.push({ $match: { country: country } });
      }

      if (program !== "") {
        pipeline.push({
          $match: {
            courseDetails: {
              $elemMatch: {
                program: program,
              },
            },
          },
        });
      }

      if (type !== "") {
        pipeline.push({
          $match: {
            courseDetails: { $elemMatch: { courseType: type } },
          },
        });
      }

      if (courseName !== "") {
        pipeline.push({
          $match: {
            courseDetails: {
              $elemMatch: {
                courseName: { $regex: courseName, $options: "i" },
              },
            },
          },
        });
      }
      if (collegeName !== "") {
        pipeline.push({
          $match: { name: { $regex: collegeName, $options: "i" } },
        });
      }
      pipeline.push({
        $project: {
          _id: 1,
          name: 1,
          address: 1,
        },
      });
      const data = await collection.aggregate(pipeline).toArray();
      res.json(data);
    } catch (err) {
      console.error("Failed to fetch filtered data:", err);
      res.status(500).json({ error: "Failed to fetch filtered data" });
    }
  });

  app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  });
};

startServer();
