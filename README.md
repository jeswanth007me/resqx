# 🚑 ResQX — Smart Emergency Traffic Management System

> **Predict. Coordinate. Prioritize. Save Time.**

ResQX is a **Smart Emergency Traffic Management System** designed to create a predictive emergency corridor for ambulances.

The system continuously monitors ambulance telemetry, predicts its arrival at upcoming traffic signals, evaluates traffic conditions, and coordinates signal priority so that the ambulance can move through intersections with minimum unnecessary delay.

The goal is to transform emergency traffic management from a **reactive process** into a **predictive and coordinated system**.

---

## 🏆 Project

**Project Name:** ResQX
**Full Name:** Smart Emergency Traffic Management System
**Domain:** Smart Transportation / Emergency Response
**Category:** Intelligent Traffic Management
**Platform:** Web-based Emergency Operations Command Center

---

# 🚨 1. Problem Statement

Emergency vehicles such as ambulances can lose critical time because of:

* 🚦 Red traffic signals
* 🚗 Vehicle congestion
* 🛣️ Uncoordinated intersections
* ⏱️ Unpredictable travel time
* 👮 Manual intervention by traffic police
* 🔴 Signals being changed only after the ambulance reaches the junction
* 🔄 Lack of coordination between multiple upcoming signals

Traditional traffic signal systems generally operate independently and are not designed to continuously predict an approaching emergency vehicle.

Even a short delay at several intersections can accumulate into significant additional travel time.

### The Core Problem

> **How can traffic signals prepare for an approaching ambulance before it reaches each intersection?**

---

# 💡 2. Our Solution

ResQX creates a **predictive emergency corridor** for an ambulance.

Instead of waiting for the ambulance to reach a junction, ResQX:

```text
Ambulance Detected
       ↓
Read Telemetry
       ↓
Calculate Route
       ↓
Calculate ETA
       ↓
Predict Upcoming Signal
       ↓
Evaluate Traffic Conditions
       ↓
Request Emergency Priority
       ↓
Safety Validation
       ↓
Prepare Traffic Signal
       ↓
Ambulance Passes
       ↓
Restore Normal Signal
```

This allows the system to coordinate emergency movement while maintaining controlled and safe signal transitions.

---

# 🎯 3. Key Objectives

ResQX is designed to:

* 🚑 Reduce ambulance delays
* 🧠 Predict ambulance arrival
* 🚦 Coordinate traffic signals
* 📍 Track ambulance position
* ⏱️ Calculate estimated arrival time
* 🚗 Consider traffic conditions
* 🛡️ Validate emergency signal transitions
* 🔄 Automatically restore normal traffic operation
* 📊 Provide a real-time command-center interface
* 🧪 Demonstrate the complete emergency scenario through simulation

---

# ✨ 4. Key Features

## 🚑 Emergency Ambulance Tracking

The system monitors:

* Ambulance ID
* Current position
* Speed
* Destination
* Emergency status
* Current road
* Upcoming signal
* Remaining distance
* ETA

---

## 🧭 Predictive Route Management

ResQX maintains the ambulance's route and identifies the next traffic signal that requires preparation.

Example:

```text
AMB-01
   ↓
SIG-01
   ↓
SIG-02
   ↓
SIG-03
   ↓
HOSPITAL
```

---

## ⏱️ ETA-Based Decision Making

The decision engine evaluates ambulance ETA before requesting signal priority.

The system uses a deterministic threshold-based approach so that decisions remain:

* Explainable
* Predictable
* Testable
* Easy to audit

---

## 🚦 Emergency Signal Priority

Signals move through controlled emergency states instead of switching randomly.

Example lifecycle:

```text
NORMAL
   ↓
PREPARING
   ↓
PRIORITY
   ↓
PASSING
   ↓
RESTORING
   ↓
NORMAL
```

---

## 🛡️ Safety Validation

Before an emergency signal transition is executed, the safety layer validates whether the requested transition is allowed.

This prevents unsafe or conflicting signal operations.

---

## 🚗 Traffic Awareness

The telemetry layer contains traffic information such as:

* Vehicle count
* Queue length
* Congestion level
* Signal state
* Distance from ambulance

Congestion levels are represented as:

```text
LOW
MODERATE
HIGH
```

---

# 🧠 5. Decision Engine

ResQX uses a **deterministic and explainable decision engine**.

The system does not blindly trigger an emergency signal.

It evaluates the current telemetry and determines the appropriate action.

### Example Decision Flow

