import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

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

if (!process.env.GEMINI_API_KEY) {
  console.error("CRITICAL PRODUCTION ERROR: GEMINI_API_KEY is not defined.");
}

let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    console.log("INITIALIZATION: Gemini AI key detected. Initializing SDK...");
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } else {
    console.warn("INITIALIZATION_WARNING: Continuing without Gemini AI key. /api/chat will fail.");
  }
} catch (e) {
  console.error("INITIALIZATION_ERROR: Failed to initialize Google GenAI SDK:", e);
}

// Mock Databases
const USERS_DB: any[] = [];
const CHAT_SESSIONS_DB: any[] = [];
const SALT_ROUNDS = 10;

// SIS_DB is now a map keyed by email for easy lookup
const SIS_DB: Record<string, any> = {
  "demo@student.edu": {
    name: "Demo Student",
    studentId: "STU-84920",
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
    ],
    studyPlan: {
      totalCredits: 132,
      completedCredits: 60,
      completedCourses: [
        { code: "CS-100", name: "Introduction to CS", credits: 3 },
        { code: "MATH-101", name: "Calculus I", credits: 4 },
        { code: "ENG-101", name: "English Composition", credits: 3 },
        { code: "PHYS-101", name: "General Physics I", credits: 4 }
      ],
      currentCourses: [
        { code: "CS-101", name: "Data Structures", credits: 4 },
        { code: "MATH-202", name: "Calculus II", credits: 4 }
      ],
      remainingCourses: [
        { code: "CS-301", name: "Software Engineering", category: "Core" },
        { code: "CS-305", name: "Ethical Hacking", category: "Elective" },
        { code: "CS-401", name: "Operating Systems", category: "Core" }
      ]
    }
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
app.get("/api/sis/profile", authenticateToken, (req: any, res) => {
  const profile = SIS_DB[req.user.email] || {
    name: req.user.name,
    email: req.user.email,
    major: "Staff Account",
    year: "N/A"
  };
  res.json(profile);
});

app.get("/api/sis/study-plan", authenticateToken, (req: any, res) => {
  const profile = SIS_DB[req.user.email];
  if (!profile || !profile.studyPlan) {
    return res.status(404).json({ error: "Study plan not found for this student" });
  }
  res.json(profile.studyPlan);
});

app.get("/api/chat/sessions", authenticateToken, (req: any, res) => {
  const sessions = CHAT_SESSIONS_DB.filter(s => s.userId === req.user.email)
    .map(s => ({ id: s.id, title: s.title, lastUpdated: s.lastUpdated }));
  res.json(sessions);
});

app.get("/api/chat/sessions/:sessionId", authenticateToken, (req: any, res) => {
  const session = CHAT_SESSIONS_DB.find(s => s.id === req.params.sessionId && s.userId === req.user.email);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(session.messages);
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

app.post("/api/register", async (req, res) => {
  const { name, email, studentId, password } = req.body;

  if (!name || !email || !studentId || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const existingUser = USERS_DB.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: "Email already registered" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      studentId,
      password: hashedPassword,
      role: email.includes('staff') ? 'staff' : 'student'
    };

    USERS_DB.push(newUser);

    // Automatically provision a default academic profile for new students
    if (newUser.role === 'student') {
      SIS_DB[email] = {
        name: newUser.name,
        studentId: newUser.studentId,
        gpa: "N/A (New Student)",
        major: "Undeclared",
        year: "Freshman",
        academicStanding: "Good Standing",
        advisor: "Assigned upon enrollment",
        registered_courses: ["GEN-101 (Orientation)"],
        exam_schedule: [],
        studyPlan: {
          totalCredits: 132,
          completedCredits: 0,
          completedCourses: [],
          currentCourses: [{ code: "GEN-101", name: "Orientation", credits: 1 }],
          remainingCourses: [
            { code: "ENG-101", name: "English Composition", category: "Core" },
            { code: "MATH-101", name: "Calculus I", category: "Core" }
          ]
        }
      };
    }

    const tokenUser = {
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    };

    const token = jwt.sign(tokenUser, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: tokenUser });
  } catch (err) {
    res.status(500).json({ error: "Internal server error during registration" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = USERS_DB.find(u => u.email === email);
  
  if (user) {
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      const tokenUser = { name: user.name, email: user.email, role: user.role };
      const token = jwt.sign(tokenUser, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token, user: tokenUser });
    }
  }

  // Fallback for demo if USERS_DB is empty or user not found, 
  // but let's encourage registration by being stricter now.
  if (email === "demo@student.edu" && password === "password") {
    const demoUser = { name: "Demo User", email: "demo@student.edu", role: "student" };
    const token = jwt.sign(demoUser, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: demoUser });
  }

  res.status(401).json({ error: "Invalid email or password" });
});

app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  // Simulate email delivery and checking delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  res.json({ success: true, message: "If this email is registered, a password reset link has been sent to your inbox." });
});

