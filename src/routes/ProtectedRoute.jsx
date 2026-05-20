import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, userData, loading } = useAuth();

  // Agar Firebase abhi check kar raha hai, toh loading screen dikhao
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-xl font-semibold text-primary">Loading...</div>;
  }

  // Agar user logged in nahi hai, toh wapas Login page par bhej do
  if (!user) {
    return <Navigate to="/" />;
  }

  // Agar user ka role us page ke allow kiye gaye role se match nahi karta, toh wapas bhej do
  if (allowedRoles && userData && !allowedRoles.includes(userData.role)) {
    return <Navigate to="/" />;
  }

  // Sab sahi hai, toh page dikha do
  return children;
}