```text
Read Telemetry
      ↓
Is ambulance in emergency state?
      ↓
Identify next signal
      ↓
Does signal exist?
      ↓
Validate ETA
      ↓
Is ETA within priority threshold?
      ↓
Check current signal state
      ↓
Request emergency priority
```

Possible decisions include:

```text
NO_ACTION
REQUEST_PRIORITY
RESTORE_SIGNAL
```

This architecture makes the decision process transparent and suitable for emergency operations where explainability is important.

---

# 🛡️ 6. Safety State Machine

Emergency signal control follows a controlled state machine.

### Allowed transitions

```text
NORMAL / RED / GREEN
          ↓
      PREPARING
          ↓
       PRIORITY
          ↓
       PASSING
          ↓
      RESTORING
          ↓
        NORMAL
```

The safety validator prevents invalid transitions.

It also checks for conflicts such as another emergency signal already being in a high-priority state.

---

# 🚦 7. Signal Controller

The signal controller manages the timing of emergency states.

Example timing stages:

| State     | Purpose                          |
| --------- | -------------------------------- |
| PREPARING | Prepare intersection             |
| PRIORITY  | Give emergency priority          |
| PASSING   | Allow ambulance movement         |
| RESTORING | Return traffic control to normal |
| NORMAL    | Regular traffic operation        |

The controller uses controlled timers instead of instant state changes.

This provides a more realistic emergency corridor simulation.

---

# 🧪 8. Emergency Simulation

ResQX contains a simulation engine that demonstrates the complete ambulance journey.

### Demo Scenario

```text
INITIAL EMERGENCY RUN
        ↓
AMB-01 STAGED
        ↓
ROAD-01
        ↓
SIG-01
        ↓
ROAD-02
        ↓
SIG-02
        ↓
ROAD-03
        ↓
SIG-03
        ↓
HOSPITAL
        ↓
AMBULANCE ARRIVED
```

The simulation tracks:

* Ambulance position
* Route progress
* Current road
* Current signal
* Vehicle movement
* Signal states
* Simulation time

---

# 🖥️ 9. Frontend

The frontend provides the **Emergency Operations Command Center (EOCC)** interface.

### Frontend responsibilities

* 🚑 Ambulance monitoring
* 🚦 Signal monitoring
* 🗺️ Route visualization
* 📊 Traffic information
* 🧠 Decision recommendations
* 📜 Emergency event timeline
* 🎮 Simulation controls
* 📈 Operational status
* 🚨 Emergency corridor visualization

---

# 🎨 Frontend Technology Stack

| Technology                | Purpose                           |
| ------------------------- | --------------------------------- |
| **React**                 | UI framework                      |
| **TypeScript**            | Type-safe frontend development    |
| **Vite**                  | Development server and build tool |
| **Tailwind CSS**          | UI styling                        |
| **React Hooks**           | Component state and lifecycle     |
| **TypeScript Interfaces** | Strong data contracts             |
| **Lucide / UI Icons**     | Interface icons                   |
| **CSS / Responsive UI**   | Dashboard presentation            |

The repository's current frontend package uses React 19, TypeScript, Vite, Tailwind CSS and related frontend tooling. ([GitHub][1])

---

# ⚙️ 10. Backend

The backend acts as the system coordination layer.

### Backend responsibilities

* Receive telemetry
* Process emergency events
* Calculate decisions
* Manage signal state
* Validate safety transitions
* Communicate with the memory layer
* Provide APIs to the frontend
* Maintain emergency scenario state

### Backend Technology

```text
Python
   ↓
FastAPI
   ↓
Decision Engine
   ↓
Safety Validator
   ↓
Signal Controller
   ↓
Hindsight Memory
```

---

# 🐍 11. Python

Python is used for the backend and intelligent decision-processing components.

Python provides:

* Fast development
* Strong API ecosystem
* Easy integration with AI systems
* Clear business logic
* Easy testing and debugging

---

# ⚡ 12. FastAPI

FastAPI provides the backend REST API layer.

Example API responsibilities:

```text
/api/health
/api/negotiations
/api/...
```

For ResQX, the backend API provides communication between the dashboard and the emergency management logic.

FastAPI also provides automatic API documentation and validation through Python type definitions.

---

# 🧠 13. Hindsight Memory

ResQX integrates **Hindsight** as a memory layer.

The purpose is to retain and retrieve relevant historical information that can support the system's decision workflow.

The integration supports operations such as:

```text
RETAIN
   ↓
RECALL
   ↓
REFLECT
```

This allows the system to maintain contextual information rather than treating every interaction as completely isolated.

---

# 🔄 14. System Architecture

