import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import ProtectedRoute from "./routes/ProtectedRoute";

function App() {
  return (
    /* [BLOCK 1: CENTRAL ROUTING MANAGEMENT]
      - KYA: Yeh poore School Management System ka main routing entry-point hai.
      - KYUN: Kyunki React ek Single Page Application (SPA) hai. Bina routing ke browser poora page refresh karega. Is router ki madad se URL badalne par sirf vahi component change hota hai jo zaroori ho, poora page reload nahi hota.
      - KESE: <Router> poore application ke navigation track ko handle karta hai. Iske andar <Routes> ek container ki tarah kaam karta hai aur har ek <Route> tag yeh batata hai ki jab path "/" hoga toh Login page khulega, aur jab "/admin" hoga toh Admin dashboard khulega.
    */
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<Login />} />

        {/* [BLOCK 2: ROLE-BASED PROTECTED ROUTES]
          - KYA: Yeh application ki security wall (Guard System) hai jisme dashboards ko secure kiya gaya hai.
          - KYUN: Taki koi student direct browser ke URL me '/admin' ya '/teacher' likh kar bina permission ke kisi dusre ke dashboard me na ghus jaye. Security aur authorization maintain rakhne ke liye yeh bohot zaroori hai.
          - KESE: Humne saare sensitive dashboards ko <ProtectedRoute> component ke andar wrap kar diya hai aur 'allowedRoles' prop me array ke roop me role pass kiya hai (jaise ["admin"], ["teacher"]). Ab jab bhi koi user in URLs par hit karega, toh yeh component check karega ki user logged in hai ya nahi, aur kya uska role allowed list se match karta hai. Agar match hoga toh hi inner component screen par dikhega, varna user wapas login page par fenk diya jayega.
        */}

        {/* Admin Protected Route */}
        <Route 
          path="/admin" 
          element = {
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Teacher Protected Route */}
        <Route 
          path="/teacher" 
          element = {
            <ProtectedRoute allowedRoles={["teacher"]}>
              <TeacherDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Student Protected Route */}
        <Route 
          path="/student" 
          element = {
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;