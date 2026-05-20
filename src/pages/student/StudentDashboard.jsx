import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function StudentDashboard() {
  const { user, userData, logout } = useAuth();
  
  // Navigation State (Naya default tab 'dashboard' hai)
  const [activeTab, setActiveTab] = useState("dashboard"); 

  // Data States
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [notices, setNotices] = useState([]);
  const [reportCards, setReportCards] = useState([]);
  const [timetableData, setTimetableData] = useState([]);
  const [homeworkList, setHomeworkList] = useState([]); 
  
  const [loading, setLoading] = useState(true);
  const [noticeLoading, setNoticeLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [ttLoading, setTtLoading] = useState(false);
  const [hwLoading, setHwLoading] = useState(false); 

  /* [BLOCK 1: FETCH ATTENDANCE]
    - KYA: Yeh function student ka poora attendance record nikalta hai.
    - KYUN: Dashboard summary aur "Attendance Log" tab me dikhane ke liye ki bachha kitne din present/absent tha.
    - KESE: Yeh Firestore ke "attendance" collection me query karta hai jahan 'studentId', is logged-in user ki 'uid' ke barabar ho. Data aane ke baad use Date ke hisaab se sort karta hai (taki latest date upar aaye) aur 'attendanceRecords' me save kar deta hai.
  */
  useEffect(() => {
    const fetchMyAttendance = async () => {
      try {
        const q = query(collection(db, "attendance"), where("studentId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const records = [];
        querySnapshot.forEach((doc) => records.push(doc.data()));
        records.sort((a, b) => new Date(b.date) - new Date(a.date));
        setAttendanceRecords(records);
      } catch (error) { console.error("Error fetching attendance"); } finally { setLoading(false); }
    };
    if (user?.uid && (activeTab === "attendance" || activeTab === "dashboard")) fetchMyAttendance();
  }, [user, activeTab]);

  /* [BLOCK 2: FETCH NOTICES]
    - KYA: Yeh school ke current/latest notices fetch karta hai.
    - KYUN: Student ko notice board par announcements aur circulars dikhane ke liye.
    - KESE: 'notices' collection me 'schoolId' match karke data lata hai. Phir ek Date object banakar pichle 3 din (threeDaysAgo) ki date nikalta hai, aur filter lagata hai ki wahi notice dikhe jo pichle 3 din ke andar bane hain. End me list ko ulta sort karke 'notices' state me daal deta hai.
  */
  useEffect(() => {
    const fetchNotices = async () => {
      setNoticeLoading(true);
      try {
        const q = query(collection(db, "notices"), where("schoolId", "==", userData?.schoolId));
        const querySnapshot = await getDocs(q);
        const noticesList = [];
        const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (new Date(data.createdAt) >= threeDaysAgo) noticesList.push({ id: doc.id, ...data });
        });
        noticesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setNotices(noticesList);
      } catch (error) { console.error("Error fetching notices"); } finally { setNoticeLoading(false); }
    };
    if (userData?.schoolId && activeTab === "notices") fetchNotices();
  }, [userData, activeTab]);

  /* [BLOCK 3: FETCH REPORT CARDS]
    - KYA: Student ke exam marks aur report card ka data lata hai.
    - KYUN: Taki student "Report Card" tab me apne marks (Maths, Science, etc.) aur percentage dekh sake.
    - KESE: 'marks' collection me jahan 'studentId' match hoti hai, wahan se document uthata hai. Saare report cards ko upload hone ke time ke hisaab se descending order (latest pehle) me sort karke 'reportCards' array me set kar deta hai.
  */
  useEffect(() => {
    const fetchReports = async () => {
      setReportLoading(true);
      try {
        const q = query(collection(db, "marks"), where("studentId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const reportsData = [];
        querySnapshot.forEach((doc) => reportsData.push({ id: doc.id, ...doc.data() }));
        reportsData.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        setReportCards(reportsData);
      } catch (error) { console.error("Error fetching report cards"); } finally { setReportLoading(false); }
    };
    if (user?.uid && activeTab === "report") fetchReports();
  }, [user, activeTab]);

  /* [BLOCK 4: FETCH TIMETABLE]
    - KYA: Sirf is particular student ki class ka weekly schedule nikalta hai.
    - KYUN: Bachhe ko apna daily routine aur periods ka time pata chale.
    - KESE: 'timetable' collection me 2 filters ek sath lagata hai: 'schoolId' aur student ka khud ka 'classId'. Phir ek object 'daysOrder' use karke (jaise Monday:1, Tuesday:2) poore week ke data ko dino ke hisaab se seedha sort karta hai aur 'timetableData' me rakh deta hai.
  */
  useEffect(() => {
    const fetchTimetable = async () => {
      setTtLoading(true);
      try {
        const q = query(collection(db, "timetable"), where("schoolId", "==", userData?.schoolId), where("classId", "==", userData?.classId));
        const querySnapshot = await getDocs(q);
        const ttData = [];
        querySnapshot.forEach((doc) => ttData.push({ id: doc.id, ...doc.data() }));
        
        const daysOrder = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6 };
        ttData.sort((a, b) => daysOrder[a.day] - daysOrder[b.day]);
        setTimetableData(ttData);
      } catch (error) { console.error("Error fetching timetable"); } finally { setTtLoading(false); }
    };
    if (userData?.schoolId && activeTab === "timetable") fetchTimetable();
  }, [userData, activeTab]);

  /* [BLOCK 5: FETCH HOMEWORK]
    - KYA: Teachers dwara assign kiya gaya homework lata hai.
    - KYUN: Taki student ko uski class ka daily task dikh sake.
    - KESE: 'homework' collection me wahi double query lagata hai ('schoolId' aur 'classId'). Jo homework documents aate hain, unhe creation date ke hisaab se ulta sort karta hai taaki naya homework hamesha top par dikhe, aur usko 'homeworkList' me set kar deta hai.
  */
  useEffect(() => {
    const fetchHomework = async () => {
      setHwLoading(true);
      try {
        const q = query(collection(db, "homework"), where("schoolId", "==", userData?.schoolId), where("classId", "==", userData?.classId));
        const querySnapshot = await getDocs(q);
        const hwData = [];
        querySnapshot.forEach((doc) => hwData.push({ id: doc.id, ...doc.data() }));
        
        hwData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setHomeworkList(hwData);
      } catch (error) { console.error("Error fetching homework"); } finally { setHwLoading(false); }
    };
    if (userData?.schoolId && activeTab === "homework") fetchHomework();
  }, [userData, activeTab]);

  /* [BLOCK 6: ATTENDANCE CALCULATIONS]
    - KYA: Total classes, present days, aur percentage ka math calculate karta hai.
    - KYUN: Overview dashboard par bade number wale 3 boxes (Stats Cards) show karne ke liye.
    - KESE: 'attendanceRecords' array ki direct length se total din nikalta hai. Phir 'filter' function lagakar ginta hai ki status "Present" kitni baar hai. Aakhiri me (Present / Total) * 100 karke percentage round off karta hai.
  */
  const totalDays = attendanceRecords.length;
  const presentDays = attendanceRecords.filter(r => r.status === "Present").length;
  const attendancePercentage = totalDays === 0 ? 0 : Math.round((presentDays / totalDays) * 100);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar - Mobile Responsive */}
      <div className="w-full md:w-64 bg-blue-900 text-white p-4 md:p-6 flex flex-row md:flex-col overflow-x-auto md:overflow-visible shadow-md z-10 md:min-h-screen">
        <h2 className="text-xl md:text-2xl font-bold mb-0 md:mb-8 mr-6 md:mr-0 shrink-0 self-center md:self-start">Student Panel</h2>
        <div className="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-4 text-sm flex-1">
          <p onClick={() => setActiveTab("dashboard")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "dashboard" ? "bg-blue-700" : "hover:bg-blue-800"}`}>Dashboard</p>
          <p onClick={() => setActiveTab("homework")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "homework" ? "bg-blue-700" : "hover:bg-blue-800"}`}>My Homework</p>
          <p onClick={() => setActiveTab("timetable")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "timetable" ? "bg-blue-700" : "hover:bg-blue-800"}`}>Schedule</p>
          <p onClick={() => setActiveTab("attendance")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "attendance" ? "bg-blue-700" : "hover:bg-blue-800"}`}>Attendance Log</p>
          <p onClick={() => setActiveTab("report")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "report" ? "bg-blue-700" : "hover:bg-blue-800"}`}>Report Card</p>
          <p onClick={() => setActiveTab("notices")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "notices" ? "bg-blue-700" : "hover:bg-blue-800"}`}>Notices</p>
        </div>
        <button onClick={logout} className="ml-4 md:ml-0 md:mt-auto bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition shrink-0">Logout</button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            {activeTab === "dashboard" && "My Overview"}
            {activeTab === "homework" && "Assigned Homework"}
            {activeTab === "attendance" && "Attendance History"}
            {activeTab === "notices" && "School Notice Board"}
            {activeTab === "report" && "Academic Performance"}
            {activeTab === "timetable" && "Weekly Schedule"}
          </h1>
          <span className="bg-blue-100 text-blue-900 border border-blue-200 px-4 py-1 rounded-full text-xs md:text-sm shadow-sm font-bold">Class: {userData?.classId || "Unassigned"}</span>
        </div>

        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="max-w-5xl">
            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-100 flex items-center gap-6">
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold">
                {userData?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{userData?.name}</h2>
                <p className="text-gray-500">{userData?.email}</p>
                <div className="mt-2 flex gap-3">
                  <span className="bg-gray-100 px-3 py-1 text-xs rounded text-gray-700 font-medium">Role: Student</span>
                  <span className="bg-blue-50 text-blue-700 px-3 py-1 text-xs rounded font-medium">School ID: {userData?.schoolId}</span>
                </div>
              </div>
            </div>

            {/* Attendance Summary Cards */}
            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Attendance Overview</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center border-b-4 border-b-gray-400">
                <h3 className="text-gray-500 text-sm mb-1 font-medium">Total Classes</h3><p className="text-3xl font-bold text-gray-800">{totalDays}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center border-b-4 border-b-green-500">
                <h3 className="text-gray-500 text-sm mb-1 font-medium">Classes Attended</h3><p className="text-3xl font-bold text-green-600">{presentDays}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center border-b-4 border-b-blue-500">
                <h3 className="text-gray-500 text-sm mb-1 font-medium">Attendance %</h3><p className={`text-3xl font-bold ${attendancePercentage >= 75 ? 'text-blue-600' : 'text-red-500'}`}>{attendancePercentage}%</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: HOMEWORK */}
        {activeTab === "homework" && (
          <div className="max-w-4xl space-y-4">
            {hwLoading ? <p className="text-gray-500">Checking for new homework...</p> : homeworkList.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-100">
                <p className="text-gray-500">Yay! No homework assigned right now. Enjoy your day!</p>
              </div>
            ) : (
              homeworkList.map((hw) => (
                <div key={hw.id} className="bg-white rounded-xl shadow-sm p-5 md:p-6 border-l-4 border-l-orange-500 relative">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg md:text-xl font-bold text-gray-800">{hw.title}</h3>
                    <span className="bg-red-50 text-red-600 border border-red-100 text-xs font-bold px-2 py-1 rounded">Due: {hw.dueDate}</span>
                  </div>
                  <p className="text-gray-600 whitespace-pre-wrap mt-2">{hw.description}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: TIMETABLE */}
        {activeTab === "timetable" && (
          <div className="max-w-4xl">
            {ttLoading ? <p className="text-gray-500 py-4">Fetching schedule...</p> : timetableData.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-100"><p className="text-gray-500">No classes scheduled for {userData?.classId} yet.</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {timetableData.map((tt) => (
                  <div key={tt.id} className="bg-white rounded-xl shadow-sm p-5 border-t-4 border-blue-500">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-800 text-lg">{tt.day}</span>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p className="flex justify-between border-b pb-1"><span>Time:</span> <span className="font-semibold text-gray-800">{tt.time}</span></p>
                      <p className="flex justify-between border-b pb-1"><span>Subject:</span> <span className="font-semibold text-gray-800">{tt.subject}</span></p>
                      <p className="flex justify-between"><span>Teacher:</span> <span className="font-semibold text-gray-800">{tt.teacher}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ATTENDANCE LOG */}
        {activeTab === "attendance" && ( 
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-gray-100 max-w-3xl">
            {!loading && attendanceRecords.length > 0 ? (
              <table className="w-full text-left border-collapse min-w-80">
                <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="p-4 text-gray-600 text-sm">Date</th><th className="p-4 text-gray-600 text-sm">Status</th></tr></thead>
                <tbody>
                  {attendanceRecords.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-700">{r.date}</td>
                      <td className="p-4"><span className={`px-3 py-1 rounded-full text-xs font-bold ${r.status === "Present" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.status.toUpperCase()}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-gray-500">No attendance records found.</p>
            )}
          </div>
        )}

        {/* TAB 5: REPORT CARDS */}
        {activeTab === "report" && (
           <div className="max-w-3xl space-y-6">
             {!reportLoading && reportCards.length === 0 ? <p className="text-gray-500">No report cards uploaded yet.</p> : reportCards.map((report) => (
                <div key={report.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                  <div className="bg-blue-900 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{report.examType} Result</h3><span className="bg-blue-800 px-3 py-1 rounded-full text-xs">Total: {report.totalMarks} / 500</span></div>
                  <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="w-full sm:w-auto">
                      <p className="text-sm text-gray-500">Overall Percentage</p>
                      <p className={`text-3xl font-bold ${report.percentage >= 33 ? 'text-green-600' : 'text-red-600'}`}>{report.percentage}%</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full text-sm">
                      <div className="bg-gray-50 p-2 rounded border text-center"><p className="text-gray-500 text-xs">Math</p><p className="font-bold">{report.marks?.math || 0}</p></div>
                      <div className="bg-gray-50 p-2 rounded border text-center"><p className="text-gray-500 text-xs">Science</p><p className="font-bold">{report.marks?.science || 0}</p></div>
                      <div className="bg-gray-50 p-2 rounded border text-center"><p className="text-gray-500 text-xs">English</p><p className="font-bold">{report.marks?.english || 0}</p></div>
                      <div className="bg-gray-50 p-2 rounded border text-center"><p className="text-gray-500 text-xs">Hindi</p><p className="font-bold">{report.marks?.hindi || 0}</p></div>
                      <div className="bg-gray-50 p-2 rounded border text-center"><p className="text-gray-500 text-xs">Computer</p><p className="font-bold">{report.marks?.computer || 0}</p></div>
                    </div>
                  </div>
                </div>
             ))}
           </div>
        )}

        {/* TAB 6: NOTICES */}
        {activeTab === "notices" && (
          <div className="max-w-3xl space-y-4">
            {!noticeLoading && notices.length === 0 ? <p className="text-gray-500">No recent notices.</p> : notices.map((notice) => (
               <div key={notice.id} className="bg-white rounded-xl shadow-sm p-4 md:p-6 border-l-4 border-blue-600 relative">
                 <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2">{notice.title}</h3>
                 <p className="text-gray-700 whitespace-pre-wrap text-sm md:text-base">{notice.message}</p>
                 {notice.link && <a href={notice.link} target="_blank" rel="noreferrer" className="inline-block mt-3 text-blue-600 text-sm hover:underline">View Link ↗</a>}
               </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}