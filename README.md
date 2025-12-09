# Family Budget Management App 💰

A comprehensive web application for tracking and managing family expenses with multi-user support, beautiful UI, and mobile-first design.

## ✨ Features

- 🔐 **User Authentication** - Separate logins for family members
- 💸 **Transaction Tracking** - Income and expenses with categories
- 🔒 **Private Transactions** - Mark transactions as private (visible only to creator)
- 📊 **Budget Goals** - Set limits per category with visual progress
- 🔄 **Recurring Expenses** - Auto-track monthly bills and subscriptions
- 📈 **Reports & Analytics** - Interactive charts and visualizations
- 📥 **Data Export** - Export to CSV for backup/analysis
- 📱 **PWA Support** - Install on Android like a native app
- 🌙 **Dark Mode** - Beautiful, eye-friendly dark theme
- ✨ **Premium UI** - World-class animations and UX

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Docker (for local database)
- npm or yarn

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Start the local database:
```bash
npm run db:setup
```

4. Run the development server:
```bash
npm run dev
```

5. Open your browser:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## 📁 Project Structure

```
budget-app/
├── client/          # React frontend (Vite)
├── server/          # Node.js backend (Express)
├── docker-compose.yml
├── DEPLOYMENT.md    # Oracle Cloud deployment guide
└── README.md
```

## 🌐 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on deploying to Oracle Cloud Always Free Tier.

## 🛠️ Tech Stack

**Frontend:**
- React + Vite
- Chart.js for visualizations
- Progressive Web App (PWA)
- World-class CSS with animations

**Backend:**
- Node.js + Express
- PostgreSQL database
- JWT authentication
- bcrypt for password hashing

**Deployment:**
- Docker containerization
- Oracle Cloud Always Free Tier
- Autonomous Database

## 📱 Mobile Installation

1. Open the app URL in Chrome/Firefox on Android
2. Tap the menu (⋮) and select "Add to Home Screen"
3. The app icon will appear on your home screen
4. Tap to open - runs like a native app!

## 🤝 Contributing

This is a family project. Feel free to suggest features or improvements!

## 📄 License

Private family use.
