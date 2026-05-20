import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/firebase";
import { collection, query, where, getDocs, doc, setDoc, addDoc } from "firebase/firestore"; 

export default function TeacherDashboard() {
  const { userData, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard"); 

  // --- States ---
  const [classList, setClassList] = useState([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState(""); 

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState({});
  const [submitMessage, setSubmitMessage] = useState({ type: "", text: "" });

  const [notices, setNotices] = useState([]);
  const [noticeLoading, setNoticeLoading] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState("");
  const [examType, setExamType] = useState("Mid Term");
  const [marks, setMarks] = useState({ math: "", science: "", english: "", hindi: "", computer: "" });
  const [marksMessage, setMarksMessage] = useState({ type: "", text: "" });
  const [marksLoading, setMarksLoading] = useState(false);

  const [timetableData, setTimetableData] = useState([]);
  const [ttLoading, setTtLoading] = useState(false);

  // NAYA: Homework States
  const [hwTitle, setHwTitle] = useState("");
  const [hwDescription, setHwDescription] = useState("");
  const [hwClassId, setHwClassId] = useState("");
  const [hwDueDate, setHwDueDate] = useState("");
  const [hwLoading, setHwLoading] = useState(false);
  const [hwMessage, setHwMessage] = useState({ type: "", text: "" });

  const today = new Date().toISOString().split("T")[0];
  const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }); // Aaj ka din (e.g., "Monday")

  /* [BLOCK 1: FETCH CLASSES]
    - KYA: Yeh school me available saari classes ki list lata hai.
    - KYUN: Taki teacher jab attendance ya marks chadhane jaye, toh use dropdown me classes dikhein.
    - KESE: 'classes' collection me teacher ke 'schoolId' ka filter lagata hai aur saari classes nikal kar 'classList' me save kar leta hai.
  */
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const q = query(collection(db, "classes"), where("schoolId", "==", userData?.schoolId));
        const querySnapshot = await getDocs(q);
        const clsData = [];
        querySnapshot.forEach((doc) => clsData.push({ id: doc.id, ...doc.data() }));
        setClassList(clsData);
      } catch (error) { console.error("Error fetching classes:", error); }
    };
    if (userData?.schoolId) fetchClasses();
  }, [userData]);

  /* [BLOCK 2: FETCH STUDENTS BY CLASS]
    - KYA: Jo class teacher ne dropdown se select ki hai, sirf usi ke students lata hai.
    - KYUN: Taki teacher sirf apni class ke bachhon ka attendance ya result manage kar sake.
    - KESE: 'users' collection me 3 filter lagte hain: schoolId match ho, role 'student' ho, aur 'classId' select ki gayi class se match ho. Fetch hote hi sab bachhon ka default attendance 'Present' set kar deta hai `initialAttendance` object me.
  */
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClassFilter) {
        setStudents([]); return;
      }
      setLoading(true);
      try {
        const q = query(
          collection(db, "users"), 
          where("schoolId", "==", userData?.schoolId), 
          where("role", "==", "student"),
          where("classId", "==", selectedClassFilter) 
        );
        const querySnapshot = await getDocs(q);
        const studentsList = [];
        const initialAttendance = {};
        querySnapshot.forEach((doc) => {
          studentsList.push({ id: doc.id, ...doc.data() });
          initialAttendance[doc.id] = "Present"; 
        });
        setStudents(studentsList);
        setAttendanceData(initialAttendance);
      } catch (error) { console.error("Error fetching students"); } finally { setLoading(false); }
    };

    if (activeTab === "attendance" || activeTab === "marks") fetchStudents();
  }, [userData, activeTab, selectedClassFilter]);

  /* [BLOCK 3: FETCH NOTICES]
    - KYA: Puraane notices fetch karta hai, par sirf last 3 din wale.
    - KYUN: Teacher ko latest notice dashboard par dikhane ke liye.
    - KESE: 'notices' collection se school ke notices lata hai, phir ek logic (`new Date(data.createdAt) >= threeDaysAgo`) se purane delete karke sirf latest notices ko 'notices' state me rakhta hai.
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
    if (userData?.schoolId) fetchNotices();
  }, [userData]);

  /* [BLOCK 4: FETCH TIMETABLE]
    - KYA: School ka poora schedule/timetable lata hai.
    - KYUN: Teacher apne dashboard par apni aane wali classes dekh sake.
    - KESE: 'timetable' collection se data fetch karta hai aur usko week ke dino ke hisab se (Monday to Saturday order me) sort karke 'timetableData' me save karta hai.
  */
  useEffect(() => {
    const fetchTimetable = async () => {
      setTtLoading(true);
      try {
        const q = query(collection(db, "timetable"), where("schoolId", "==", userData?.schoolId));
        const querySnapshot = await getDocs(q);
        const ttData = [];
        querySnapshot.forEach((doc) => ttData.push({ id: doc.id, ...doc.data() }));
        const daysOrder = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6 };
        ttData.sort((a, b) => daysOrder[a.day] - daysOrder[b.day]);
        setTimetableData(ttData);
      } catch (error) { console.error("Error fetching timetable"); } finally { setTtLoading(false); }
    };
    if (userData?.schoolId) fetchTimetable();
  }, [userData]);


  // --- Functions ---
  const handleAttendanceChange = (studentId, status) => setAttendanceData((prev) => ({ ...prev, [studentId]: status }));

  /* [BLOCK 5: SUBMIT ATTENDANCE]
    - KYA: Teacher dwara mark ki gayi attendance ko database me save karta hai.
    - KYUN: Taki student apne dashboard me dekh sake ki wo kis din present tha aur kis din absent.
    - KESE: Yeh saare students ke array par ek 'for' loop chalata hai. Har student ka ek document banata hai jiski ID uske `studentId_date` (e.g., "123_2026-05-19") se banti hai, aur ise 'attendance' collection me 'setDoc' kar deta hai.
  */
  const submitAttendance = async () => {
    setSubmitMessage({ type: "", text: "" });
    try {
      for (const student of students) {
        await setDoc(doc(db, "attendance", `${student.id}_${today}`), {
          studentId: student.id, studentName: student.name, date: today, status: attendanceData[student.id], schoolId: userData.schoolId, classId: selectedClassFilter
        });
      }
      setSubmitMessage({ type: "success", text: "Attendance Submitted for " + selectedClassFilter });
    } catch (error) { setSubmitMessage({ type: "error", text: "Error submitting attendance." }); }
  };

  /* [BLOCK 6: UPLOAD MARKS]
    - KYA: Kisi ek student ka kisi ek exam (e.g., Mid Term) ka result save karta hai.
    - KYUN: Report card generate karne ke liye.
    - KESE: Pehle form se 5 subjects ke marks nikal kar unhe Numbers me badalta hai, unka Total aur Percentage nikalta hai. Phir 'marks' collection me ek document banata hai jisme data store hota hai.
  */
  const handleUploadMarks = async (e) => {
    e.preventDefault(); setMarksLoading(true); setMarksMessage({ type: "", text: "" });
    if (!selectedStudent) { setMarksMessage({ type: "error", text: "Select a student." }); setMarksLoading(false); return; }
    try {
      const m = Number(marks.math); const s = Number(marks.science); const eng = Number(marks.english); const h = Number(marks.hindi); const c = Number(marks.computer);
      const total = m + s + eng + h + c; const percentage = (total / 500) * 100;
      const studentObj = students.find(st => st.id === selectedStudent);
      const docId = `${selectedStudent}_${examType.replace(/\s+/g, '')}`;

      await setDoc(doc(db, "marks", docId), {
        studentId: selectedStudent, studentName: studentObj.name, classId: selectedClassFilter, schoolId: userData.schoolId, examType: examType,
        marks: { math: m, science: s, english: eng, hindi: h, computer: c }, totalMarks: total, percentage: Number(percentage.toFixed(2)), uploadedAt: new Date().toISOString()
      });
      setMarksMessage({ type: "success", text: "Marks uploaded successfully!" });
      setMarks({ math: "", science: "", english: "", hindi: "", computer: "" }); setSelectedStudent("");
    } catch (error) { setMarksMessage({ type: "error", text: "Failed to upload marks." }); } finally { setMarksLoading(false); }
  };

  /* [BLOCK 7: ASSIGN HOMEWORK]
    - KYA: Teacher dwara kisi class ko homework assign karne ka logic.
    - KYUN: Taki student ke dashboard par daily task/homework reflect ho sake.
    - KESE: Form se Class, Title, Due Date aur Description lekar, 'addDoc' ka use karke us data ko 'homework' collection me bhej deta hai taaki student dashboard wahan se use padh le.
  */
  const handleAssignHomework = async (e) => {
    e.preventDefault(); setHwLoading(true); setHwMessage({ type: "", text: "" });
    try {
      await addDoc(collection(db, "homework"), {
        title: hwTitle, description: hwDescription, classId: hwClassId, dueDate: hwDueDate,
        teacherId: userData.schoolId, schoolId: userData.schoolId, createdAt: new Date().toISOString()
      });
      setHwMessage({ type: "success", text: `Homework assigned to ${hwClassId}!` });
      setHwTitle(""); setHwDescription(""); setHwClassId(""); setHwDueDate("");
    } catch (error) {
      setHwMessage({ type: "error", text: "Failed to assign homework." });
    } finally { setHwLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar Content Panel */}
      <div className="w-full md:w-64 bg-teal-900 text-white p-4 md:p-6 flex flex-row md:flex-col overflow-x-auto md:overflow-visible shadow-md z-10 md:min-h-screen">
        <h2 className="text-xl md:text-2xl font-bold mb-0 md:mb-8 mr-6 md:mr-0 shrink-0 self-center md:self-start">Teacher Panel</h2>
        <div className="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-4 text-sm flex-1">
          <p onClick={() => setActiveTab("dashboard")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "dashboard" ? "bg-teal-700" : "hover:bg-teal-800"}`}>Dashboard</p>
          <p onClick={() => setActiveTab("attendance")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "attendance" ? "bg-teal-700" : "hover:bg-teal-800"}`}>Attendance</p>
          <p onClick={() => setActiveTab("homework")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "homework" ? "bg-teal-700" : "hover:bg-teal-800"}`}>Homework</p>
          <p onClick={() => setActiveTab("marks")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "marks" ? "bg-teal-700" : "hover:bg-teal-800"}`}>Upload Marks</p>
          <p onClick={() => setActiveTab("notices")} className={`p-2 md:p-3 rounded cursor-pointer whitespace-nowrap transition ${activeTab === "notices" ? "bg-teal-700" : "hover:bg-teal-800"}`}>Notices</p>
        </div>
        <button onClick={logout} className="ml-4 md:ml-0 md:mt-auto bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition shrink-0">Logout</button>
      </div>

      {/* Main UI Area */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            {activeTab === "dashboard" && "Dashboard & Schedule"}
            {activeTab === "attendance" && "Attendance Register"}
            {activeTab === "homework" && "Assign Homework"}
            {activeTab === "marks" && "Upload Student Marks"}
            {activeTab === "notices" && "School Notice Board"}
          </h1>
          <span className="bg-teal-800 text-white px-4 py-1 rounded-full text-xs md:text-sm shadow">School ID: {userData?.schoolId}</span>
        </div>

        {/* Dashboard Section */}
        {activeTab === "dashboard" && (
          <div className="max-w-5xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-l-teal-500">
                <div><p className="text-sm text-gray-500 font-medium">My Classes</p><p className="text-3xl font-bold text-gray-800">{classList.length}</p></div>
                <div className="text-3xl">🏫</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-l-blue-500">
                <div><p className="text-sm text-gray-500 font-medium">Today's Lectures</p><p className="text-3xl font-bold text-gray-800">{timetableData.filter(tt => tt.day === currentDayName).length}</p></div>
                <div className="text-3xl">📅</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-l-purple-500">
                <div><p className="text-sm text-gray-500 font-medium">Recent Notices</p><p className="text-3xl font-bold text-gray-800">{notices.length}</p></div>
                <div className="text-3xl">📌</div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Full Weekly Schedule</h2>
            {ttLoading ? <p>Loading...</p> : timetableData.length === 0 ? <p className="text-gray-500">No classes scheduled yet.</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {timetableData.map((tt) => (
                  <div key={tt.id} className={`bg-white rounded-xl shadow-sm p-4 border-t-4 ${tt.day === currentDayName ? 'border-blue-500 bg-blue-50' : 'border-teal-500'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-md">{tt.day} {tt.day === currentDayName && "(Today)"}</span>
                      <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2 py-1 rounded">{tt.classId}</span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600"><p><b>Time:</b> {tt.time}</p><p><b>Subject:</b> {tt.subject}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attendance Section */}
        {activeTab === "attendance" && (
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 w-full max-w-3xl border border-gray-100">
            <div className="mb-6 bg-gray-50 p-4 rounded border border-gray-200">
              <label className="block text-sm font-bold text-gray-700 mb-2">Select Class</label>
              <select value={selectedClassFilter} onChange={(e) => setSelectedClassFilter(e.target.value)} className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                <option value="">-- Choose a Class --</option>
                {classList.map(c => <option key={c.id} value={c.displayString}>{c.displayString}</option>)}
              </select>
            </div>

            {selectedClassFilter && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg md:text-xl font-bold text-gray-800">Students of {selectedClassFilter}</h2>
                  <span className="text-sm font-semibold bg-gray-200 px-3 py-1 rounded">{today}</span>
                </div>
                {submitMessage.text && (<div className={`p-4 mb-4 rounded text-sm ${submitMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{submitMessage.text}</div>)}
                
                {loading ? <p className="text-gray-500">Loading students...</p> : students.length === 0 ? <p className="text-red-500 font-medium">No students found.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max text-left border-collapse mb-6">
                      <thead><tr className="bg-gray-50 border-b"><th className="p-3 text-sm">Name</th><th className="p-3 text-sm">Status</th></tr></thead>
                      <tbody>
                        {students.map((student) => (
                          <tr key={student.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium text-gray-700">{student.name}</td>
                            <td className="p-3 whitespace-nowrap">
                              <label className="mr-4 cursor-pointer"><input type="radio" checked={attendanceData[student.id] === "Present"} onChange={() => handleAttendanceChange(student.id, "Present")} className="mr-1 accent-green-600"/>Present</label>
                              <label className="cursor-pointer"><input type="radio" checked={attendanceData[student.id] === "Absent"} onChange={() => handleAttendanceChange(student.id, "Absent")} className="mr-1 accent-red-600"/>Absent</label>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button onClick={submitAttendance} className="w-full md:w-auto bg-teal-700 hover:bg-teal-900 text-white font-semibold py-2 px-6 rounded transition md:float-right">Submit Attendance</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Homework Section */}
        {activeTab === "homework" && (
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 max-w-2xl border border-gray-100">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-6">Create New Homework</h2>
            {hwMessage.text && (<div className={`p-4 mb-6 rounded text-sm ${hwMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{hwMessage.text}</div>)}
            
            <form onSubmit={handleAssignHomework} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select Class *</label>
                <select required value={hwClassId} onChange={(e) => setHwClassId(e.target.value)} className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-teal-500 bg-white">
                  <option value="" disabled>-- Choose a Class --</option>
                  {classList.map(c => <option key={c.id} value={c.displayString}>{c.displayString}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Homework Title *</label><input type="text" required value={hwTitle} onChange={(e) => setHwTitle(e.target.value)} placeholder="e.g. Chapter 4 Exercises" className="w-full px-4 py-2 border rounded" /></div>
                <div><label className="block text-sm font-medium mb-1">Due Date *</label><input type="date" required value={hwDueDate} onChange={(e) => setHwDueDate(e.target.value)} min={today} className="w-full px-4 py-2 border rounded" /></div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description / Instructions *</label>
                <textarea required value={hwDescription} onChange={(e) => setHwDescription(e.target.value)} rows="4" placeholder="Write detailed homework instructions here..." className="w-full px-4 py-2 border rounded outline-none"></textarea>
              </div>
              <button type="submit" disabled={hwLoading} className="w-full bg-teal-700 hover:bg-teal-900 text-white py-2.5 rounded mt-4 transition">Assign Homework</button>
            </form>
          </div>
        )}

        {/* Marks Upload Section */}
        {activeTab === "marks" && (
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 w-full max-w-2xl border border-gray-100">
            <div className="mb-6 bg-gray-50 p-4 rounded border border-gray-200">
              <label className="block text-sm font-bold text-gray-700 mb-2">Select Class First</label>
              <select value={selectedClassFilter} onChange={(e) => { setSelectedClassFilter(e.target.value); setSelectedStudent(""); }} className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-teal-500 bg-white">
                <option value="">-- Choose a Class --</option>
                {classList.map(c => <option key={c.id} value={c.displayString}>{c.displayString}</option>)}
              </select>
            </div>

            {selectedClassFilter && (
              <form onSubmit={handleUploadMarks} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Student</label>
                    <select required value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} className="w-full px-4 py-2 border rounded bg-white">
                      <option value="" disabled>Select...</option>
                      {students.length === 0 ? <option disabled>No students found</option> : students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Exam Type</label>
                    <select required value={examType} onChange={(e) => setExamType(e.target.value)} className="w-full px-4 py-2 border rounded bg-white">
                      <option value="Mid Term">Mid Term</option><option value="Final Exam">Final</option>
                    </select>
                  </div>
                </div>

                {students.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 bg-gray-50 p-4 rounded border">
                      <div><label className="text-xs font-bold text-gray-500">Math</label><input type="number" required value={marks.math} onChange={(e) => setMarks({...marks, math: e.target.value})} className="w-full px-2 py-1 border rounded"/></div>
                      <div><label className="text-xs font-bold text-gray-500">Science</label><input type="number" required value={marks.science} onChange={(e) => setMarks({...marks, science: e.target.value})} className="w-full px-2 py-1 border rounded"/></div>
                      <div><label className="text-xs font-bold text-gray-500">English</label><input type="number" required value={marks.english} onChange={(e) => setMarks({...marks, english: e.target.value})} className="w-full px-2 py-1 border rounded"/></div>
                      <div><label className="text-xs font-bold text-gray-500">Hindi</label><input type="number" required value={marks.hindi} onChange={(e) => setMarks({...marks, hindi: e.target.value})} className="w-full px-2 py-1 border rounded"/></div>
                      <div><label className="text-xs font-bold text-gray-500">Computer</label><input type="number" required value={marks.computer} onChange={(e) => setMarks({...marks, computer: e.target.value})} className="w-full px-2 py-1 border rounded"/></div>
                    </div>
                    <button type="submit" disabled={marksLoading} className="w-full bg-teal-700 hover:bg-teal-900 text-white py-2.5 rounded transition">Upload Marks</button>
                  </>
                )}
              </form>
            )}
            {marksMessage.text && <p className={`mt-4 text-center font-bold ${marksMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>{marksMessage.text}</p>}
          </div>
        )}

        {/* Notices Section */}
        {activeTab === "notices" && (
          <div className="max-w-3xl space-y-4">
            {noticeLoading ? <p>Loading notices...</p> : notices.length === 0 ? <p className="text-gray-500">No recent notices.</p> : notices.map((notice) => (
               <div key={notice.id} className="bg-white rounded-xl shadow-sm p-4 md:p-6 border-l-4 border-teal-500 relative">
                 <h3 className="text-lg md:text-xl font-bold mb-2 text-gray-800">{notice.title}</h3>
                 <p className="whitespace-pre-wrap text-sm md:text-base text-gray-600">{notice.message}</p>
                 {notice.link && <a href={notice.link} target="_blank" rel="noreferrer" className="text-blue-600 font-medium text-sm mt-3 inline-block hover:underline">View Attachment / Link</a>}
               </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}