# Backend API Design & Integration Schemas

This document outlines the RESTful API endpoints and data schemas needed to integrate the AI Chatbot with the university's internal systems (SIS and LMS). These endpoints can be built using **Node.js (Express)** or **FastAPI**.

*Note: All endpoints assume that the user's identity is verified via a JWT token passed in the `Authorization: Bearer <token>` header. For these endpoints, the `studentId` or `userId` is extracted from the secure token rather than trusting a client parameter.*

---

## 1. Authentication & Core User Auth
Responsible for verifying students and staff.

### `POST /api/auth/login`
Authenticates a user and provisions a session/JWT.
- **Request Body:**
  ```json
  {
    "email": "student@university.edu",
    "password": "securepassword123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "jwt_token_string",
    "user": {
      "id": "STU-84920",
      "name": "Jane Doe",
      "email": "student@university.edu",
      "role": "student"
    }
  }
  ```

---

## 2. SIS (Student Information System) Integrations
Data related to academic records, registration, and administrative details.

### `GET /api/sis/profile`
Retrieves the student's core administrative profile.
- **Response (200 OK):**
  ```json
  {
    "studentId": "STU-84920",
    "major": "Computer Science",
    "year": "Sophomore",
    "academicStanding": "Good Standing",
    "advisor": "Dr. Alan Turing"
  }
  ```

### `GET /api/sis/academic-record`
Fetches GPA and credit history (used when the bot is asked "What is my GPA?").
- **Response (200 OK):**
  ```json
  {
    "cumulativeGpa": 3.84,
    "majorGpa": 3.90,
    "creditsAttempted": 60,
    "creditsEarned": 60
  }
  ```

### `GET /api/sis/registration`
Checks registration status, holds, and time tickets.
- **Response (200 OK):**
  ```json
  {
    "canRegister": true,
    "holds": [],
    "registrationWindow": {
      "start": "2026-11-01T08:00:00Z",
      "end": "2026-11-15T23:59:00Z"
    }
  }
  ```

---

## 3. LMS (Learning Management System) Integrations
Data related to active courses, schedules, assignments, and learning materials.

### `GET /api/lms/schedule`
Retrieves the student's current weekly class schedule.
- **Response (200 OK):**
  ```json
  {
    "term": "Fall 2026",
    "classes": [
      {
        "courseCode": "CS-101",
        "courseName": "Data Structures",
        "days": ["Mon", "Wed", "Fri"],
        "time": "10:00 AM - 10:50 AM",
        "location": "Building 4, Room 101"
      }
    ]
  }
  ```

### `GET /api/lms/assignments`
Fetches upcoming assignments and deadlines (used when the bot is asked "What's due this week?").
- **Query Parameters:** `?filter=upcoming`
- **Response (200 OK):**
  ```json
  {
    "assignments": [
      {
        "id": "A-1029",
        "courseCode": "CS-101",
        "title": "Linked Lists Implementation",
        "dueDate": "2026-05-20T23:59:00Z",
        "status": "pending",
        "weight": "15%"
      }
    ]
  }
  ```

### `GET /api/lms/materials/:courseId`
Retrieves course documents, syllabus, and lecture links for RAG (Retrieval-Augmented Generation) ingestion.
- **Response (200 OK):**
  ```json
  {
    "courseCode": "CS-101",
    "materials": [
      {
        "type": "lecture_slides",
        "title": "Week 4: Trees and Graphs",
        "url": "https://lms.university.edu/files/cs101_wk4.pdf",
        "lastUpdated": "2026-05-15T09:00:00Z"
      }
    ]
  }
  ```

---

## 4. NLP Bot Engine API
The primary conversational interface linking the frontend to the backend LLM orchestrator.

### `POST /api/chat`
Processes the student's query, fetches relevant context from SIS/LMS via RAG, and returns an AI response.
- **Request Body:**
  ```json
  {
    "message": "When is my next CS-101 assignment due?",
    "history": [
      {"sender": "user", "text": "Hi"},
      {"sender": "bot", "text": "Hello, how can I help you?"}
    ],
    "contextOverrides": {} 
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "reply": "Your next CS-101 assignment, 'Linked Lists Implementation', is due on May 20th at 11:59 PM. Would you like me to summarize the lecture slides for that topic?",
    "sources": ["LMS_Assignments", "CS101_Syllabus"]
  }
  ```

---

## 5. Staff Analytics Dashboard
Endpoints utilized strictly by staff accounts to monitor bot usage and student trends.

### `GET /api/analytics/overview`
- **Response (200 OK):**
  ```json
  {
    "activeStudents": 1204,
    "questionsAnswered": 8430,
    "avgResponseTimeMs": 1200
  }
  ```

### `GET /api/analytics/engagement-trends`
- **Response (200 OK):**
  ```json
  [
    { "date": "2026-05-10", "queries": 400 },
    { "date": "2026-05-11", "queries": 550 }
  ]
  ```

### `GET /api/analytics/topics`
- **Response (200 OK):**
  ```json
  [
    { "topic": "Calculus", "queries": 850 },
    { "topic": "Python Basics", "queries": 720 }
  ]
  ```