app.post("/api/chat", authenticateToken, async (req: any, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API key is not configured." });
  }

  const { message, sessionId, calendarContext } = req.body;
  const lowercaseMsg = message.toLowerCase();
  const userProfile = SIS_DB[req.user.email];

  let session = CHAT_SESSIONS_DB.find(s => s.id === sessionId && s.userId === req.user.email);
  
  if (!session && !sessionId) {
    // Create new session if no sessionId provided
    session = {
      id: Date.now().toString(),
      userId: req.user.email,
      title: message.length > 30 ? message.substring(0, 30) + "..." : message,
      messages: [],
      lastUpdated: new Date().toISOString()
    };
    CHAT_SESSIONS_DB.push(session);
  } else if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // Intelligent Routing / Intent Classification
  let dynamicContext = "";
  if (calendarContext) {
    dynamicContext += `[GOOGLE CALENDAR DATA] Upcoming events from user's primary calendar: ${calendarContext}\n`;
  }
  let detectedIntent = "general";

  if (userProfile) {
    if (lowercaseMsg.includes("graduation") || lowercaseMsg.includes("credits") || lowercaseMsg.includes("finished") || lowercaseMsg.includes("plan") || lowercaseMsg.includes("left to graduate")) {
      detectedIntent = "sis_study_plan";
      dynamicContext = `[SIS DATA] Study Plan Progress: ${userProfile.studyPlan.completedCredits}/${userProfile.studyPlan.totalCredits} credits. Remaining Courses: ${JSON.stringify(userProfile.studyPlan.remainingCourses)}. Completed: ${JSON.stringify(userProfile.studyPlan.completedCourses)}`;
    } else if (lowercaseMsg.includes("gpa") || lowercaseMsg.includes("grade") || lowercaseMsg.includes("major")) {
      detectedIntent = "sis_profile";
      dynamicContext = `[SIS DATA] Student GPA: ${userProfile.gpa}, Major: ${userProfile.major}, Standing: ${userProfile.academicStanding}`;
    } else if (lowercaseMsg.includes("schedule") || lowercaseMsg.includes("exam") || lowercaseMsg.includes("hall") || lowercaseMsg.includes("time")) {
      detectedIntent = "sis_schedule";
      dynamicContext = `[SIS DATA] Exam Schedule: ${JSON.stringify(userProfile.exam_schedule)}`;
    } else if (lowercaseMsg.includes("deadline") || lowercaseMsg.includes("due") || lowercaseMsg.includes("assignment")) {
      detectedIntent = "lms_deadlines";
      dynamicContext = `[LMS DATA] Upcoming Deadlines: ${JSON.stringify(LMS_DB.deadlines)}`;
    } else if (lowercaseMsg.includes("material") || lowercaseMsg.includes("slides") || lowercaseMsg.includes("study guide") || lowercaseMsg.includes("resource")) {
      detectedIntent = "lms_materials";
      dynamicContext = `[LMS DATA] Available Materials: ${JSON.stringify(LMS_DB.materials)}`;
    } else if (lowercaseMsg.includes("course") || lowercaseMsg.includes("class") || lowercaseMsg.includes("registered")) {
      detectedIntent = "sis_courses";
      dynamicContext = `[SIS DATA] Registered Courses: ${userProfile.registered_courses.join(", ")}`;
    }
  }

  try {
    const history = session.messages.map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    if (!ai) {
      console.error("PRODUCTION ERROR: Missing GEMINI_API_KEY. AI initialization failed.");
      return res.status(500).json({ 
        error: "Neuro AI is currently offline. Please ensure the GEMINI_API_KEY is correctly set in the application secrets." 
      });
    }

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are Neuro, a helpful, concise AI teaching assistant for university students. 
Keep your responses well-formatted (use markdown) and professional, but enthusiastic.

CONTEXT INFORMATION:
- Current Student: ${req.user.name} (${userProfile?.studentId || "No ID"})
- User Email: ${req.user.email}
${userProfile ? `- Major: ${userProfile.major} (${userProfile.year})` : ""}
${dynamicContext ? `REAL-TIME DATA FETCHED FOR QUERY (${detectedIntent}): ${dynamicContext}` : "No specific SIS/LMS data requested for this turn."}

Always prioritize answering using the REAL-TIME DATA if it is provided. If the user asks about something not in the context, be honest but helpful.`,
      },
      history: history
    });

    const result = await chat.sendMessage({ message });
    const reply = result.text;

    // Save to session
    session.messages.push({ id: Date.now().toString(), text: message, sender: 'user', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    session.messages.push({ id: (Date.now()+1).toString(), text: reply, sender: 'ai', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), intent: detectedIntent });
    session.lastUpdated = new Date().toISOString();

    res.json({ reply, intent: detectedIntent, sessionId: session.id });
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
