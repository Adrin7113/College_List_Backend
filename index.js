const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const cors = require("cors");
require("dotenv").config();
const { ObjectId } = require("mongodb");

const connectToDb = async () => {
  const client = new MongoClient(process.env.MONGO_URI);

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

  async function getCollegeCountByCountry(country) {
    try {
      const collection = db.collection("colleges");
      const pipeline = [
        {
          $match: {
            country: country,
          },
        },
        {
          $count: "count",
        },
      ];
      const result = await collection.aggregate(pipeline).toArray();
      return result[0].count;
    } catch (err) {
      console.error("Failed to fetch college count:", err);
      throw new Error("Failed to fetch college count");
    }
  }

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
            let: { idString: "$idString" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$collegeId", "$$idString"],
                  },
                },
              },
              {
                $project: {
                  html: 0,
                },
              },
            ],
            as: "courseDetails",
          },
        },
        {
          $lookup: {
            from: "scholarships",
            let: { idString: "$idString" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$collegeId", "$$idString"],
                  },
                },
              },
              {
                $project: {
                  html: 0,
                },
              },
            ],
            as: "scholarshipDetails",
          },
        },
      ];
      const college = await collection.aggregate(pipeline).toArray();
      const currencyUrl = `https://api.freecurrencyapi.com/v1/latest?apikey=${process.env.CURRENCY_API_KEY}&currencies=&base_currency=INR`;
      let response = await fetch(currencyUrl);
      response = await response.json();
      currencyConversion = response.data;
      if (college.length > 0) {
        res.json({ college: college[0], currencyConversion });
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
    const page = req.query.page;
    try {
      const collection = db.collection("colleges");

      let pipeline = [
        {
          $match: {
            country: country,
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
          $addFields: {
            numberOfCourses: { $size: "$courseDetails" },
          },
        },
        {
          $project: {
            html: 0,
          },
        },
      ];

      let conditionArray = [];

      if (program !== "") {
        conditionArray.push({ $eq: ["$$course.program", program] });
      }

      if (type !== "") {
        conditionArray.push({ $eq: ["$$course.courseType", type] });
      }

      if (courseName !== "") {
        conditionArray.push({
          $regexMatch: {
            input: "$$course.courseName",
            regex: courseName,
            options: "i",
          },
        });
      }

      pipeline.push({
        $addFields: {
          courseDetails: {
            $filter: {
              input: "$courseDetails",
              as: "course",
              cond: { $and: conditionArray },
            },
          },
        },
      });

      if (collegeName !== "") {
        pipeline.push({
          $match: { name: { $regex: collegeName, $options: "i" } },
        });
      }

      pipeline.push({
        $unwind: {
          path: "$courseDetails",
          preserveNullAndEmptyArrays: false,
        },
      });

      pipeline.push({
        $project: {
          _id: 1,
          name: 1,
          address: 1,
          numberOfCourses: 1,
          courseName: "$courseDetails.courseName",
        },
      });

      let countPipeline = [...pipeline];

      countPipeline.push({
        $count: "totalColleges",
      });

      pipeline.push({
        $skip:
          program === "" &&
          type === "" &&
          courseName === "" &&
          collegeName === ""
            ? (page - 1) * 20
            : (page - 1) * 50,
      });

      pipeline.push({
        $limit:
          program === "" &&
          type === "" &&
          courseName === "" &&
          collegeName === ""
            ? 20
            : 50,
      });
      let totalCount = await collection.aggregate(countPipeline).toArray();
      if (totalCount.length === 0) {
        totalCount = 0;
      } else {
        totalCount = totalCount[0].totalColleges;
      }
      let data = await collection
        .aggregate(pipeline, { allowDiskUse: true })
        .toArray();
      data = data.sort((a, b) => -(a.numberOfCourses - b.numberOfCourses));
      res.json({ data, totalCount });
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
