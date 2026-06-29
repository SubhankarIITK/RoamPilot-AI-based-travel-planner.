roampilot/
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   └── cloudinary.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── TravelProfile.js
│   │   │   ├── Trip.js
│   │   │   ├── TripVersion.js
│   │   │   ├── ChatMessage.js
│   │   │   ├── Document.js
│   │   │   ├── Expense.js
│   │   │   ├── ChecklistItem.js
│   │   │   ├── SharedTrip.js
│   │   │   ├── EmergencyInfo.js
│   │   │   ├── TripMemory.js
│   │   │   └── Notification.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── profileController.js
│   │   │   ├── tripController.js
│   │   │   ├── aiController.js
│   │   │   ├── documentController.js
│   │   │   ├── versionController.js
│   │   │   ├── expenseController.js
│   │   │   ├── checklistController.js
│   │   │   ├── shareController.js
│   │   │   ├── emergencyController.js
│   │   │   ├── memoryController.js
│   │   │   └── notificationController.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── profileRoutes.js
│   │   │   ├── tripRoutes.js
│   │   │   ├── aiRoutes.js
│   │   │   ├── documentRoutes.js
│   │   │   ├── versionRoutes.js
│   │   │   ├── expenseRoutes.js
│   │   │   ├── checklistRoutes.js
│   │   │   ├── shareRoutes.js
│   │   │   ├── emergencyRoutes.js
│   │   │   ├── memoryRoutes.js
│   │   │   └── notificationRoutes.js
│   │   ├── middlewares/
│   │   │   ├── authMiddleware.js
│   │   │   ├── errorMiddleware.js
│   │   │   └── uploadMiddleware.js
│   │   ├── services/
│   │   │   ├── groqService.js
│   │   │   ├── cloudinaryService.js
│   │   │   └── mockWeatherService.js
│   │   ├── agents/
│   │   │   ├── state.js
│   │   │   ├── userIntentAgent.js
│   │   │   ├── destinationAgent.js
│   │   │   ├── budgetAgent.js
│   │   │   ├── itineraryAgent.js
│   │   │   ├── safetyAgent.js
│   │   │   ├── packingAgent.js
│   │   │   ├── criticAgent.js
│   │   │   ├── finalPlannerAgent.js
│   │   │   └── graph.js
│   │   ├── prompts/
│   │   │   ├── plannerPrompt.js
│   │   │   └── chatPrompt.js
│   │   ├── utils/
│   │   │   ├── ApiError.js
│   │   │   ├── ApiResponse.js
│   │   │   ├── asyncHandler.js
│   │   │   ├── generateToken.js
│   │   │   └── safeJsonParse.js
│   │   ├── app.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
├── client/
│   ├── src/
│   │   ├── api/
│   │   │   ├── axiosInstance.js
│   │   │   ├── authApi.js
│   │   │   ├── tripApi.js
│   │   │   ├── aiApi.js
│   │   │   ├── documentApi.js
│   │   │   ├── expenseApi.js
│   │   │   ├── checklistApi.js
│   │   │   ├── versionApi.js
│   │   │   ├── shareApi.js
│   │   │   └── emergencyApi.js
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.jsx
│   │   │   │   └── Sidebar.jsx
│   │   │   ├── common/
│   │   │   │   ├── ProtectedRoute.jsx
│   │   │   │   ├── Loader.jsx
│   │   │   │   ├── EmptyState.jsx
│   │   │   │   └── PageHeader.jsx
│   │   │   ├── trip/
│   │   │   │   ├── TripCard.jsx
│   │   │   │   └── TripScoreCard.jsx
│   │   │   ├── ai/
│   │   │   │   ├── AgentProgress.jsx
│   │   │   │   ├── ChatBox.jsx
│   │   │   │   └── ChatMessage.jsx
│   │   │   ├── itinerary/
│   │   │   │   └── ItineraryDayCard.jsx
│   │   │   └── budget/
│   │   │       └── ExpenseForm.jsx
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── TravelProfile.jsx
│   │   │   ├── CreateTrip.jsx
│   │   │   ├── TripWorkspace.jsx
│   │   │   ├── AIPlanner.jsx
│   │   │   ├── TripChat.jsx
│   │   │   ├── Documents.jsx
│   │   │   ├── ExpenseTracker.jsx
│   │   │   ├── Checklist.jsx
│   │   │   ├── TripVersions.jsx
│   │   │   ├── PublicShare.jsx
│   │   │   ├── EmergencyCard.jsx
│   │   │   ├── OfflineTrip.jsx
│   │   │   └── Settings.jsx
│   │   ├── store/
│   │   │   ├── authStore.js
│   │   │   └── tripStore.js
│   │   ├── utils/
│   │   │   ├── formatDate.js
│   │   │   ├── formatCurrency.js
│   │   │   └── localTripStorage.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example