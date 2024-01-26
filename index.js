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
      const uniqueFilterOptions = await db
        .collection("uniqueFilterOptions")
        .find({})
        .toArray();
      res.json({ uniqueFilterOptions });
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
        {
          $project: {
            html: 0,
          },
        },
        {
          $addFields: {
            numberOfCourses: { $size: "$courseDetails" },
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
          numberOfCourses: 1,
        },
      });
      let data = await collection
        .aggregate(pipeline, { allowDiskUse: true })
        .toArray();
      data = data.sort((a, b) => -(a.numberOfCourses - b.numberOfCourses));
      res.json(data);
    } catch (err) {
      console.error("Failed to fetch filtered data:", err);
      res.status(500).json({ error: "Failed to fetch filtered data" });
    }
  });

  app.get("/courses/:id", async (req, res) => {
    try {
      const collection = db.collection("courses");
      const pipeline = [
        {
          $match: {
            _id: new ObjectId(req.params.id),
          },
        },
        {
          $project: {
            _id: 1,
            html: 1,
          },
        },
      ];
      const course = await collection.aggregate(pipeline).toArray();
      if (course.length > 0) {
        res.json(course[0]);
      } else {
        res.status(404).json({ error: "Course not found" });
      }
    } catch (err) {
      console.error("Failed to fetch course:", err);
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  app.get("/scholarships/:id", async (req, res) => {
    try {
      const collection = db.collection("scholarships");
      const pipeline = [
        {
          $match: {
            _id: new ObjectId(req.params.id),
          },
        },
        {
          $project: {
            _id: 1,
            html: 1,
          },
        },
      ];
      const scholarship = await collection.aggregate(pipeline).toArray();
      if (scholarship.length > 0) {
        res.json(scholarship[0]);
      } else {
        res.status(404).json({ error: "Scholarship not found" });
      }
    } catch (err) {
      console.error("Failed to fetch scholarship:", err);
      res.status(500).json({ error: "Failed to fetch scholarship" });
    }
  });

  app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  });
};

startServer();
