import { useEffect, useState } from 'react';
import {
  adminCreateCourse,
  adminFetchFees,
  adminFulfillFeeDemand,
  adminCreateProf,
  adminCreateStudent,
  adminCreateTimetable,
  adminGenerateFees,
  adminFetchUsers,
} from '../api.js';

function AdminDashboard({ onMessage }) {
  const [users, setUsers] = useState([]);
  const [fees, setFees] = useState([]);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const profs = users.filter((user) => user.role === 'prof');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const [usersData, feesData] = await Promise.all([
        adminFetchUsers(),
        adminFetchFees(),
      ]);
      setUsers(usersData);
      setFees(feesData);
    } catch (err) {
      onMessage(err.message);
    }
  }

  async function handleSubmit(event, action) {
    event.preventDefault();
    setBusy(true);
    onMessage('');

    try {
      let result;
      if (action === 'student') {
        result = await adminCreateStudent({
          first_name: form.studentFirstName,
          last_name: form.studentLastName,
          email: form.studentEmail,
          password: form.studentPassword,
          roll_no: form.studentRollNo,
        });
      } else if (action === 'prof') {
        result = await adminCreateProf({
          first_name: form.profFirstName,
          last_name: form.profLastName,
          email: form.profEmail,
          password: form.profPassword,
          employee_id: form.profEmployeeId,
        });
      } else if (action === 'course') {
        result = await adminCreateCourse({
          course_code: form.courseCode,
          course_name: form.courseName,
          credits: Number(form.courseCredits),
          professor: form.courseProfessorId,
        });
      } else if (action === 'timetable') {
        result = await adminCreateTimetable({
          course: form.timetableCourseId,
          day_of_week: form.timetableDay,
          start_time: form.timetableStart,
          end_time: form.timetableEnd,
          room_no: form.timetableRoom,
        });
      } else if (action === 'fees') {
        result = await adminGenerateFees({
          semester: Number(form.feeSemester),
          academic_year: form.feeAcademicYear,
          amount: Number(form.feeAmount),
          due_date: form.feeDueDate,
          remarks: form.feeRemarks,
        });
      }

      onMessage(result.message || 'Saved successfully');
      await loadUsers();
      setForm({});
    } catch (err) {
      onMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleFulfillFee(feeId) {
    setBusy(true);
    onMessage('');

    try {
      const result = await adminFulfillFeeDemand(feeId);
      onMessage(result.message || 'Fee fulfilled');
      await loadUsers();
    } catch (err) {
      onMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h3>Admin tools</h3>
        <form className="form-stack" onSubmit={(event) => handleSubmit(event, 'student')}>
          <h4>Add student</h4>
          <input placeholder="First name" value={form.studentFirstName || ''} onChange={(e) => setForm({ ...form, studentFirstName: e.target.value })} required />
          <input placeholder="Last name" value={form.studentLastName || ''} onChange={(e) => setForm({ ...form, studentLastName: e.target.value })} required />
          <input placeholder="Email" type="email" value={form.studentEmail || ''} onChange={(e) => setForm({ ...form, studentEmail: e.target.value })} required />
          <input placeholder="Password" type="password" value={form.studentPassword || ''} onChange={(e) => setForm({ ...form, studentPassword: e.target.value })} required />
          <input placeholder="Roll No" value={form.studentRollNo || ''} onChange={(e) => setForm({ ...form, studentRollNo: e.target.value })} />
          <button className="btn btn-primary" type="submit" disabled={busy}>Create student</button>
        </form>

        <form className="form-stack" onSubmit={(event) => handleSubmit(event, 'prof')}>
          <h4>Add professor</h4>
          <input placeholder="First name" value={form.profFirstName || ''} onChange={(e) => setForm({ ...form, profFirstName: e.target.value })} required />
          <input placeholder="Last name" value={form.profLastName || ''} onChange={(e) => setForm({ ...form, profLastName: e.target.value })} required />
          <input placeholder="Email" type="email" value={form.profEmail || ''} onChange={(e) => setForm({ ...form, profEmail: e.target.value })} required />
          <input placeholder="Password" type="password" value={form.profPassword || ''} onChange={(e) => setForm({ ...form, profPassword: e.target.value })} required />
          <input placeholder="Employee ID" value={form.profEmployeeId || ''} onChange={(e) => setForm({ ...form, profEmployeeId: e.target.value })} />
          <button className="btn btn-primary" type="submit" disabled={busy}>Create professor</button>
        </form>
      </div>

      <div className="card">
        <form className="form-stack" onSubmit={(event) => handleSubmit(event, 'course')}>
          <h4>Create course</h4>
          <input placeholder="Course code" value={form.courseCode || ''} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} required />
          <input placeholder="Course name" value={form.courseName || ''} onChange={(e) => setForm({ ...form, courseName: e.target.value })} required />
          <input placeholder="Credits" type="number" min="1" value={form.courseCredits || ''} onChange={(e) => setForm({ ...form, courseCredits: e.target.value })} required />
          <select
            value={form.courseProfessorId || ''}
            onChange={(e) => setForm({ ...form, courseProfessorId: e.target.value })}
            required
          >
            <option value="">Select professor</option>
            {profs.map((prof) => (
              <option key={prof._id} value={prof._id}>
                {prof.first_name} {prof.last_name} ({prof.employee_id || prof.email})
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit" disabled={busy}>Create course</button>
        </form>

        <form className="form-stack" onSubmit={(event) => handleSubmit(event, 'timetable')}>
          <h4>Create timetable entry</h4>
          <input placeholder="Course ID" value={form.timetableCourseId || ''} onChange={(e) => setForm({ ...form, timetableCourseId: e.target.value })} required />
          <input placeholder="Day of week" value={form.timetableDay || ''} onChange={(e) => setForm({ ...form, timetableDay: e.target.value })} required />
          <input placeholder="Start time" value={form.timetableStart || ''} onChange={(e) => setForm({ ...form, timetableStart: e.target.value })} required />
          <input placeholder="End time" value={form.timetableEnd || ''} onChange={(e) => setForm({ ...form, timetableEnd: e.target.value })} required />
          <input placeholder="Room no" value={form.timetableRoom || ''} onChange={(e) => setForm({ ...form, timetableRoom: e.target.value })} />
          <button className="btn btn-primary" type="submit" disabled={busy}>Create timetable</button>
        </form>

        <form className="form-stack" onSubmit={(event) => handleSubmit(event, 'fees')}>
          <h4>Generate semester fee demand</h4>
          <input placeholder="Semester" type="number" min="1" value={form.feeSemester || ''} onChange={(e) => setForm({ ...form, feeSemester: e.target.value })} required />
          <input placeholder="Academic year (e.g. 2025-26)" value={form.feeAcademicYear || ''} onChange={(e) => setForm({ ...form, feeAcademicYear: e.target.value })} required />
          <input placeholder="Amount" type="number" min="0" value={form.feeAmount || ''} onChange={(e) => setForm({ ...form, feeAmount: e.target.value })} required />
          <input type="date" value={form.feeDueDate || ''} onChange={(e) => setForm({ ...form, feeDueDate: e.target.value })} required />
          <textarea placeholder="Remarks" value={form.feeRemarks || ''} onChange={(e) => setForm({ ...form, feeRemarks: e.target.value })} />
          <button className="btn btn-primary" type="submit" disabled={busy}>Generate for all students</button>
        </form>
      </div>

      <div className="card full-width">
        <div className="panel-toolbar">
          <h3>Known users</h3>
          <button className="btn btn-secondary" onClick={loadUsers}>Reload users</button>
        </div>
        {users.length === 0 ? (
          <p>No users loaded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Name</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>{user._id}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.first_name} {user.last_name}</td>
                  <td>{user.role === 'student' ? user.roll_no || 'N/A' : user.employee_id || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card full-width">
        <h3>Generated fee demands</h3>
        {fees.length === 0 ? (
          <p>No fee demands generated yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Demand No.</th>
                <th>Student</th>
                <th>Semester</th>
                <th>Academic Year</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee._id}>
                  <td>{fee.demand_number}</td>
                  <td>{fee.student?.first_name} {fee.student?.last_name}</td>
                  <td>{fee.semester}</td>
                  <td>{fee.academic_year}</td>
                  <td>INR {Number(fee.amount).toFixed(2)}</td>
                  <td>{new Date(fee.due_date).toLocaleDateString()}</td>
                  <td>{fee.status}</td>
                  <td>
                    {fee.status === 'paid' ? (
                      'Fulfilled'
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => handleFulfillFee(fee._id)}
                      >
                        Fulfill demand
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
