import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_demo";

const app = express();
app.use(express.json());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

const PORT = 3000;

let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
} catch (e) {
  console.warn("Failed to initialize Google GenAI SDK", e);
}

// Mock Databases
const SIS_DB = {
  student: {
    id: "STU-84920",
    name: "Jane Doe",
    gpa: 3.84,
    major: "Computer Science",
    year: "Sophomore",
    academicStanding: "Good Standing",
    advisor: "Dr. Alan Turing",
    registered_courses: ["CS-101 (Data Structures)", "MATH-202 (Calculus II)", "BIO-101 (Intro to Biology)"],
    exam_schedule: [
      { course: "CS-101", date: "June 15th, 2026", time: "9:00 AM", location: "Hall A" },
      { course: "MATH-202", date: "June 18th, 2026", time: "1:00 PM", location: "Room 302" },
      { course: "BIO-101", date: "June 20th, 2026", time: "10:30 AM", location: "Auditorium" }
    ]
  }
};

const LMS_DB = {
  deadlines: [
    { course: "CS-101", task: "Linked Lists Implementation", due: "May 20th, 2026" },
    { course: "MATH-202", task: "Multivariable Calculus Problem Set", due: "May 22nd, 2026" },
    { course: "BIO-101", task: "Lab Report: Mitosis", due: "May 25th, 2026" }
  ],
  materials: [
    { course: "CS-101", title: "Week 4: Trees and Graphs Slides", type: "PDF", link: "/materials/cs101-w4.pdf" },
    { course: "CS-101", title: "Sorting Algorithms Visualizer", type: "Link", link: "https://visualgo.net" },
    { course: "BIO-101", title: "Chapter 5: Genetics Study Guide", type: "DOCX", link: "/materials/bio-ch5.docx" }
  ]
};

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token." });
    req.user = user;
    next();
  });
};

// API Routes
app.get("/api/sis/profile", authenticateToken, (req, res) => {
  res.json(SIS_DB.student);
});

app.post("/api/admin/trigger-notif", authenticateToken, (req, res) => {
  const { title, message, type } = req.body;
  const notification = {
    id: Date.now().toString(),
    title: title || "Urgent Update",
    message: message || "A new notification has been triggered.",
    time: "Just now",
    read: false,
    type: type || "urgent"
  };
  
  io.emit("notification:new", notification);
  res.json({ success: true, notification });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    const user = { 
      name: email.split('@')[0], 
      email, 
      role: email.includes('staff') ? 'staff' : 'student' 
    };
    
    // Sign a real JWT
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ token, user });
  } else {
    res.status(400).json({ error: "Invalid credentials" });
  }
});

app.post("/api/chat", authenticateToken, async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API key is not configured." });
  }

  const { message, history } = req.body;
  const lowercaseMsg = message.toLowerCase();

  // Intelligent Routing / Intent Classification
  let dynamicContext = "";
  let detectedIntent = "general";

  if (lowercaseMsg.includes("gpa") || lowercaseMsg.includes("grade") || lowercaseMsg.includes("major")) {
    detectedIntent = "sis_profile";
    dynamicContext = `[SIS DATA] Student GPA: ${SIS_DB.student.gpa}, Major: ${SIS_DB.student.major}, Standing: ${SIS_DB.student.academicStanding}`;
  } else if (lowercaseMsg.includes("schedule") || lowercaseMsg.includes("exam") || lowercaseMsg.includes("hall") || lowercaseMsg.includes("time")) {
    detectedIntent = "sis_schedule";
    dynamicContext = `[SIS DATA] Exam Schedule: ${JSON.stringify(SIS_DB.student.exam_schedule)}`;
  } else if (lowercaseMsg.includes("deadline") || lowercaseMsg.includes("due") || lowercaseMsg.includes("assignment")) {
    detectedIntent = "lms_deadlines";
    dynamicContext = `[LMS DATA] Upcoming Deadlines: ${JSON.stringify(LMS_DB.deadlines)}`;
  } else if (lowercaseMsg.includes("material") || lowercaseMsg.includes("slides") || lowercaseMsg.includes("study guide") || lowercaseMsg.includes("resource")) {
    detectedIntent = "lms_materials";
    dynamicContext = `[LMS DATA] Available Materials: ${JSON.stringify(LMS_DB.materials)}`;
  } else if (lowercaseMsg.includes("course") || lowercaseMsg.includes("class") || lowercaseMsg.includes("registered")) {
    detectedIntent = "sis_courses";
    dynamicContext = `[SIS DATA] Registered Courses: ${SIS_DB.student.registered_courses.join(", ")}`;
  }

  try {
    const formattedHistory = (history || [])
      .filter((msg: any) => msg.text && msg.id !== '1')
      .map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: `You are Neuro, a helpful, concise AI teaching assistant for university students. 
Keep your responses well-formatted (use markdown) and professional, but enthusiastic.

CONTEXT INFORMATION:
- Current Student: ${SIS_DB.student.name} (${SIS_DB.student.id})
${dynamicContext ? `REAL-TIME DATA FETCHED (${detectedIntent}): ${dynamicContext}` : "No specific SIS/LMS data requested for this turn."}

Always prioritize answering using the REAL-TIME DATA if it is provided. If the user asks about something not in the context, be honest but helpful.`,
      },
      history: formattedHistory
    });

    const result = await chat.sendMessage({ message });
    res.json({ reply: result.text, intent: detectedIntent });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message || "Failed to generate response" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
