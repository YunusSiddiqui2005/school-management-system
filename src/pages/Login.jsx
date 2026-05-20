import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  /* [BLOCK 1: HANDLE LOGIN & ROLE-BASED ROUTING]
    - KYA: Yeh function user ko verify karke uski profile ke hisaab se sahi dashboard par bhejta hai.
    - KYUN: Taki ek student galti se Admin panel me na ghus jaye, har kisi ko apna hi page dikhe.
    - KESE: Yeh 3 step process hai:
      1. Firebase Auth ke through email/password check karta hai. Agar sahi hai toh 'uid' milti hai.
      2. Us 'uid' ko lekar Firestore ke "users" collection me jata hai aur us user ka poora document nikalta hai.
      3. Document se 'role' (admin/teacher/student) read karta hai aur React Router ke 'navigate()' function ka use karke usko uske designated page par direct kar deta hai. Agar role missing hai ya galat details hain, toh Error throw karta hai.
  */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Firebase Auth me Login karein
      const userCredential = await login(email, password);
      const user = userCredential.user;

      // 2. Firestore se user ka Role (admin/teacher/student) nikalein
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        
        // 3. Role ke hisaab se sahi page par bhejein
        if (role === "admin") navigate("/admin");
        else if (role === "teacher") navigate("/teacher");
        else if (role === "student") navigate("/student");
        else setError("Role not assigned to this user.");
      } else {
        setError("User data not found in database.");
      }
    } catch (err) {
      setError("Invalid Email or Password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6 border border-gray-200">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-primary">SMS Portal</h2>
          <p className="text-sm text-gray-500 mt-2">School Management System Login</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              placeholder="admin@school.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-blue-900 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}