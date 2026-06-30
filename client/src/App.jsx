import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TravelProfile from './pages/TravelProfile.jsx';
import CreateTrip from './pages/CreateTrip.jsx';
import TripWorkspace from './pages/TripWorkspace.jsx';
import AIPlanner from './pages/AIPlanner.jsx';
import TripChat from './pages/TripChat.jsx';
import Documents from './pages/Documents.jsx';
import ExpenseTracker from './pages/ExpenseTracker.jsx';
import Checklist from './pages/Checklist.jsx';
import TripVersions from './pages/TripVersions.jsx';
import PublicShare from './pages/PublicShare.jsx';
import EmergencyCard from './pages/EmergencyCard.jsx';
import OfflineTrip from './pages/OfflineTrip.jsx';
import Settings from './pages/Settings.jsx';
import TripMemory from './pages/TripMemory.jsx';
import Notifications from './pages/Notifications.jsx';
import BookingHub from './pages/BookingHub.jsx';
import Billing from './pages/Billing.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/share/:shareId" element={<PublicShare />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<TravelProfile />} />
          <Route path="/trips/new" element={<CreateTrip />} />
          <Route path="/trips/:id" element={<TripWorkspace />} />
          <Route path="/trips/:id/planner" element={<AIPlanner />} />
          <Route path="/trips/:id/chat" element={<TripChat />} />
          <Route path="/trips/:id/bookings" element={<BookingHub />} />
          <Route path="/trips/:id/documents" element={<Documents />} />
          <Route path="/trips/:id/expenses" element={<ExpenseTracker />} />
          <Route path="/trips/:id/checklist" element={<Checklist />} />
          <Route path="/trips/:id/versions" element={<TripVersions />} />
          <Route path="/trips/:id/emergency" element={<EmergencyCard />} />
          <Route path="/trips/:id/memory" element={<TripMemory />} />
          <Route path="/offline" element={<OfflineTrip />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/billing" element={<Billing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
