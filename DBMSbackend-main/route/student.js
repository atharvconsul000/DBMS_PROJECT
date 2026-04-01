const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const PDFDocument = require("pdfkit");
const { User, Course, TakenCourse, Timetable, Announcement, Fee } = require("../db/index");
const authenticateJWT = require("../middleware/auth");
const isStudent = require("../middleware/student");
require("dotenv").config();

const KNOWN_SKILLS = [
  "JavaScript", "TypeScript", "React", "Node.js", "Express", "MongoDB", "Mongoose",
  "Python", "Java", "C++", "C", "SQL", "MySQL", "PostgreSQL", "HTML", "CSS",
  "Tailwind", "Git", "GitHub", "REST API", "Firebase", "Next.js", "Vite",
  "Machine Learning", "Data Structures", "Algorithms", "DBMS", "Operating Systems"
];

function parseDescription(description) {
  return description
    .split(/\n|[.;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferSkills(description) {
  const lowerDescription = description.toLowerCase();
  return KNOWN_SKILLS.filter((skill) => lowerDescription.includes(skill.toLowerCase()));
}

function buildResumeData(profilePayload) {
  const descriptionItems = parseDescription(profilePayload.student_description);
  const inferredSkills = inferSkills(profilePayload.student_description);

  return {
    summary: profilePayload.target_role
      ? `Student preparing for ${profilePayload.target_role} opportunities with coursework and project interests aligned to academic training.`
      : "Motivated student with active academic coursework and emerging technical experience.",
    skills: inferredSkills,
    experience: descriptionItems,
    coursework: profilePayload.academic_history
      .filter((item) => item.course_code && item.course_name)
      .map((item) => `${item.course_code} - ${item.course_name}${item.grade ? ` | Grade: ${item.grade}` : ""}${item.marks !== null ? ` | Marks: ${item.marks}` : ""}`),
  };
}

function addSectionHeading(doc, title) {
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(12.5).text(title);
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(10.5);
}

function addBulletList(doc, items) {
  items.forEach((item) => {
    doc.text(`• ${item}`, {
      align: "left",
      lineGap: 2
    });
  });
}

function writeResumePdf(doc, resumeData, profile) {
  doc.font("Helvetica-Bold").fontSize(20).text(`${profile.first_name} ${profile.last_name}`, { align: "center" });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(11).text(`${profile.email} | Roll No: ${profile.roll_no || "N/A"}`, { align: "center" });
  doc.moveDown(0.8);

  addSectionHeading(doc, "PROFESSIONAL SUMMARY");
  doc.text(resumeData.summary, { lineGap: 2 });

  addSectionHeading(doc, "EDUCATION");
  doc.text("Academic Portal Student", { lineGap: 2 });
  doc.text(`Roll Number: ${profile.roll_no || "N/A"}`, { lineGap: 2 });

  if (resumeData.coursework.length > 0) {
    addSectionHeading(doc, "RELEVANT COURSEWORK");
    addBulletList(doc, resumeData.coursework);
  }
  if (resumeData.skills.length > 0) {
    addSectionHeading(doc, "TECHNICAL SKILLS");
    doc.text(resumeData.skills.join(" | "), { lineGap: 2 });
  }

  if (resumeData.experience.length > 0) {
    addSectionHeading(doc, "PROJECTS AND EXPERIENCE");
    addBulletList(doc, resumeData.experience);
  }

  addSectionHeading(doc, "ADDITIONAL DETAILS");
  doc.text("Resume generated from student profile, registered coursework, and submitted description.", { lineGap: 2 });
}

router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    const student = await User.findOne({ email, role: "student" });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const valid = await bcrypt.compare(password, student.password);
    if (!valid) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: student._id, email: student.email, role: student.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Signin failed", error: err.message });
  }
});

router.post("/register-course/:courseId", authenticateJWT, isStudent, async (req, res) => {
  const studentId = req.user.id;
  const courseId = req.params.courseId;

  try {
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const existing = await TakenCourse.findOne({ student: studentId, course: courseId });
    if (existing) return res.status(400).json({ message: "Already registered in this course" });

    const taken = new TakenCourse({ student: studentId, course: courseId });
    await taken.save();

    res.status(201).json({ message: "Course registered", takenCourse: taken });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
});

router.get("/me", authenticateJWT, isStudent, async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select("-password");
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: "Failed to load profile", error: err.message });
  }
});

router.get("/my-courses", authenticateJWT, isStudent, async (req, res) => {
  try {
    const taken = await TakenCourse.find({ student: req.user.id })
      .populate({
        path: "course",
        populate: { path: "professor", select: "first_name last_name email employee_id" }
      });
    res.json(taken);
  } catch (err) {
    res.status(500).json({ message: "Failed to load registered courses", error: err.message });
  }
});

router.get("/available-courses", authenticateJWT, isStudent, async (req, res) => {
  try {
    const taken = await TakenCourse.find({ student: req.user.id }).select("course");
    const takenCourseIds = taken.map((item) => item.course);

    const courses = await Course.find({ _id: { $nin: takenCourseIds } })
      .populate("professor", "first_name last_name email employee_id")
      .sort({ course_code: 1 });

    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: "Failed to load available courses", error: err.message });
  }
});

router.get("/my-announcements", authenticateJWT, isStudent, async (req, res) => {
  try {
    const taken = await TakenCourse.find({ student: req.user.id }).select("course");
    const courseIds = taken.map((item) => item.course);

    const announcements = await Announcement.find({ course: { $in: courseIds } })
      .populate("course", "course_code course_name")
      .populate("professor", "first_name last_name email")
      .sort({ createdAt: -1 });

    res.json(announcements);
  } catch (err) {
    res.status(500).json({ message: "Failed to load announcements", error: err.message });
  }
});

