import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/dashboard";
import Chat from "./pages/Chat";

import MainLayout from "./layouts/MainLayout";
import ProtectedRoutes from "./components/routes/ProtectedRoutes";

/* Layout Wrapper */
function LayoutWrapper() {
  return (
    <ProtectedRoutes>
      <MainLayout>
        <Outlet />
      </MainLayout>
    </ProtectedRoutes>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Routes with Layout */}
        <Route element={<LayoutWrapper />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
        </Route>
      </Routes>
    </Router>
  );
}