```text
                    ┌─────────────────────┐
                    │     Ambulance       │
                    │      Telemetry      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Telemetry Layer   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Decision Engine   │
                    │                     │
                    │ ETA + Route +       │
                    │ Signal + Emergency  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Safety Validator   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Signal Controller  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Traffic Simulation  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Emergency Dashboard │
                    │       / EOCC        │
                    └─────────────────────┘

                         ↕
                  Hindsight Memory
```

---

# 🔗 15. End-to-End Workflow

The complete ResQX workflow is:

### Step 1 — Emergency Detected

An ambulance is marked as an emergency vehicle.

### Step 2 — Telemetry Collected

The system reads:

* Position
* Speed
* Route
* Destination
* ETA
* Signal information
* Traffic information

### Step 3 — Upcoming Signal Identified

The decision engine identifies the next relevant traffic signal.

### Step 4 — ETA Evaluated

The system determines how soon the ambulance will reach the signal.

### Step 5 — Emergency Priority Requested

If the conditions require intervention, the system requests signal priority.

### Step 6 — Safety Validation

The requested transition is checked against the safety state machine.

### Step 7 — Signal Preparation

The signal enters:

```text
PREPARING
```

### Step 8 — Emergency Priority

The signal transitions into:

```text
PRIORITY
```

### Step 9 — Ambulance Passage

The ambulance passes through the intersection.

### Step 10 — Restoration

The system transitions the signal toward:

```text
RESTORING
```

### Step 11 — Normal Operation

The signal returns to:

```text
NORMAL
```

### Step 12 — Hospital Arrival

The simulation marks the ambulance as:

```text
ARRIVED
```

---

# 📡 16. Telemetry Model

ResQX uses structured telemetry.

Example:

```typescript
Telemetry {
    timestamp
    ambulance {
        id
        position
        speed
        destination
        eta
        emergencyStatus
    }

    route {
        currentRoad
        nextSignal
        remainingDistance
    }

    signals [
        {
            id
            state
            distanceFromAmbulance
            queueLength
        }
    ]

    traffic {
        vehicleCount
        congestionLevel
    }
}
```

This provides a consistent contract between simulation, decision-making and signal control.

---

# 🧩 17. Major Software Components

```text
src/
│
├── decision/
│   └── decisionEngine
│
├── safety/
│   └── safetyValidator
│
├── signal/
│   └── signalController
│
├── simulation/
│   └── simulationEngine
│
├── state/
│   └── application state
│
└── types/
    └── telemetry
    └── simulation
```

---

# 🛠️ 18. Tools & Technologies

## Frontend

* ⚛️ React
* 🔷 TypeScript
* ⚡ Vite
* 🎨 Tailwind CSS
* 🧩 React Hooks
* 🖼️ CSS
* 🔍 TypeScript type system

## Backend

* 🐍 Python
* ⚡ FastAPI
* 🔗 REST APIs
* 🧠 Decision Engine
* 🛡️ Safety Validation Layer
* 🚦 Signal Controller

## Intelligence & Memory

* 🧠 Hindsight
* 📊 Telemetry processing
* ⏱️ ETA-based decision logic
* 🧭 Route analysis
* 🔄 Context retention and retrieval

## Simulation

* 🚑 Ambulance simulation
* 🚦 Traffic signal state machine
* 🚗 Vehicle movement simulation
* 🛣️ Road network simulation
* ⏱️ Simulation clock
* 📍 Route progress tracking

## Development Tools

* Git
* GitHub
* npm
* TypeScript Compiler
* Vite
* Oxlint
* VS Code

## Deployment

* GitHub for source-code hosting
* Vercel for frontend deployment
* Backend deployment can be hosted independently as a FastAPI service
* Environment variables are used for deployment configuration

---

# 🔐 19. Security & Reliability

ResQX follows a controlled architecture for emergency operations.

Important principles include:

* ✅ Type-safe telemetry
* ✅ Controlled signal transitions
* ✅ Deterministic decision logic
* ✅ Validation before priority activation
* ✅ No unrestricted signal switching
* ✅ Separation of decision and execution
* ✅ Environment-based configuration
* ✅ Secrets kept outside source code

---

# 📊 20. Why Explainable Decisions?

Emergency traffic management is a safety-sensitive application.

Therefore, the system should be able to answer:

> **Why was emergency priority requested?**

Instead of relying on an opaque decision, ResQX can evaluate explicit conditions such as:

```text
Emergency Active
       +
Upcoming Signal Exists
       +
Valid ETA
       +
ETA Within Threshold
       +
Signal Available
       =
REQUEST PRIORITY
```