router.get("/my-timetable", authenticateJWT, isStudent, async (req, res) => {
  try {
    const taken = await TakenCourse.find({ student: req.user.id }).select("course");
    const courseIds = taken.map((item) => item.course);

    const timetable = await Timetable.find({ course: { $in: courseIds } })
      .populate("course", "course_code course_name")
      .sort({ day_of_week: 1, start_time: 1 });

    res.json(timetable);
  } catch (err) {
    res.status(500).json({ message: "Failed to load timetable", error: err.message });
  }
});

router.get("/my-fees", authenticateJWT, isStudent, async (req, res) => {
  try {
    const now = new Date();
    await Fee.updateMany(
      { student: req.user.id, status: "pending", due_date: { $lt: now } },
      { $set: { status: "overdue" } }
    );

    const fees = await Fee.find({ student: req.user.id })
      .sort({ due_date: 1, createdAt: -1 });

    res.json(fees);
  } catch (err) {
    res.status(500).json({ message: "Failed to load fee details", error: err.message });
  }
});

router.post("/resume", authenticateJWT, isStudent, async (req, res) => {
  try {
    const { description = "", target_role = "" } = req.body;
    if (!description.trim()) {
      return res.status(400).json({ message: "Please provide details in the description box" });
    }

    const student = await User.findById(req.user.id).select("-password");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const enrollments = await TakenCourse.find({ student: req.user.id })
      .populate({
        path: "course",
        select: "course_code course_name credits",
        populate: { path: "professor", select: "first_name last_name" }
      })
      .sort({ updatedAt: -1 });

    const profilePayload = {
      student: {
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        roll_no: student.roll_no || "",
        target_role
      },
      academic_history: enrollments.map((item) => ({
        course_code: item.course?.course_code,
        course_name: item.course?.course_name,
        credits: item.course?.credits,
        professor: item.course?.professor
          ? `${item.course.professor.first_name} ${item.course.professor.last_name}`
          : "",
        marks: item.marks ?? null,
        grade: item.grade || ""
      })),
      student_description: description.trim()
    };

    const resumeData = buildResumeData(profilePayload);
    const doc = new PDFDocument({ margin: 42, size: "A4" });
    const safeName = `${student.first_name}-${student.last_name}`.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}-resume.pdf"`);

    doc.pipe(res);
    writeResumePdf(doc, resumeData, student);
    doc.end();
  } catch (err) {
    res.status(500).json({ message: "Failed to generate resume", error: err.message });
  }
});

router.patch("/fees/:feeId/fulfill", authenticateJWT, isStudent, async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.feeId, student: req.user.id });
    if (!fee) {
      return res.status(404).json({ message: "Fee record not found" });
    }

    if (fee.status === "paid") {
      return res.status(400).json({ message: "Fee demand is already fulfilled" });
    }

    fee.status = "paid";
    fee.paid_at = new Date();
    fee.payment_reference = `STU-${req.user.id.slice(-6).toUpperCase()}-${Date.now()}`;
    fee.fulfilled_by = req.user.id;
    await fee.save();

    res.json({ message: "Fee demand fulfilled successfully", fee });
  } catch (err) {
    res.status(500).json({ message: "Failed to fulfill fee demand", error: err.message });
  }
});

router.get("/fees/:feeId/receipt", authenticateJWT, isStudent, async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.feeId, student: req.user.id })
      .populate("student", "first_name last_name email roll_no");

    if (!fee) {
      return res.status(404).json({ message: "Fee record not found" });
    }

    const doc = new PDFDocument({ margin: 50 });
    const safeYear = fee.academic_year.replace(/[^a-zA-Z0-9_-]/g, "-");
    const filename = `fee-receipt-${safeYear}-sem-${fee.semester}.pdf`;
    const receiptTitle = fee.status === "paid" ? "Academic Portal Fee Payment Receipt" : "Academic Portal Fee Demand Notice";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    doc.pipe(res);
    doc.fontSize(20).text(receiptTitle, { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Demand Number: ${fee.demand_number}`);
    doc.text(`Student Name: ${fee.student.first_name} ${fee.student.last_name}`);
    doc.text(`Student Email: ${fee.student.email}`);
    doc.text(`Roll Number: ${fee.student.roll_no || "N/A"}`);
    doc.text(`Semester: ${fee.semester}`);
    doc.text(`Academic Year: ${fee.academic_year}`);
    doc.text(`Amount Due: INR ${fee.amount.toFixed(2)}`);
    doc.text(`Due Date: ${new Date(fee.due_date).toLocaleDateString("en-IN")}`);
    doc.text(`Status: ${fee.status.toUpperCase()}`);
    if (fee.payment_reference) {
      doc.text(`Payment Reference: ${fee.payment_reference}`);
    }
    if (fee.paid_at) {
      doc.text(`Paid On: ${new Date(fee.paid_at).toLocaleDateString("en-IN")}`);
    }
    if (fee.remarks) {
      doc.text(`Remarks: ${fee.remarks}`);
    }
    doc.moveDown();
    doc.text("This document is generated by the Academic Portal for official fee demand reference.");
    doc.end();
  } catch (err) {
    res.status(500).json({ message: "Failed to generate fee receipt", error: err.message });
  }
});

module.exports = router;
