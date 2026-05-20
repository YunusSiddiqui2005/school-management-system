import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { secondaryAuth, db } from "../../firebase/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs, addDoc, deleteDoc, updateDoc } from "firebase/firestore"; 

export default function AdminDashboard() {
  const { user, userData, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard"); 

  // --- States ---
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [name, setName] = useState(""); const [role, setRole] = useState("student");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [loading, setLoading] = useState(false); const [message, setMessage] = useState({ type: "", text: "" });

  const [usersList, setUsersList] = useState([]); const [fetchingUsers, setFetchingUsers] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState(""); const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeLink, setNoticeLink] = useState(""); const [noticeLoading, setNoticeLoading] = useState(false);
  const [noticeMessageAlert, setNoticeMessageAlert] = useState({ type: "", text: "" });

  const [className, setClassName] = useState(""); const [section, setSection] = useState("");
  const [academicLoading, setAcademicLoading] = useState(false); const [academicMessage, setAcademicMessage] = useState({ type: "", text: "" });

  const [ttClass, setTtClass] = useState(""); const [ttDay, setTtDay] = useState("Monday");
  const [ttTime, setTtTime] = useState(""); const [ttSubject, setTtSubject] = useState("");
  const [ttTeacher, setTtTeacher] = useState("");
  
  const [classList, setClassList] = useState([]); 

  const [stats, setStats] = useState({ students: 0, teachers: 0, classes: 0 });

  // --- STATES: USER EDIT MODE KE LIYE ---
  const [isEditing, setIsEditing] = useState(false); 
  const [editUserId, setEditUserId] = useState(null); 

  // --- STATES: CLASS EDIT MODE KE LIYE ---
  const [isEditingClass, setIsEditingClass] = useState(false); 
  const [editClassId, setEditClassId] = useState(null); 

  // --- Functions ---

  /* [BLOCK 1: FETCH CLASSES FUNCTION]
    - KYA: Yeh function school me bani saari classes ki list fetch karta hai.
    - KYUN: Taki jab Admin naya student register kare ya class edit kare, toh classes ka sahi data mile.
    - KESE: Yeh Firestore ke "classes" collection me query chalata hai jahan 'schoolId' match karti ho.
  */
  const fetchClasses = async () => {
    try {
      const q = query(collection(db, "classes"), where("schoolId", "==", userData?.schoolId));
      const querySnapshot = await getDocs(q);
      const clsData = [];
      querySnapshot.forEach((doc) => clsData.push({ id: doc.id, ...doc.data() }));
      setClassList(clsData);
    } catch (error) { console.error("Error fetching classes:", error); }
  };

  /* [BLOCK 2: FETCH STATS FUNCTION]
    - KYA: Yeh total Students, Teachers aur Active Classes ka count nikalta hai.
    - KYUN: Overview dashboard par bade-bade summary cards me counting dikhane ke liye.
    - KESE: Yeh "classes" aur "users" dono collections par filter laga kar loop chalata hai, role check karta hai aur counters update karta hai.
  */
  const fetchStats = async () => {
    try {
      const qClasses = query(collection(db, "classes"), where("schoolId", "==", userData?.schoolId));
      const classSnap = await getDocs(qClasses);
      
      const qUsers = query(collection(db, "users"), where("schoolId", "==", userData?.schoolId));
      const userSnap = await getDocs(qUsers);
      
      let stuCount = 0;
      let teaCount = 0;
      userSnap.forEach(doc => {
        const data = doc.data();
        if (data.role === "student") stuCount++;
        if (data.role === "teacher") teaCount++;
      });

      setStats({ students: stuCount, teachers: teaCount, classes: classSnap.size });
    } catch (error) { console.error("Error fetching stats:", error); }
  };

  /* [BLOCK 3: CREATE OR UPDATE USER (MIXED FUNCTION)]
    - KYA: Yeh ek hi function ya toh naya user banayega ya purane ko update karega.
    - KYUN: Form reuse karke code ko lamba aur complex hone se bachane ke liye.
    - KESE: 'isEditing' check karta hai. True hai toh `updateDoc` se purana data overwrite karta hai. False hai toh `createUserWithEmailAndPassword` aur `setDoc` se naya user banata hai.
  */
  const handleCreateOrUpdateUser = async (e) => {
    e.preventDefault(); setLoading(true); setMessage({ type: "", text: "" });
    if (role === "student" && !selectedClassId) {
      setMessage({ type: "error", text: "Please select a class for the student." });
      setLoading(false); return;
    }

    try {
      if (isEditing) {
        await updateDoc(doc(db, "users", editUserId), {
          name,
          classId: role === "student" ? selectedClassId : null
        });
        setMessage({ type: "success", text: "User details updated successfully!" });
        setIsEditing(false); setEditUserId(null);
      } else {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name, email, role, 
          classId: role === "student" ? selectedClassId : null,
          schoolId: userData.schoolId || "school_default", 
          createdAt: new Date().toISOString()
        });
        setMessage({ type: "success", text: `${role.toUpperCase()} created successfully!` });
      }
      
      setEmail(""); setPassword(""); setName(""); setSelectedClassId("");
      fetchStats(); 
    } catch (error) { setMessage({ type: "error", text: error.message }); } finally { setLoading(false); }
  };

  /* [BLOCK 4: USER EDIT CLICK TRIGGER]
    - KYA: Jab admin table me 'Edit' dabata hai.
    - KYUN: Taki us bande ka data form me automatic bhar jaye aur form update mode me aa jaye.
    - KESE: 'setIsEditing(true)' set karke saari states me us selected user ka data daal deta hai, aur dashboard tab khol deta hai.
  */
  const handleEditClick = (usr) => {
    setIsEditing(true);
    setEditUserId(usr.id);
    setName(usr.name);
    setEmail(usr.email); 
    setRole(usr.role);
    setSelectedClassId(usr.classId || "");
    setActiveTab("dashboard"); 
  };

  /* [BLOCK 5: DELETE USER FUNCTION]
    - KYA: Database se user ko uda deta hai.
    - KYUN: Galat entry ya chhode hue bachho ko hatane ke liye.
    - KESE: 'window.confirm' se permission leta hai, phir `deleteDoc(doc(...))` chalakar user ko delete kar deta hai.
  */
  const handleDeleteUser = async (userId) => {
    if (window.confirm("Kya aap sach me is user ko delete karna chahte hain?")) {
      try {
        await deleteDoc(doc(db, "users", userId));
        alert("User successfully deleted!");
        fetchUsers(); 
        fetchStats(); 
      } catch (error) { alert("Delete karne me error aaya: " + error.message); }
    }
  };

  /* [BLOCK 6: CREATE OR UPDATE CLASS (MIXED FUNCTION)]
    - KYA: Nayi class banane ya existing class ko edit karne ka logic.
    - KYUN: Academics tab me class setup asaan banane ke liye.
    - KESE: 'isEditingClass' flag se pata lagata hai ki `updateDoc` lagana hai ya naye path par `setDoc` karna hai.
  */
  const handleAddOrUpdateClass = async (e) => {
    e.preventDefault(); setAcademicLoading(true); setAcademicMessage({ type: "", text: "" });
    try {
      if (isEditingClass) {
        await updateDoc(doc(db, "classes", editClassId), {
          className,
          section,
          displayString: `${className} - ${section}`
        });
        setAcademicMessage({ type: "success", text: "Class updated successfully!" });
        setIsEditingClass(false); setEditClassId(null);
      } else {
        const classId = `${className}_${section}`.replace(/\s+/g, '');
        await setDoc(doc(db, "classes", classId), {
          className, section, displayString: `${className} - ${section}`, schoolId: userData.schoolId, createdAt: new Date().toISOString()
        });
        setAcademicMessage({ type: "success", text: "Class added successfully!" });
      }
      setClassName(""); setSection(""); fetchClasses(); fetchStats(); 
    } catch (error) { setAcademicMessage({ type: "error", text: "Error processing class." }); } finally { setAcademicLoading(false); }
  };

  /* [BLOCK 7: CLASS EDIT CLICK TRIGGER]
    - KYA: Class table me 'Edit' button ka kaam.
    - KYUN: Taki class data form me load ho sake.
    - KESE: `setIsEditingClass(true)` karke state update karta hai.
  */
  const handleClassEditClick = (cls) => {
    setIsEditingClass(true);
    setEditClassId(cls.id);
    setClassName(cls.className);
    setSection(cls.section);
  };

  /* [BLOCK 8: DELETE CLASS FUNCTION]
    - KYA: Faltu classes ko delete karta hai.
    - KYUN: System ko clean rakhne ke liye.
    - KESE: Confirmation lekar `deleteDoc` lagata hai aur list reload karta hai.
  */
  const handleDeleteClass = async (classId) => {
    if (window.confirm("Kya aap sach me is Class ko delete karna chahte hain? Isse data refresh ho jayega.")) {
      try {
        await deleteDoc(doc(db, "classes", classId));
        alert("Class successfully deleted!");
        fetchClasses(); 
        fetchStats(); 
      } catch (error) { alert("Class delete karne me error aaya: " + error.message); }
    }
  };

  /* [BLOCK 9: FETCH USERS FUNCTION]
    - KYA: School ke saare bache aur teachers ki list lata hai.
    - KYUN: "Manage Users" wali table me data show karne ke liye.
    - KESE: 'users' collection me `getDocs` chalakar list nikalta hai.
  */
  const fetchUsers = async () => {
    setFetchingUsers(true);
    try {
      const q = query(collection(db, "users"), where("schoolId", "==", userData.schoolId));
      const querySnapshot = await getDocs(q);
      const usersData = [];
      querySnapshot.forEach((doc) => { if (doc.id !== user.uid) usersData.push({ id: doc.id, ...doc.data() }); });
      setUsersList(usersData);
    } catch (error) { console.error("Error fetching users:", error); } finally { setFetchingUsers(false); }
  };

  /* [BLOCK 10: POST NOTICE FUNCTION]
    - KYA: Notice board par naya announcement daalta hai.
    - KYUN: School updates ke liye.
    - KESE: 'notices' collection me `addDoc` chalata hai.
  */
  const handlePostNotice = async (e) => {
    e.preventDefault(); setNoticeLoading(true); setNoticeMessageAlert({ type: "", text: "" });
    try {
      await addDoc(collection(db, "notices"), {
        title: noticeTitle, message: noticeMessage, link: noticeLink || null, schoolId: userData.schoolId, createdAt: new Date().toISOString()
      });
      setNoticeMessageAlert({ type: "success", text: "Notice posted!" });
      setNoticeTitle(""); setNoticeMessage(""); setNoticeLink("");
    } catch (error) { setNoticeMessageAlert({ type: "error", text: "Failed to post notice." }); } finally { setNoticeLoading(false); }
  };

  /* [BLOCK 11: ADD TIMETABLE FUNCTION]
    - KYA: Weekly routine set karta hai.
    - KYUN: Schedule show karne ke liye.
    - KESE: 'timetable' collection me data `addDoc` se bhejta hai.
  */
  const handleAddTimetable = async (e) => {
    e.preventDefault(); setAcademicLoading(true); setAcademicMessage({ type: "", text: "" });
    try {
      await addDoc(collection(db, "timetable"), { classId: ttClass, day: ttDay, time: ttTime, subject: ttSubject, teacher: ttTeacher, schoolId: userData.schoolId });
      setAcademicMessage({ type: "success", text: "Timetable updated!" });
      setTtSubject(""); setTtTeacher(""); setTtTime("");
    } catch (error) { setAcademicMessage({ type: "error", text: "Error updating timetable." }); } finally { setAcademicLoading(false); }
  };

  /* [BLOCK 12: LIFECYCLE (USE-EFFECT)]
    - KYA: Component load hote hi background me functions chalata hai.
    - KYUN: Taki screen khulte hi numbers aur lists turant dikhein.
    - KESE: 'userData' aate hi `fetchClasses` aur `fetchStats` chala deta hai.
  */
  useEffect(() => {
    if (userData?.schoolId) {
      fetchClasses();
      fetchStats(); 
    }
    if (activeTab === "manage") fetchUsers();
  }, [activeTab, userData]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar Content */}
      <div className="w-full md:w-64 bg-primary text-white p-4 md:p-6 flex flex-row md:flex-col overflow-x-auto md:overflow-visible shadow-md z-10 md:min-h-screen">
        <h2 className="text-xl md:text-2xl font-bold mb-0 md:mb-8 mr-6 md:mr-0 shrink-0 self-center md:self-start">Admin Panel</h2>
        <div className="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-4 text-sm flex-1">
          <p onClick={() => { setActiveTab("dashboard"); setIsEditing(false); setEmail(""); setPassword(""); setName(""); }} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "dashboard" ? "bg-blue-800" : "hover:bg-blue-800"}`}>Dashboard</p>
          <p onClick={() => setActiveTab("manage")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "manage" ? "bg-blue-800" : "hover:bg-blue-800"}`}>Manage Users</p>
          <p onClick={() => setActiveTab("notice")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "notice" ? "bg-blue-800" : "hover:bg-blue-800"}`}>Notice Board</p>
          <p onClick={() => { setActiveTab("academic"); setIsEditingClass(false); setClassName(""); setSection(""); }} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "academic" ? "bg-blue-800" : "hover:bg-blue-800"}`}>Academics</p>
        </div>
        <button onClick={logout} className="ml-4 md:ml-0 md:mt-auto bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition shrink-0">Logout</button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            {activeTab === "dashboard" && (isEditing ? "Edit User Details" : "Overview Dashboard")}
            {activeTab === "manage" && "Manage Registered Users"}
            {activeTab === "notice" && "Notice Board Broadcast"}
            {activeTab === "academic" && (isEditingClass ? "Edit Class Details" : "Academics & Timetable")}
          </h1>
          <span className="bg-secondary text-white px-4 py-1 rounded-full text-xs md:text-sm shadow">School ID: {userData?.schoolId || "Default"}</span>
        </div>

        {activeTab === "dashboard" && (
          <>
            {/* Overview Stats UI Grid */}
            {!isEditing && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-l-blue-500">
                  <div><p className="text-sm text-gray-500 font-medium">Total Students</p><p className="text-3xl font-bold text-gray-800">{stats.students}</p></div>
                  <div className="text-3xl">👨‍🎓</div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-l-teal-500">
                  <div><p className="text-sm text-gray-500 font-medium">Total Teachers</p><p className="text-3xl font-bold text-gray-800">{stats.teachers}</p></div>
                  <div className="text-3xl">👩‍🏫</div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-l-purple-500">
                  <div><p className="text-sm text-gray-500 font-medium">Active Classes</p><p className="text-3xl font-bold text-gray-800">{stats.classes}</p></div>
                  <div className="text-3xl">🏫</div>
                </div>
              </div>
            )}

            {/* Dashboard Class List Overview Panel */}
            {!isEditing && (
              <div className="bg-white rounded-xl shadow-md p-4 md:p-6 w-full max-w-2xl border border-gray-100 mb-8">
                <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">🏫 School Classes Overview</h2>
                {classList.length === 0 ? <p className="text-sm text-gray-500">No active classes created yet.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {classList.map(c => (
                      <span key={c.id} className="bg-purple-50 text-purple-700 border border-purple-100 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm">
                        Class: {c.displayString}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Registration + Edit Form */}
            <div className="bg-white rounded-xl shadow-md p-4 md:p-6 w-full max-w-2xl border border-gray-100">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-6">{isEditing ? "✏️ Update Profile" : "Register New User"}</h2>
              {message.text && (<div className={`p-4 mb-6 rounded text-sm ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message.text}</div>)}
              
              <form onSubmit={handleCreateOrUpdateUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm mb-1">Full Name</label><input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border rounded outline-none" /></div>
                  <div>
                    <label className="block text-sm mb-1">Role</label>
                    <select disabled={isEditing} value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-4 py-2 border rounded outline-none bg-white disabled:bg-gray-100">
                      <option value="student">Student</option><option value="teacher">Teacher</option>
                    </select>
                  </div>
                </div>

                {role === "student" && (
                  <div>
                    <label className="block text-sm mb-1 font-bold text-blue-600">Assign Class *</label>
                    <select required value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-full px-4 py-2 border-2 border-blue-200 rounded outline-none bg-blue-50">
                      <option value="" disabled>-- Select a Class --</option>
                      {classList.map(c => <option key={c.id} value={c.displayString}>{c.displayString}</option>)}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm mb-1">Email</label><input type="email" required disabled={isEditing} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border rounded outline-none disabled:bg-gray-100" /></div>
                  {!isEditing && (
                    <div><label className="block text-sm mb-1">Password</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded outline-none" minLength="6" /></div>
                  )}
                </div>
                <div className="flex gap-4">
                  <button type="submit" disabled={loading} className="flex-1 bg-secondary hover:bg-teal-700 text-white py-2.5 rounded transition mt-4 font-bold">{isEditing ? "Save Changes" : "Register User"}</button>
                  {isEditing && (
                    <button type="button" onClick={() => { setIsEditing(false); setName(""); setEmail(""); setSelectedClassId(""); }} className="bg-gray-400 hover:bg-gray-500 text-white py-2.5 px-6 rounded transition mt-4 font-bold">Cancel</button>
                  )}
                </div>
              </form>
            </div>
          </>
        )}

        {/* TAB 2: Manage Users */}
        {activeTab === "manage" && ( 
          <div className="bg-white rounded-xl shadow-md overflow-x-auto border border-gray-100"> 
            {fetchingUsers ? (<div className="p-8 text-center text-gray-500">Loading Users...</div>) : ( 
              <table className="w-full min-w-max text-left border-collapse"> 
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 text-sm">Name</th><th className="p-4 text-sm">Email</th><th className="p-4 text-sm">Role/Class</th><th className="p-4 text-sm text-center">Actions</th>
                  </tr>
                </thead> 
                <tbody> 
                  {usersList.map((usr) => ( 
                    <tr key={usr.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-800">{usr.name}</td>
                      <td className="p-4 text-xs md:text-sm text-gray-600">{usr.email}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium mr-2 ${usr.role === "teacher" ? "bg-teal-100 text-teal-800" : "bg-blue-100 text-blue-800"}`}>{usr.role.toUpperCase()}</span> 
                        {usr.classId && <span className="bg-gray-200 text-gray-700 px-2 py-1 text-xs rounded mt-1 inline-block">{usr.classId}</span>}
                      </td>
                      <td className="p-4 text-center space-x-2 whitespace-nowrap">
                        <button onClick={() => handleEditClick(usr)} className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded text-xs font-bold transition">✏️ Edit</button>
                        <button onClick={() => handleDeleteUser(usr.id)} className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded text-xs font-bold transition">🗑️ Delete</button>
                      </td>
                    </tr> 
                  ))} 
                </tbody> 
              </table> 
            )} 
          </div> 
        )}

        {/* TAB 3: Notice Board */}
        {activeTab === "notice" && ( 
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 max-w-2xl border border-gray-100"> 
            <form onSubmit={handlePostNotice} className="space-y-4"> 
              <div><label className="block text-sm mb-1">Title</label><input type="text" required value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} className="w-full px-4 py-2 border rounded outline-none" /></div> 
              <div><label className="block text-sm mb-1">Message</label><textarea required value={noticeMessage} onChange={(e) => setNoticeMessage(e.target.value)} rows="4" className="w-full px-4 py-2 border rounded outline-none"></textarea></div> 
              <div><label className="block text-sm mb-1">Link</label><input type="url" value={noticeLink} onChange={(e) => setNoticeLink(e.target.value)} className="w-full px-4 py-2 border rounded outline-none" /></div> 
              <button type="submit" disabled={noticeLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded mt-4">Post Notice</button> 
            </form> 
          </div> 
        )}

        {/* TAB 4: Academics (CLASSES EDIT + DELETE) */}
        {activeTab === "academic" && (
          <div className="space-y-8 w-full max-w-3xl">
            {academicMessage.text && (<div className={`p-4 rounded text-sm ${academicMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{academicMessage.text}</div>)}
            
            {/* 1. Create / Update Class Form */}
            <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border border-gray-100">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-6 border-b pb-2">{isEditingClass ? "✏️ Update School Class" : "1. Create New Class"}</h2>
              <form onSubmit={handleAddOrUpdateClass} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label><input type="text" required value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. 10th" className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-primary outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Section</label><input type="text" required value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. A" className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-primary outline-none" /></div>
                <div className="flex gap-2 w-full">
                  <button type="submit" disabled={academicLoading} className="flex-1 bg-primary hover:bg-blue-900 text-white font-semibold py-2 rounded transition">{isEditingClass ? "Save" : "Add Class"}</button>
                  {isEditingClass && (
                    <button type="button" onClick={() => { setIsEditingClass(false); setClassName(""); setSection(""); }} className="bg-gray-400 text-white px-3 py-2 rounded transition">X</button>
                  )}
                </div>
              </form>
            </div>

            {/* Classes Registry Table with CRUD */}
            <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border border-gray-100 overflow-x-auto">
              <h2 className="text-md font-bold text-gray-700 mb-4">🏫 Created Classes Registry</h2>
              {classList.length === 0 ? <p className="text-sm text-gray-500">No classes found.</p> : (
                <table className="w-full min-w-max text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-sm text-gray-600">
                      <th className="p-3">Class Name</th><th className="p-3">Section</th><th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classList.map((cls) => (
                      <tr key={cls.id} className="border-b hover:bg-gray-50 text-sm">
                        <td className="p-3 font-medium text-gray-800">{cls.className}</td>
                        <td className="p-3 text-gray-600">{cls.section}</td>
                        <td className="p-3 text-center space-x-2">
                          <button onClick={() => handleClassEditClick(cls)} className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded text-xs font-bold hover:bg-purple-200">✏️ Edit</button>
                          <button onClick={() => handleDeleteClass(cls.id)} className="bg-red-100 text-red-700 px-2.5 py-1 rounded text-xs font-bold hover:bg-red-200">🗑️ Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* 2. Schedule Timetable */}
            <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border border-gray-100">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-6 border-b pb-2">2. Schedule Timetable</h2>
              <form onSubmit={handleAddTimetable} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label><select required value={ttClass} onChange={(e) => setTtClass(e.target.value)} className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-secondary outline-none bg-white"><option value="" disabled>Choose...</option>{classList.map(c => <option key={c.id} value={c.displayString}>{c.displayString}</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Day</label><select value={ttDay} onChange={(e) => setTtDay(e.target.value)} className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-secondary outline-none bg-white"><option value="Monday">Monday</option><option value="Tuesday">Tuesday</option><option value="Wednesday">Wednesday</option><option value="Thursday">Thursday</option><option value="Friday">Friday</option><option value="Saturday">Saturday</option></select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Time</label><input type="text" required value={ttTime} onChange={(e) => setTtTime(e.target.value)} placeholder="e.g. 10:00 AM" className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-secondary outline-none" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject</label><input type="text" required value={ttSubject} onChange={(e) => setTtSubject(e.target.value)} placeholder="e.g. Math" className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-secondary outline-none" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label><input type="text" required value={ttTeacher} onChange={(e) => setTtTeacher(e.target.value)} placeholder="e.g. Ramesh Sir" className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-secondary outline-none" /></div>
                </div>
                <button type="submit" disabled={academicLoading} className="w-full bg-secondary hover:bg-teal-700 text-white font-semibold py-2.5 rounded transition mt-4">Save Timetable</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}