This makes the system easier to:

* Debug
* Demonstrate
* Test
* Audit
* Explain to operators

---

# 🚀 21. Getting Started

### Prerequisites

Install:

* Node.js
* npm
* Python 3.x
* Git

---

## Clone Repository

```bash
git clone https://github.com/jeswanth007me/resqx.git
cd resqx
```

---

## Frontend Setup

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Build production version:

```bash
npm run build
```

Run linting:

```bash
npm run lint
```

---

# ⚙️ 22. Environment Configuration

Production configuration should be provided through environment variables.

Example categories include:

```text
API URL
HINDSIGHT BASE URL
HINDSIGHT BANK ID
HINDSIGHT API KEY
FRONTEND ORIGIN
HOST
PORT
```

> **Never commit API keys, tokens, passwords or other secrets to GitHub.**

---

# 🧪 23. Demo Scenario

The primary demonstration scenario is:

```text
🚨 START EMERGENCY
        ↓
🚑 Ambulance detected
        ↓
📍 Route calculated
        ↓
⏱️ ETA calculated
        ↓
🚦 Upcoming signal identified
        ↓
🧠 Decision engine evaluates situation
        ↓
🛡️ Safety validator checks transition
        ↓
🟡 Signal preparing
        ↓
🟢 Emergency priority activated
        ↓
🚑 Ambulance passes
        ↓
🔄 Signal restoration
        ↓
🚦 Normal traffic operation
        ↓
🏥 Ambulance reaches hospital
```

---

# 🎯 24. Expected Impact

ResQX is designed to demonstrate how intelligent traffic coordination can support emergency vehicle movement.

Potential benefits include:

* 🚑 Faster emergency corridor preparation
* ⏱️ Reduced waiting at intersections
* 🚦 Coordinated signal management
* 🧠 Predictive rather than purely reactive intervention
* 🛡️ Safer signal-state transitions
* 📊 Better visibility for traffic operators
* 🔄 Automated restoration of normal traffic

---

# 🔮 25. Future Scope

Possible future improvements include:

### 🤖 Advanced AI Prediction

Use machine learning models to predict:

* Traffic congestion
* Travel time
* Signal arrival
* Route delays

### 🗺️ Real-Time Maps

Integrate live map and traffic data.

### 🚦 Multi-Intersection Coordination

Coordinate multiple traffic signals simultaneously along the emergency route.

### 🚑 Multiple Emergency Vehicles

Support multiple ambulances and emergency vehicles operating simultaneously.

### 📡 IoT Integration

Connect real-world traffic controllers and roadside devices.

### 👮 Traffic Police Integration

Provide operators with alerts and manual override controls.

### ☁️ Cloud Infrastructure

Deploy the complete system as a scalable cloud service.

### 📈 Historical Analytics

Use stored emergency journeys to analyze:

* Average response time
* Intersection delays
* Traffic patterns
* Signal performance

---

# 🏗️ 26. Design Principles

ResQX follows these principles:

### Predictive

Prepare traffic infrastructure **before** the ambulance arrives.

### Explainable

Decisions are based on explicit and understandable rules.

### Safe

Signal transitions are validated before execution.

### Modular

Telemetry, decision-making, safety and signal control are separated.

### Observable

The command center provides visibility into the emergency process.

### Extensible

The architecture can be extended toward real-world traffic infrastructure.

---

# 👥 27. Team

**Team:** TechVista

**Project:** ResQX — Smart Emergency Traffic Management System

**Hackathon:** Smart India Hackathon 2026

---

# 📜 28. Project Status

🚧 **Hackathon Prototype / Demonstration System**

ResQX currently demonstrates the complete emergency traffic-management workflow through a controlled software simulation and command-center interface.

The system is intended as a technology prototype and would require integration with certified traffic-control infrastructure, real-world telemetry and appropriate safety validation before any real-world deployment.

---

# 📄 29. License

This project is developed as a hackathon project.

Add an appropriate open-source license to this repository if the team decides to distribute the source code publicly.

---

# 🔗 30. Repository

**GitHub:**
[ResQX GitHub Repository](https://github.com/jeswanth007me/resqx?utm_source=chatgpt.com)

---

## 🚑 ResQX

> **“Don't wait for the ambulance to reach the signal. Prepare the signal before the ambulance arrives.”**

**Predict. Coordinate. Prioritize. Save Time.**

[1]: https://github.com/disaster-response-sl/resq/blob/main/README.md?utm_source=chatgpt.com "resq/README.md at main · disaster-response-sl/resq · GitHub"
