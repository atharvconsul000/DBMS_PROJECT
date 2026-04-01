const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Course, Timetable, Fee } = require("../db/index");
const authenticateJWT = require("../middleware/auth");
const isAdmin = require("../middleware/admin");
require("dotenv").config();

function buildDemandNumber(student, semester, academicYear) {
  const studentRef = student.roll_no || String(student._id).slice(-6).toUpperCase();
  const yearRef = academicYear.replace(/\s+/g, "").toUpperCase();
  return `FEE-${yearRef}-SEM${semester}-${studentRef}`;
}

router.post("/signup", async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Admin already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const admin = new User({ first_name, last_name, email, password: hashed, role: "admin" });
    await admin.save();

    res.status(201).json({ message: "Admin registered", adminId: admin._id });
  } catch (err) {
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
});

router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, role: "admin" });
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Signin failed", error: err.message });
  }
});

router.post("/students", authenticateJWT, isAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, password, roll_no } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Student already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const student = new User({
      first_name,
      last_name,
      email,
      password: hashed,
      role: "student",
      roll_no
    });
    await student.save();

    res.status(201).json({ message: "Student added", student });
  } catch (err) {
    res.status(500).json({ message: "Failed to add student", error: err.message });
  }
});

router.post("/profs", authenticateJWT, isAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, password, employee_id } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Professor already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const prof = new User({
      first_name,
      last_name,
      email,
      password: hashed,
      role: "prof",
      employee_id
    });
    await prof.save();

    res.status(201).json({ message: "Professor added", prof });
  } catch (err) {
    res.status(500).json({ message: "Failed to add professor", error: err.message });
  }
});

router.get("/users", authenticateJWT, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to load users", error: err.message });
  }
});

router.get("/users/:id", authenticateJWT, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to load user", error: err.message });
  }
});

router.patch("/users/:id", authenticateJWT, isAdmin, async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    }

    const updated = await User.findByIdAndUpdate(req.params.id, payload, { new: true }).select("-password");
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User updated", user: updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating user", error: err.message });
  }
});

router.post("/courses", authenticateJWT, isAdmin, async (req, res) => {
  try {
    const { course_code, course_name, credits, professor } = req.body;
    const prof = await User.findOne({ _id: professor, role: "prof" });
    if (!prof) return res.status(400).json({ message: "Professor not found" });

    const course = new Course({ course_code, course_name, credits, professor });
    await course.save();
    res.status(201).json({ message: "Course added", course });
  } catch (err) {
    res.status(500).json({ message: "Failed to add course", error: err.message });
  }
});

router.patch("/courses/:id", authenticateJWT, isAdmin, async (req, res) => {
  try {
    if (req.body.professor) {
      const prof = await User.findOne({ _id: req.body.professor, role: "prof" });
      if (!prof) return res.status(400).json({ message: "Professor not found" });
    }

    const updated = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Course not found" });
    res.json({ message: "Course updated", course: updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating course", error: err.message });
  }
});

router.post("/timetable", authenticateJWT, isAdmin, async (req, res) => {
  try {
    const { course, day_of_week, start_time, end_time, room_no } = req.body;
    const existingCourse = await Course.findById(course);
    if (!existingCourse) return res.status(404).json({ message: "Course not found" });

    const timetable = new Timetable({ course, day_of_week, start_time, end_time, room_no });
    await timetable.save();
    res.status(201).json({ message: "Timetable created", timetable });
  } catch (err) {
    res.status(500).json({ message: "Failed to create timetable", error: err.message });
  }
});

router.patch("/timetable/:id", authenticateJWT, isAdmin, async (req, res) => {
  try {
    if (req.body.course) {
      const existingCourse = await Course.findById(req.body.course);
      if (!existingCourse) return res.status(404).json({ message: "Course not found" });
    }

    const updated = await Timetable.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Timetable not found" });
    res.json({ message: "Timetable updated", timetable: updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating timetable", error: err.message });
  }
});

router.post("/fees/generate", authenticateJWT, isAdmin, async (req, res) => {
  try {
    const { semester, academic_year, amount, due_date, remarks } = req.body;

    if (!semester || !academic_year || amount === undefined || !due_date) {
      return res.status(400).json({ message: "semester, academic_year, amount and due_date are required" });
    }

    const students = await User.find({ role: "student" }).select("_id roll_no first_name last_name");
    if (students.length === 0) {
      return res.status(404).json({ message: "No students found" });
    }

    const existingFees = await Fee.find({
      student: { $in: students.map((student) => student._id) },
      semester,
      academic_year
    }).select("student");

    const existingStudentIds = new Set(existingFees.map((fee) => String(fee.student)));
    const newFees = students
      .filter((student) => !existingStudentIds.has(String(student._id)))
      .map((student) => ({
        student: student._id,
        semester,
        academic_year,
        amount,
        due_date,
        remarks,
        generated_by: req.user.id,
        demand_number: buildDemandNumber(student, semester, academic_year)
      }));

    if (newFees.length === 0) {
      return res.json({ message: "Fee demand already exists for all students in this semester", createdCount: 0 });
    }

    await Fee.insertMany(newFees, { ordered: false });

    res.status(201).json({
      message: `Fee demand generated for ${newFees.length} students`,
      createdCount: newFees.length,
      skippedCount: students.length - newFees.length
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to generate fee demand", error: err.message });
  }
});

router.get("/fees", authenticateJWT, isAdmin, async (req, res) => {
  try {
    const fees = await Fee.find()
      .populate("student", "first_name last_name email roll_no")
      .sort({ createdAt: -1 });

    res.json(fees);
  } catch (err) {
    res.status(500).json({ message: "Failed to load fee records", error: err.message });
  }
});

router.patch("/fees/:feeId/fulfill", authenticateJWT, isAdmin, async (req, res) => {
  try {
    const paymentReference = req.body.payment_reference?.trim() || `ADMIN-${Date.now()}`;
    const fee = await Fee.findById(req.params.feeId);

    if (!fee) {
      return res.status(404).json({ message: "Fee record not found" });
    }

    if (fee.status === "paid") {
      return res.status(400).json({ message: "Fee demand is already fulfilled" });
    }

    fee.status = "paid";
    fee.paid_at = new Date();
    fee.payment_reference = paymentReference;
    fee.fulfilled_by = req.user.id;
    await fee.save();

    res.json({ message: "Fee demand fulfilled", fee });
  } catch (err) {
    res.status(500).json({ message: "Failed to fulfill fee demand", error: err.message });
  }
});

module.exports = router;
